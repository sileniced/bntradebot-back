import User from '../../entities/User'
import { Binance } from '../../index'
import { OrderSide, Symbol } from 'binance-api-node'
import NegotiationTable, { Collector, ParticipantPair, Provider } from './NegotiationTable'
import Analysis, { AssignedPair } from '../Analysis'
// import { TestOrderResult } from '../Binance'
import Logger from '../Logger'

export interface FinalPair extends ParticipantPair {
  baseAmount: number
  baseSymbol: string
  feeDollar?: number
  success?: boolean
}

export interface CandidatePair extends AssignedPair {
  collectorScore?: number,
  minBase?: number,
  minQuote?: number,
  stepSize?: number,
  price?: number,
  baseSymbol?: string
}

interface DroppedPair {
  pair: string,
  price?: number,
  side: OrderSide,
  provider: Provider | string,
  collector: Collector | string,
  pairScore?: number
  minBase?: number,
  minQuote?: number,
  stepSize?: number,
  dropCode: number,
  providerFundsBtc?: number,
  collectorAmountBtc?: number
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

  private DroppedPairs: { [pair: string]: DroppedPair } = {}

  private negotiationTable: NegotiationTable

  private finalPairs: FinalPair[] = []
  // private orderResult: SavedOrder[] = []
  // private orderResultTest: TestOrderResult[] = []

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
    const logger = new Logger()

    await Binance.getPairs().then(pairInfo => {
      this.pairsInfo = pairInfo.filter(pair => this.symbols.includes(pair.baseAsset) && this.symbols.includes(pair.quoteAsset))
    })

    this.analysis = new Analysis({ pairsInfo: this.pairsInfo, getNormalizedSymbols: this.getNormalizedSymbols })
    const analysisPromise = this.analysis.run(logger)

    this.prices['BTCUSDT'] = await Binance.getAvgPrice('BTCUSDT')
    this.prices['USDTBTC'] = 1 / this.prices['BTCUSDT']

    const avgPricesBtcNames: string[] = this.symbols.filter(symbol => !['BTC', 'USDT'].includes(symbol)).map(symbol => `${symbol}BTC`)
    await Promise.all(avgPricesBtcNames.map(pair => Binance.getAvgPrice(pair)))
    .then(avgPricesBtc => {
      for (let i = 0, len = avgPricesBtc.length; i < len; i++)
        this.prices[avgPricesBtcNames[i]] = avgPricesBtc[i]
    })

    const dollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()

    await Binance.getAccountBalances(this.user.id)
    .then(balances => {
      for (let i = 0, len = balances.length; i < len; i++) {
        const balance = balances[i]
        const amount = parseFloat(balance.free)
        if (amount > 0 && this.symbols.includes(balance.asset)) {
          this.balanceBtc[balance.asset] += amount * this.prices[`${balance.asset}BTC`]
          dollarBalance[balance.asset] += this.balanceBtc[balance.asset] * this.prices['BTCUSDT']
          this.balanceTotalBtc += this.balanceBtc[balance.asset]
          this.balance[balance.asset] += amount
          this.balanceBtc[balance.asset] += this.balanceBtc[balance.asset]
        }
      }
    })

    logger.addSymbolPie({ name: '$ Balance', values: dollarBalance })

    const dropPair = (pair: CandidatePair | ParticipantPair | AssignedPair, dropCode: number): boolean => {
      this.DroppedPairs[pair.pair] = {
        ...pair,
        dropCode
      }
      return false
    }

    this.negotiationTable = new NegotiationTable({
      dropPair,
      addToFinalPairs: (pair: FinalPair) => {
        pair.feeDollar = pair.baseAmount * this.prices[`${pair.baseSymbol}BTC`] * this.prices['BTCUSDT']
        console.log(pair.baseAmount.toString())
        Binance.newOrderTest(this.user, pair.feeDollar, {
          symbol: pair.pair,
          side: pair.side,
          quantity: pair.baseAmount.toString(),
          type: 'MARKET'
        }).then(result => {
          pair.success = !!result
          this.finalPairs.push(pair)
        })
      }
    })

    const collectorSymbols: string[] = []
    const providerSymbols: string[] = []

    const dollarSymbolPie: { [symbol: string]: number } = this.getNormalizedSymbols()
    const dollarDifference: { [symbol: string]: number } = this.getNormalizedSymbols()

    const diffPerc = {}

    await analysisPromise

