import User from '../../entities/User'
import { OrderSide, Symbol } from 'binance-api-node'
import NegotiationTable, { ParticipantPair } from './NegotiationTable'
import Analysis, { AssignedPair } from '../Analysis'
import Logger from '../../services/Logger'
import TradeBotEntity, { TradePairEntity } from '../../entities/TradeBotEntity'
import SavedOrder from '../../entities/SavedOrder'
import { PairData } from '../../entities/ScoresWeightsModelV1'
import BinanceApi from '../Binance'
import PairWeightsEntityV1 from '../../entities/PairWeightsEntityV1'
import MLTrainer from '../Analysis/MachineLearning/MLTrainer'

export interface Trade extends ParticipantPair {
  score: number,
  baseAmount: number
  baseSymbol: string
  dollarValue: number
  feeDollar?: number
  success?: boolean
}

export interface CandidatePair extends AssignedPair {
  collectorScore?: number
  minBase?: number
  minQuote?: number
  stepSize?: number
  price?: number
  baseSymbol?: string
  score: number
}

export interface DroppedPair {
  pair: string
  score: number
  price: number
  side: OrderSide
  provider: string
  collector: string
  minBase: number
  minQuote: number
  stepSize: number
  dropCode: number
  providerFundsBtc?: number
  collectorAmountBtc?: number
  providerFunds?: number
  collectorAmount?: number
  baseAmount?: number
  quoteAmount?: number
}

interface ITradeBot {
  prices: { [pair: string]: number }
  analysis: Analysis
}

class TradeBot implements ITradeBot {

  protected readonly user: User
  private entity: TradeBotEntity

  protected pairsInfo: Symbol[] = []

  private balance: { [pair: string]: number } = {}
  private balancePostTrade: { [pair: string]: number } = {}
  public prices: { [pair: string]: number } = { ['BTCBTC']: 1 }
  private balanceTotalBtc: number = 0
  public analysis: Analysis

  private negotiationTable: NegotiationTable

  private tradePromises: Promise<void>[] = []

  private trades: Trade[] = []
  private savedOrders: SavedOrder[] = []
  private droppedPairs: DroppedPair[] = []
  private dollarDiff: number

  private prevPairData: { [pair: string]: PairData } = {}
  private pairData: { [pair: string]: PairData } = {}

  constructor(user: User, prevPairData: { [pair: string]: PairData }) {
    this.user = user
    this.entity = new TradeBotEntity()
    this.entity.user = user
    this.entity.symbols = this.user.symbols

    this.balance = this.getNormalizedSymbols()
    this.balancePostTrade = this.getNormalizedSymbols()

    this.prevPairData = prevPairData

  }

  protected readonly getNormalizedSymbols = (): { [symbol: string]: number } => {
    const obj = {}
    for (let i = 0, len = this.user.symbols.length; i < len; i++) obj[this.user.symbols[i]] = 0
    return obj
  }

