import User from '../../entities/User'
import { Binance } from '../../index'
import { OrderSide, Symbol } from 'binance-api-node'
import NegotiationTable, { ParticipantPair } from './NegotiationTable'
import Analysis, { AssignedPair } from '../Analysis'
import Logger from '../Logger'

export interface FinalPair extends ParticipantPair {
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
  price?: number
  side: OrderSide
  provider: string
  collector: string
  pairScore?: number
  minBase?: number
  minQuote?: number
  stepSize?: number
  dropCode: number
  providerFundsBtc?: number
  collectorAmountBtc?: number
  providerFunds?: number
  collectorAmount?: number
  baseAmount?: number
  quoteAmount?: number
}

class TradeBot {

  // todo: get from user database ('USDT' required)
  readonly symbols = ['USDT', 'BTC', 'ETH', 'BNB', 'EOS', 'NEO']

  protected pairsInfo: Symbol[] = []

  protected readonly user: User

  private prices: { [pair: string]: number } = { ['BTCBTC']: 1 }

  private balance: { [symbol: string]: number } = {}
  private balanceBtc: { [symbol: string]: number } = {}
  private balanceTotalBtc: number = 0

  private analysis: Analysis

  private differenceBtc: { [symbol: string]: number } = {}
  private difference: { [symbol: string]: number } = {}

  // private DroppedPairs: { [pair: string]: DroppedPair } = {}

  private negotiationTable: NegotiationTable

  // private finalPairs: FinalPair[] = []
  // private orderResult: SavedOrder[] = []
  // private orderResultTest: TestOrderResult[] = []

  private trades: Promise<FinalPair>[] = []

  constructor(user: User) {

    this.user = user

    this.balance = this.getNormalizedSymbols()
    this.balanceBtc = this.getNormalizedSymbols()
    this.differenceBtc = this.getNormalizedSymbols()
    this.difference = this.getNormalizedSymbols()
  }

  protected readonly getNormalizedSymbols = (): { [symbol: string]: number } => {
    const obj = {}
    for (let i = 0, len = this.symbols.length; i < len; i++) obj[this.symbols[i]] = 0
    return obj
  }