    for (let i = 0, len = this.symbols.length; i < len; i++) {
      const symbol = this.symbols[i]
      diffPerc[symbol] = this.analysis.symbolPie[symbol] - (this.balanceBtc[symbol] / this.balanceTotalBtc)
      this.differenceBtc[symbol] += diffPerc[symbol] * this.balanceTotalBtc
      this.difference[symbol] += this.differenceBtc[symbol] / this.prices[`${symbol}BTC`]
      dollarSymbolPie[symbol] += this.analysis.symbolPie[symbol] * this.balanceTotalBtc * this.prices['BTCUSDT']
      dollarDifference[symbol] += this.differenceBtc[symbol] * this.prices['BTCUSDT']

      if (this.differenceBtc[symbol] < 0) {
        providerSymbols.push(symbol)
        this.negotiationTable.addProvider({
          providerSymbol: symbol,
          spendableBtc: -this.differenceBtc[symbol],
          spendable: -this.difference[symbol],
          totalSpendableBtc: -this.balanceBtc[symbol],
          totalSpendable: -this.balance[symbol],
          logger: symbol
        })
      } else if (this.differenceBtc[symbol] > 0) {
        collectorSymbols.push(symbol)
        this.negotiationTable.addCollector({
          collectorSymbol: symbol,
          demandBtc: this.differenceBtc[symbol],
          demand: this.difference[symbol],
          logger: symbol
        })
      }
    }

    logger.addSymbolPie({ name: '$ SymbolPie', values: dollarSymbolPie })
    logger.addSymbolPie({ name: '$ Diff', values: dollarDifference })
    logger.symbolPie()

    for (let i = 0, len = collectorSymbols.length; i < len; i++) {
      const collectorSymbol = collectorSymbols[i]
      for (let j = 0, jen = this.analysis.pairsPerSymbol[collectorSymbol].length; j < jen; j++) {
        const pair = this.analysis.pairsPerSymbol[collectorSymbol][j]
        const providerSymbol = pair.baseAsset === collectorSymbol ? pair.quoteAsset : pair.baseAsset
        if (providerSymbols.includes(providerSymbol)) {
          const candidatePair: CandidatePair = this.analysis.assignedPair[pair.symbol]
          const price = Binance.getAvgPrice(pair.symbol)
          if (candidatePair.collector !== collectorSymbol) {
            dropPair(candidatePair, 1)
            continue
          }
          candidatePair.collectorScore = this.analysis.marketSymbolScore[collectorSymbol]
          const { minQty: minBase }: any = pair.filters.filter(fil => fil.filterType === 'LOT_SIZE')[0]
          const { minNotional: minQuote }: any = pair.filters.filter(fil => fil.filterType === 'MIN_NOTIONAL')[0]
          candidatePair.minBase = minBase
          candidatePair.minQuote = minQuote
          const collectorAmount = this.negotiationTable.collectorAmount[collectorSymbol]
          const providerFunds = this.negotiationTable.providerFunds[providerSymbol]
          if (candidatePair.side === 'BUY') {
            if (collectorAmount < minBase) {
              dropPair(candidatePair, 2)
              continue
            }
            if (providerFunds < minQuote) {
              dropPair(candidatePair, 3)
              continue
            }
          } else {
            if (providerFunds < minBase) {
              dropPair(candidatePair, 4)
              continue
            }
            if (collectorAmount < minQuote) {
              dropPair(candidatePair, 5)
              continue
            }
          }
          candidatePair.baseSymbol = pair.baseAsset
          candidatePair.price = await price
          this.negotiationTable.addCandidatePair(candidatePair as ParticipantPair)
          this.prices[candidatePair.pair] = candidatePair.price
        }
      }
    }

    await this.negotiationTable.run()

    if (this.finalPairs.length > 0) {

      // await Promise.all(this.finalPairs.map((order, idx) => {
      //   return new Promise(resolve => setTimeout(() => {
      //     resolve(Binance.newOrder(this.user, order.feeDollars, order.order))
      //   }, Math.floor((idx - 1) / 10) * 1000))
      //   .then((result: SavedOrder) => {
      //     this.orderResult.push(result)
      //   })
      // }))

      // await Promise.all(this.finalPairs.map((order, idx) => {
      //   return new Promise(resolve => setTimeout(() => {
      //     resolve(Binance.newOrderTest(this.user, order.feeDollars, order.order))
      //   }, Math.floor((idx - 1) / 10) * 1000))
      //   .then((result: TestOrderResult) => {
      //     this.orderResultTest.push(result)
      //   })
      // }))

      const newDollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()

      await Binance.getAccountBalances(this.user.id).then(balances => {
        balances.forEach(balance => {
          const amount = parseFloat(balance.free)
          if (amount > 0 && this.symbols.includes(balance.asset)) {
            const amountBtc = amount * this.prices[`${balance.asset}BTC`]
            newDollarBalance[balance.asset] += amountBtc * this.prices['BTCUSDT']
          }
        })
      })

    }
  }

}

export default TradeBot