  public async run(Binance: BinanceApi) {
    const start = Date.now()
    const logger = new Logger()

    const balanceBtc = this.getNormalizedSymbols()
    const dollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()
    const differenceBtc = this.getNormalizedSymbols()
    const difference = this.getNormalizedSymbols()

    let pairDataPromises: Promise<void>[] = []

    await Binance.getPairs().then(pairInfo => {
      this.pairsInfo = pairInfo.filter(pair => this.user.symbols.includes(pair.baseAsset) && this.user.symbols.includes(pair.quoteAsset))

      this.pairsInfo.forEach(pair => {
        this.entity.pairs.push(pair.symbol)
        pairDataPromises.push(PairWeightsEntityV1.find({ where: { pairName: pair.symbol } })
        .then((pairData: PairWeightsEntityV1[]) => {
          this.pairData[pair.symbol] = {
            a: pairData[0].weights,
            s: 0.5,
            o: 0.5
          }
        }))
      })

      /* overwriting to remove irrelevant pairs */
      this.prevPairData = this.pairsInfo.reduce((acc, pair) => {
        acc[pair.symbol] = this.prevPairData[pair.symbol]
        return acc
      }, {})

    })

    await Promise.all(pairDataPromises)

    const pairDataWeightsPromises: Promise<PairData>[] = this.pairsInfo.map(pair => {
      if (this.prevPairData[pair.symbol]) {
        /*
        * Put scores of prevData with PairData Weights
        */

        let pairDataMutable: PairData = this.pairData[pair.symbol]
        const prevPairData: PairData = this.prevPairData[pair.symbol]

        // get prevOptimalScore
        return MLTrainer.getPrevOptimalScorePromise(pair.symbol, Binance)
        .then(prevOptimalScore => {
          pairDataMutable.o = prevOptimalScore

          Analysis.intervalList.forEach(interval => {

            let techAnalysisWeightsMutable = pairDataMutable.a[interval].a.tech.a
            const techAnalysisScore = prevPairData.a[interval].a.tech.a

            MLTrainer.setMovingAveragesWeights(
              techAnalysisWeightsMutable.moveBack.a,
              techAnalysisScore.moveBack.a,
              prevOptimalScore,
              techAnalysisWeightsMutable
            )

            MLTrainer.setPriceChangeWeights(
              techAnalysisWeightsMutable,
              techAnalysisScore,
              prevOptimalScore
            )

            MLTrainer.setOscillatorWeights(
              techAnalysisWeightsMutable.oscillators.a,
              techAnalysisScore.oscillators.a,
              prevOptimalScore,
              techAnalysisWeightsMutable
            )

            MLTrainer.setCandleSticksWeights(
              techAnalysisWeightsMutable.candlesticks.a,
              techAnalysisScore.candlesticks.a,
              prevOptimalScore,
              techAnalysisWeightsMutable
            )

          })

          MLTrainer.setIntervalWeightsAndPairScore(
            pairDataMutable,
            prevOptimalScore,
            pairDataMutable.a
          )

          PairWeightsEntityV1.find({ where: { pairName: pair.symbol } })
          .then((result: PairWeightsEntityV1[]): PairWeightsEntityV1 => result[0])
          .then(pairEntity => {
            pairEntity.weights = pairDataMutable.a
            pairEntity.save().catch(console.error)
          })
          .catch(console.error)

          return pairDataMutable

        })
      } else {
        return Promise.resolve(this.pairData[pair.symbol])
      }
    })

    await Promise.all(pairDataWeightsPromises)
    .then(pairDataWeights => {
      this.pairsInfo.forEach((pair, idx) => {
        this.pairData[pair.symbol] = pairDataWeights[idx]
      })
    })

    const pricesPromises = Promise.all(this.pairsInfo.map(pair => Binance.getAvgPrice(pair.symbol).then(price => {
      this.prices[pair.symbol] = price
    })))

    const balancePromise = Binance.getAccountBalances(this.user.id)
    const btcUsdtPricePromise = Binance.getAvgPrice('BTCUSDT')

    const pricesBtcNames: string[] = this.user.symbols.filter(symbol => !['BTC', 'USDT'].includes(symbol)).map(symbol => `${symbol}BTC`)
    const prisesBtcPromise = Promise.all(pricesBtcNames.map(pair => Binance.getAvgPrice(pair)))

    this.analysis = new Analysis({
      getNormalizedSymbols: this.getNormalizedSymbols,
      pairsInfo: this.pairsInfo,
      pairData: this.pairData
    })

    const analysisPromise = this.analysis.run(logger, Binance)

    await Promise.all([btcUsdtPricePromise, prisesBtcPromise, balancePromise])
    .then(([btcUsdtPrice, pricesBtc, balances]) => {
      this.prices['BTCUSDT'] = btcUsdtPrice
      this.prices['USDTBTC'] = 1 / btcUsdtPrice

      for (let i = 0, len = pricesBtc.length; i < len; i++)
        this.prices[pricesBtcNames[i]] = pricesBtc[i]

      for (let i = 0, len = balances.length; i < len; i++) {
        const balance = balances[i]
        const amount = parseFloat(balance.free)
        if (amount > 0 && this.user.symbols.includes(balance.asset)) {
          this.balance[balance.asset] += amount
          balanceBtc[balance.asset] += amount * this.prices[`${balance.asset}BTC`]
          dollarBalance[balance.asset] += balanceBtc[balance.asset] * this.prices['BTCUSDT']
          this.balanceTotalBtc += balanceBtc[balance.asset]
        }
      }
    })

    this.entity.balanceSymbols = this.balance

    logger.startLog({
      btc: this.balanceTotalBtc,
      dollar: this.balanceTotalBtc * this.prices['BTCUSDT'],
      btcPrice: this.prices['BTCUSDT']
    })
    logger.addSymbolPie({ name: '$ Balance', values: dollarBalance })

    const dropPair = (pair: DroppedPair): boolean => {
      logger.droppedPair(pair)
      this.droppedPairs.push(pair)
      return false
    }

    const addToFinalPairs = (pair: Trade) => {
      pair.dollarValue = pair.baseAmount * this.prices[`${pair.baseSymbol}BTC`] * this.prices['BTCUSDT']
      pair.feeDollar = pair.dollarValue * 0.0075
// HERE HERE HERE HERE
// HERE HERE HERE HERE
      this.tradePromises.push(Binance.newOrder/*Test*/(this.user, pair.feeDollar, {
// HERE HERE HERE HERE
// HERE HERE HERE HERE
          symbol: pair.pair,
          side: pair.side,
          quantity: pair.baseAmount.toString(),
          type: 'MARKET'
        }).then((result: SavedOrder) => {
          pair.success = !!result.orderId
          logger.addTrade(pair)
          this.savedOrders.push(result)
          this.trades.push(pair)
        })
      )
    }

    this.negotiationTable = new NegotiationTable({
      dropPair,
      addToFinalPairs
    })

    const collectorSymbols: string[] = []
    const providerSymbols: string[] = []

    const dollarSymbolPie: { [symbol: string]: number } = this.getNormalizedSymbols()
    const dollarDifference: { [symbol: string]: number } = this.getNormalizedSymbols()

    const balancePerc = this.getNormalizedSymbols()
    const diffPerc = this.getNormalizedSymbols()
    const symPieBtc = this.getNormalizedSymbols()

    await analysisPromise

    /**
     * START HANDLING ANALYSIS
     */

    this.entity.symbolPie = this.analysis.symbolPie
    this.entity.analysisTechPairs = this.analysis.techPairScore
    this.entity.prevOptimalScorePair = this.pairsInfo.reduce((acc, pair) => {
      acc[pair.symbol] = this.pairData[pair.symbol].o
      return acc
    }, {})
    this.entity.markets = this.analysis.marketSymbols
    this.entity.analysisMarket = this.analysis.marketSymbols.reduce((acc, market) => {
      acc[market] = this.analysis.marketScore[market].battleScore
      return acc
    }, {})

    for (let i = 0, len = this.user.symbols.length; i < len; i++) {
      const symbol = this.user.symbols[i]
      symPieBtc[symbol] += this.analysis.symbolPie[symbol] * this.balanceTotalBtc
      balancePerc[symbol] += (balanceBtc[symbol] / this.balanceTotalBtc)
      diffPerc[symbol] += balancePerc[symbol] - this.analysis.symbolPie[symbol]
      differenceBtc[symbol] += balanceBtc[symbol] - symPieBtc[symbol]
      difference[symbol] += differenceBtc[symbol] / this.prices[`${symbol}BTC`]
      dollarSymbolPie[symbol] += this.analysis.symbolPie[symbol] * this.balanceTotalBtc * this.prices['BTCUSDT']
      dollarDifference[symbol] += dollarBalance[symbol] - dollarSymbolPie[symbol]

      if (differenceBtc[symbol] > 0) {
        providerSymbols.push(symbol)
        this.negotiationTable.addProvider({
          providerSymbol: symbol,
          spendableBtc: differenceBtc[symbol],
          spendable: difference[symbol],
          totalSpendableBtc: balanceBtc[symbol],
          totalSpendable: this.balance[symbol],
          logger: symbol
        })
      } else if (differenceBtc[symbol] < 0) {
        collectorSymbols.push(symbol)
        this.negotiationTable.addCollector({
          collectorSymbol: symbol,
          demandBtc: -differenceBtc[symbol],
          demand: -difference[symbol],
          logger: symbol
        })
      }
    }

    logger.addSymbolPie({ name: '$ SymbolPie', values: dollarSymbolPie })
    logger.addSymbolPie({ name: '$ Diff', values: dollarDifference })
    logger.symbolPie()
    logger.startDroppedPairs()

    for (let i = 0, len = collectorSymbols.length; i < len; i++) {
      const collectorSymbol = collectorSymbols[i]
      for (let j = 0, jen = this.analysis.pairsPerSymbol[collectorSymbol].length; j < jen; j++) {
        const pair = this.analysis.pairsPerSymbol[collectorSymbol][j]
        const providerSymbol = pair.baseAsset === collectorSymbol ? pair.quoteAsset : pair.baseAsset
        if (!providerSymbols.includes(providerSymbol)) continue
        const candidatePair: CandidatePair = {
          pair: pair.symbol,
          side: pair.baseAsset === collectorSymbol ? 'BUY' : 'SELL',
          provider: providerSymbol,
          collector: collectorSymbol,
          score: this.analysis.techPairScore[pair.symbol]
        }
        const assignedPair: AssignedPair = this.analysis.assignedPair[pair.symbol]
        const price = Binance.getAvgPrice(pair.symbol)
        if (assignedPair.collector !== collectorSymbol) {
          dropPair({ ...candidatePair, dropCode: 1 } as DroppedPair)
          continue
        }
        candidatePair.collectorScore = this.analysis.marketSymbolScore[collectorSymbol]
        const { minQty: minBase, stepSize }: any = pair.filters.filter(fil => fil.filterType === 'LOT_SIZE')[0]
        const { minNotional: minQuote }: any = pair.filters.filter(fil => fil.filterType === 'MIN_NOTIONAL')[0]
        candidatePair.minBase = parseFloat(minBase)
        candidatePair.minQuote = parseFloat(minQuote)
        const collectorAmount = this.negotiationTable.collectorAmount[collectorSymbol]
        const providerFunds = this.negotiationTable.providerFunds[providerSymbol]
        if (candidatePair.side === 'BUY') {
          if (collectorAmount < minBase) {
            dropPair({ ...candidatePair, collectorAmount, dropCode: 2 } as DroppedPair)
            continue
          }
          if (providerFunds < minQuote) {
            dropPair({ ...candidatePair, providerFunds, dropCode: 3 } as DroppedPair)
            continue
          }
        } else {
          if (providerFunds < minBase) {
            dropPair({ ...candidatePair, providerFunds, dropCode: 4 } as DroppedPair)
            continue
          }
          if (collectorAmount < minQuote) {
            dropPair({ ...candidatePair, collectorAmount, dropCode: 5 } as DroppedPair)
            continue
          }
        }
        candidatePair.baseSymbol = pair.baseAsset
        candidatePair.stepSize = parseFloat(stepSize)
        candidatePair.price = await price
        this.negotiationTable.addCandidatePair(candidatePair as ParticipantPair)
        this.prices[candidatePair.pair] = candidatePair.price
      }

      /* todo: HIER MOET NOG IETS, WANNEER EEN COLLECTOR GEEN PAIR HEEFT */

    }

    this.negotiationTable.run()
    await Promise.all(this.tradePromises)

    this.entity.droppedPairs = this.droppedPairs
    this.entity.tradePairs = this.trades as TradePairEntity[]

    if (this.trades.length > 0) logger.trades()

    const newDollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()
    let newTotalBtc = 0

    await Binance.getAccountBalances(this.user.id).then(balances => {
      for (let i = 0, len = balances.length; i < len; i++) {
        const balance = balances[i]
        const amount = parseFloat(balance.free)
        if (amount > 0 && this.user.symbols.includes(balance.asset)) {
          const amountBtc = amount * this.prices[`${balance.asset}BTC`]
          newTotalBtc += amountBtc
          newDollarBalance[balance.asset] += amountBtc * this.prices['BTCUSDT']
          this.balancePostTrade[balance.asset] = amount
        }
      }
    })

    this.entity.balancePostTradeSymbols = this.balancePostTrade

    this.dollarDiff = (newTotalBtc * this.prices['BTCUSDT']) - (this.balanceTotalBtc * this.prices['BTCUSDT'])

    await pricesPromises

    this.entity.pricesPairs = this.prices

    logger.endLog({
      oldDollarBalance: dollarBalance,
      newDollarBalance: newDollarBalance,
      btc: newTotalBtc,
      dollar: newTotalBtc * this.prices['BTCUSDT'],
      dollarDiff: this.dollarDiff,
      tradeTime: Date.now() - start
    })

    this.entity.tradeTime = new Date()
    this.entity.dollarDiffPostTrade = this.dollarDiff
    const savedEntity = await this.entity.save()

    Promise.all(this.savedOrders.map(order => {
      order.tradeBotEntity = savedEntity
      order.save().catch(console.error)
    })).catch(console.error)

    return {
      pairData: this.pairData,
      pairs: this.pairsInfo
    }

  }

}

export default TradeBot