  public async run() {
    const start = Date.now()
    const logger = new Logger()

    const balancePromise = Binance.getAccountBalances(this.user.id)
    const btcUsdtPricePromise = Binance.getAvgPrice('BTCUSDT')

    const pricesBtcNames: string[] = this.symbols.filter(symbol => !['BTC', 'USDT'].includes(symbol)).map(symbol => `${symbol}BTC`)
    const prisesBtcPromise = Promise.all(pricesBtcNames.map(pair => Binance.getAvgPrice(pair)))

    await Binance.getPairs().then(pairInfo => {
      this.pairsInfo = pairInfo.filter(pair => this.symbols.includes(pair.baseAsset) && this.symbols.includes(pair.quoteAsset))
    })

    this.analysis = new Analysis({ pairsInfo: this.pairsInfo, getNormalizedSymbols: this.getNormalizedSymbols })
    const analysisPromise = this.analysis.run(logger)

    const dollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()

    await Promise.all([btcUsdtPricePromise, prisesBtcPromise, balancePromise])
    .then(([btcUsdtPrice, pricesBtc, balances]) => {
      this.prices['BTCUSDT'] = btcUsdtPrice
      this.prices['USDTBTC'] = 1 / btcUsdtPrice

      for (let i = 0, len = pricesBtc.length; i < len; i++)
        this.prices[pricesBtcNames[i]] = pricesBtc[i]

      for (let i = 0, len = balances.length; i < len; i++) {
        const balance = balances[i]
        const amount = parseFloat(balance.free)
        if (amount > 0 && this.symbols.includes(balance.asset)) {
          this.balance[balance.asset] += amount
          this.balanceBtc[balance.asset] += amount * this.prices[`${balance.asset}BTC`]
          dollarBalance[balance.asset] += this.balanceBtc[balance.asset] * this.prices['BTCUSDT']
          this.balanceTotalBtc += this.balanceBtc[balance.asset]
        }
      }

    })

    logger.startLog({
      btc: this.balanceTotalBtc,
      dollar: this.balanceTotalBtc * this.prices['BTCUSDT'],
      btcPrice: this.prices['BTCUSDT']
    })
    logger.addSymbolPie({ name: '$ Balance', values: dollarBalance })

    const dropPair = (pair: DroppedPair): boolean => {
      logger.droppedPair(pair)
      // this.DroppedPairs[pair.pair] = { ...pair, dropCode }
      return false
    }

    this.negotiationTable = new NegotiationTable({
      dropPair,
      addToFinalPairs: (pair: FinalPair) => {
        pair.dollarValue = pair.baseAmount * this.prices[`${pair.baseSymbol}BTC`] * this.prices['BTCUSDT']
        pair.feeDollar = pair.dollarValue * 0.0075
        this.trades.push(Binance.newOrder(this.user, pair.feeDollar, {
            symbol: pair.pair,
            side: pair.side,
            quantity: pair.baseAmount.toString(),
            type: 'MARKET'
          }).then(result => {
            pair.success = !!result.orderId
            logger.addTrade(pair)
            return pair
          })
        )
      }
    })

    const collectorSymbols: string[] = []
    const providerSymbols: string[] = []

    const dollarSymbolPie: { [symbol: string]: number } = this.getNormalizedSymbols()
    const dollarDifference: { [symbol: string]: number } = this.getNormalizedSymbols()

    const balancePerc = this.getNormalizedSymbols()
    const diffPerc = this.getNormalizedSymbols()
    const symPieBtc = this.getNormalizedSymbols()

    await analysisPromise

    for (let i = 0, len = this.symbols.length; i < len; i++) {
      const symbol = this.symbols[i]
      symPieBtc[symbol] += this.analysis.symbolPie[symbol] * this.balanceTotalBtc
      balancePerc[symbol] += (this.balanceBtc[symbol] / this.balanceTotalBtc)
      diffPerc[symbol] += balancePerc[symbol] - this.analysis.symbolPie[symbol]
      this.differenceBtc[symbol] += this.balanceBtc[symbol] - symPieBtc[symbol]
      this.difference[symbol] += this.differenceBtc[symbol] / this.prices[`${symbol}BTC`]
      dollarSymbolPie[symbol] += this.analysis.symbolPie[symbol] * this.balanceTotalBtc * this.prices['BTCUSDT']
      dollarDifference[symbol] += dollarBalance[symbol] - dollarSymbolPie[symbol]

      if (this.differenceBtc[symbol] > 0) {
        providerSymbols.push(symbol)
        this.negotiationTable.addProvider({
          providerSymbol: symbol,
          spendableBtc: this.differenceBtc[symbol],
          spendable: this.difference[symbol],
          totalSpendableBtc: this.balanceBtc[symbol],
          totalSpendable: this.balance[symbol],
          logger: symbol
        })
      } else if (this.differenceBtc[symbol] < 0) {
        collectorSymbols.push(symbol)
        this.negotiationTable.addCollector({
          collectorSymbol: symbol,
          demandBtc: -this.differenceBtc[symbol],
          demand: -this.difference[symbol],
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
    await Promise.all(this.trades)

    if (logger.hasTrades()) logger.trades()

    const newDollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()
    let newTotalBtc = 0

    await Binance.getAccountBalances(this.user.id).then(balances => {
      for (let i = 0, len = balances.length; i < len; i++) {
        const balance = balances[i]
        const amount = parseFloat(balance.free)
        if (amount > 0 && this.symbols.includes(balance.asset)) {
          const amountBtc = amount * this.prices[`${balance.asset}BTC`]
          newTotalBtc += amountBtc
          newDollarBalance[balance.asset] += amountBtc * this.prices['BTCUSDT']
        }
      }
    })

    logger.endLog({
      oldDollarBalance: dollarBalance,
      newDollarBalance: newDollarBalance,
      btc: newTotalBtc,
      dollar: newTotalBtc * this.prices['BTCUSDT'],
      dollarDiff: (newTotalBtc * this.prices['BTCUSDT']) - (this.balanceTotalBtc * this.prices['BTCUSDT']),
      tradeTime: Date.now() - start
    })

  }

}

export default TradeBot