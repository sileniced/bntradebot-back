import User from '../entities/User'
import { Binance } from '../index'
import { NewOrder, OrderSide, Symbol } from 'binance-api-node'
import NegotiationTable, { Collector, ParticipatingPair, Provider } from './NegotiationTable'
import SavedOrder from '../entities/SavedOrder'
import Analysis from './Analysis'
import { TestOrderResult } from './Binance'

interface CandidatePair {
  pair: string,
  side: OrderSide,
  provider: Provider,
  collector: Collector,
  minBase: number,
  minQuote: number,
  stepSize: number,
}

interface DroppedPair {
  pair: string,
  price?: number,
  side: OrderSide,
  provider: Provider,
  collector: Collector,
  pairScore?: number
  minBase: number,
  minQuote: number,
  stepSize?: number,
  reason: string
  providerFundsBtc?: number,
  collectorAmountBtc?: number
  baseAmount?: number
  quoteAmount?: number
}

function parseStepSize(qty: any, stepSize: number = 0.00000001) {
  if (typeof qty !== 'number') return qty
  return Math.floor(qty / stepSize) / (1 / stepSize)
}

const generateTable = (name: string, object) => {
  // console.log(object)
  const denormalized = Object.entries(object)
  if (denormalized.length === 0) return

  console.log(Object.keys(denormalized[0][1]).reduce((acc, key, idx) => {
    return acc + ` `.repeat(((idx + 1) * 20) - acc.length > 0 ? ((idx + 1) * 20) - acc.length : 0) + key
  }, name))

  denormalized.forEach(([title, row]: [any, any]) => {
    console.log(Object.values(row).reduce((acc, value, idx) => {
      return acc + ` `.repeat(((idx + 1) * 20) - acc.length > 0 ? ((idx + 1) * 20) - acc.length : 0) + parseStepSize(value)
    }, title))
  })
  console.log('')
}

class TradeBot {


  // todo: get from user database ('USDT' required)
  readonly symbols = ['USDT', 'BTC', 'ETH', 'BNB', 'EOS', 'NEO']
  protected readonly getNormalizedSymbols = (): { [symbol: string]: number } => this.symbols.reduce((acc, s) => {
    acc[s] = 0
    return acc
  }, {})
  protected pairsInfo: Symbol[] = []

  protected readonly user: User

  private prices: { [pair: string]: number } = { ['BTCBTC']: 1 }

  private userTotalBtc: number = 0
  private userBalance: { [symbol: string]: number } = {}
  private userBalanceBtc: { [symbol: string]: number } = {}
  private userBalancePercentage: { [symbol: string]: number } = {}

  private analysis: Analysis

  private differencePercentage: { [symbol: string]: number } = {}
  private differenceBtc: { [symbol: string]: number } = {}
  private difference: { [symbol: string]: number } = {}

  private providers: { [symbol: string]: Provider } = {}
  private collectors: { [symbol: string]: Collector } = {}

  private candidatePairs: CandidatePair[] = []
  private DroppedPairs: { [pair: string]: DroppedPair } = {}

  private participatingPairs: ParticipatingPair[] = []
  private negotiationTable: NegotiationTable

  private finalPairs: { order: NewOrder, feeDollars: number }[] = []
  private orderResult: SavedOrder[] = []
  private orderResultTest: TestOrderResult[] = []

  constructor(user: User) {

    this.user = user

    this.userBalance = this.getNormalizedSymbols()
    this.userBalanceBtc = this.getNormalizedSymbols()
    this.userBalancePercentage = this.getNormalizedSymbols()
    this.differencePercentage = this.getNormalizedSymbols()
    this.differenceBtc = this.getNormalizedSymbols()
    this.difference = this.getNormalizedSymbols()

    this.symbols.forEach(symbol => {
      this.userBalancePercentage[symbol] = 0
    })
  }

  public dropPair = (pair: CandidatePair | ParticipatingPair, reason: string, pairScore?: number): boolean => {
    this.DroppedPairs[pair.pair] = {
      ...pair,
      reason
    }
    if (pairScore) this.DroppedPairs[pair.pair].pairScore = pairScore
    return false
  }

  public addToFinalPairs = (order: NewOrder, btcValue: number) => {
    this.finalPairs.push({
      order,
      feeDollars: btcValue * 0.0075 * this.prices['BTCUSDT']
    })
  }

  public async run() {
    const start = Date.now()

    await Binance.getPairs().then(pairInfo => {
      this.pairsInfo = pairInfo.filter(pair => this.symbols.includes(pair.baseAsset) && this.symbols.includes(pair.quoteAsset))
    })

    this.analysis = new Analysis({ pairsInfo: this.pairsInfo, getNormalizedSymbols: this.getNormalizedSymbols })
    const analysisPromise = this.analysis.run()

    // this.symbolAnalysis = SymbolAnalysis(this.symbols, this.pairsInfo)

    this.prices['BTCUSDT'] = await Binance.getAvgPrice('BTCUSDT')
    this.prices['USDTBTC'] = 1 / this.prices['BTCUSDT']

    const avgPricesBtcNames: string[] = this.symbols.filter(symbol => !['BTC', 'USDT'].includes(symbol)).map(symbol => `${symbol}BTC`)
    await Promise.all(avgPricesBtcNames.map(pair => Binance.getAvgPrice(pair)))
    .then(avgPricesBtc => {
      avgPricesBtcNames.forEach((pair, idx) => {
        this.prices[pair] = avgPricesBtc[idx]
      })
    })

    const userBalanceSymbols: string[] = []
    const dollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()

    await Binance.getAccountBalances(this.user.id)
    .then(balances => {
      balances.forEach(balance => {
        const amount = parseFloat(balance.free)
        if (amount > 0 && this.symbols.includes(balance.asset)) {
          userBalanceSymbols.push(balance.asset)
          const amountBtc = amount * this.prices[`${balance.asset}BTC`]
          dollarBalance[balance.asset] += amountBtc * this.prices['BTCUSDT']
          this.userTotalBtc += amountBtc
          this.userBalance[balance.asset] += amount
          this.userBalanceBtc[balance.asset] += amountBtc
        }
      })
    })

    console.log(
      `${'= '.repeat(30)}
    time: ${new Date()}
    BTC ${parseStepSize(this.userTotalBtc)} - USD ${parseStepSize(this.userTotalBtc * this.prices['BTCUSDT'])}
`
    )

    userBalanceSymbols.forEach(symbol => {
      this.userBalancePercentage[symbol] += this.userBalanceBtc[symbol] / this.userTotalBtc
    })

    const providerSymbols: string[] = []
    const collectorSymbols: string[] = []

    const dollarSymbolPie: { [symbol: string]: number } = this.getNormalizedSymbols()
    const dollarDifference: { [symbol: string]: number } = this.getNormalizedSymbols()

    await analysisPromise

    generateTable('Market Analysis', this.analysis.marketAnalysis)
    // console.log('Market Analysis')
    // console.table(Object.entries(this.analysis.marketAnalysis).reduce((acc, [title, pie]) => {
    //   acc[title] = Object.entries(pie).reduce((acc, [symbol, amount]) => {
    //     acc[symbol] = parseStepSize(amount)
    //     return acc
    //   }, {})
    //   return acc
    // }, {}))


    this.symbols.forEach(symbol => {
      this.differencePercentage[symbol] += this.analysis.symbolPie[symbol] - this.userBalancePercentage[symbol]
      this.differenceBtc[symbol] += this.differencePercentage[symbol] * this.userTotalBtc
      this.difference[symbol] += this.differenceBtc[symbol] / this.prices[`${symbol}BTC`]
      dollarSymbolPie[symbol] += this.analysis.symbolPie[symbol] * this.userTotalBtc * this.prices['BTCUSDT']
      dollarDifference[symbol] += this.differenceBtc[symbol] * this.prices['BTCUSDT']

      if (this.differencePercentage[symbol] < 0) {
        providerSymbols.push(symbol)
        this.providers[symbol] = {
          providerSymbol: symbol,
          spendableBtc: -this.differenceBtc[symbol],
          spendable: -this.difference[symbol],
          totalSpendableBtc: -this.userBalanceBtc[symbol],
          totalSpendable: -this.userBalance[symbol]
        }
      } else if (this.differencePercentage[symbol] > 0) {
        collectorSymbols.push(symbol)
        this.collectors[symbol] = {
          collectorSymbol: symbol,
          demandBtc: this.differenceBtc[symbol],
          demand: this.difference[symbol]
        }
      }
    })

    generateTable('SymbolPie', {
      // ['% balance']: this.userBalancePercentage,
      // ['% symbol pie']: this.analysis.symbolPie,
      // ['% difference']: this.differencePercentage,
      ['$ balance']: dollarBalance,
      ['$ symbol pie']: dollarSymbolPie,
      ['$ difference']: dollarDifference
    })
    // console.log('SymbolPie:')
    // console.table(Object.entries({
    //   ['% balance']: this.userBalancePercentage,
    //   ['% symbol pie']: this.analysis.symbolPie,
    //   ['% difference']: this.differencePercentage,
    //   ['$ balance']: dollarBalance,
    //   ['$ symbol pie']: dollarSymbolPie,
    //   ['$ difference']: dollarDifference
    // }).reduce((acc, [title, pie]) => {
    //   acc[title] = Object.entries(pie).reduce((acc, [symbol, amount]) => {
    //     acc[symbol] = parseStepSize(amount)
    //     return acc
    //   }, {})
    //   return acc
    // }, {}))

    // generateTable('Providers', this.providers)
    // console.log('Providers:')
    // console.table(Object.entries(this.providers).reduce((acc, [title, pie]) => {
    //   acc[title] = Object.entries(pie).reduce((acc, [symbol, amount]) => {
    //     acc[symbol] = typeof amount === 'number' ? parseStepSize(amount) : amount
    //     return acc
    //   }, {})
    //   return acc
    // }, {}))

    // generateTable('Collectors', this.collectors)
    // console.log('Collectors:')
    // console.table(Object.entries(this.collectors).reduce((acc, [title, pie]) => {
    //   acc[title] = Object.entries(pie).reduce((acc, [symbol, amount]) => {
    //     acc[symbol] = typeof amount === 'number' ? parseStepSize(amount) : amount
    //     return acc
    //   }, {})
    //   return acc
    // }, {}))

    this.pairsInfo.forEach(pairInfo => {
      if (
        (collectorSymbols.includes(pairInfo.baseAsset) && providerSymbols.includes(pairInfo.quoteAsset))
        || (providerSymbols.includes(pairInfo.baseAsset) && collectorSymbols.includes(pairInfo.quoteAsset))
      ) {
        const lotSize: any = pairInfo.filters.filter(fil => fil.filterType === 'LOT_SIZE')[0]
        const minNotational: any = pairInfo.filters.filter(fil => fil.filterType === 'MIN_NOTIONAL')[0]

        const buySide: boolean = collectorSymbols.includes(pairInfo.baseAsset)
        this.candidatePairs.push({
          pair: pairInfo.symbol,
          side: buySide ? 'BUY' : 'SELL',
          provider: this.providers[buySide ? pairInfo.quoteAsset : pairInfo.baseAsset],
          collector: this.collectors[buySide ? pairInfo.baseAsset : pairInfo.quoteAsset],
          stepSize: parseFloat(lotSize.stepSize),
          minBase: parseFloat(lotSize.stepSize),
          minQuote: parseFloat(minNotational.minNotional)
        })
      }
    })

    this.candidatePairs = this.candidatePairs.filter(candidatePair => {
      if (candidatePair.side === 'BUY') {
        if (candidatePair.collector.demand < candidatePair.minBase) {
          return this.dropPair(candidatePair, 'collector<minBase')
        }
        if (candidatePair.provider.spendable < candidatePair.minQuote) {
          return this.dropPair(candidatePair, 'provider<minQuote')
        }
        if (this.analysis.pairAnalysis[candidatePair.pair].base.score === 0) {
          return this.dropPair(candidatePair, 'score=0', this.analysis.pairAnalysis[candidatePair.pair]._pairScore)
        }
      } else {
        if (candidatePair.provider.spendable < candidatePair.minBase) {
          return this.dropPair(candidatePair, 'provider<minBase')
        }
        if (candidatePair.collector.demand < candidatePair.minQuote) {
          return this.dropPair(candidatePair, 'collector<minQuote')
        }
        if (this.analysis.pairAnalysis[candidatePair.pair].quote.score === 0) {
          return this.dropPair(candidatePair, 'score=0', this.analysis.pairAnalysis[candidatePair.pair]._pairScore)
        }
      }
      return true
    })

    const pricesParticipatingPairsNames = this.candidatePairs.map(pair => pair.pair)
    await Promise.all(pricesParticipatingPairsNames.map(pair => Binance.getAvgPrice(pair)))
    .then(pricesParticipatingPairs => {
      pricesParticipatingPairsNames.forEach((pair, idx) => {
        this.prices[pair] = pricesParticipatingPairs[idx]
      })
    })

    this.participatingPairs = this.candidatePairs.map(candidatePair => ({
      ...candidatePair,
      collectorScore: candidatePair.side === 'BUY'
        ? this.analysis.pairAnalysis[candidatePair.pair].base.score
        : this.analysis.pairAnalysis[candidatePair.pair].quote.score,
      price: this.prices[candidatePair.pair]
    })).sort((a, b) => b.collectorScore - a.collectorScore)

    // generateTable('Participating Pairs', this.participatingPairs.map(pair => ({ ...pair, ...pair.provider, ...pair.collector })).reduce((acc, pair) => {
    //   acc[pair.pair] = pair
    //   return acc
    // }, {}))
    // console.log('Participating Pairs:')
    // console.table(this.participatingPairs.map(pair => ({ ...pair, ...pair.provider, ...pair.collector })))

    this.negotiationTable = new NegotiationTable({
      participatingPairs: this.participatingPairs,
      providers: Object.values(this.providers),
      collectors: Object.values(this.collectors),
      dropPair: this.dropPair,
      addToFinalPairs: this.addToFinalPairs
    })

    await this.negotiationTable.run()

    generateTable('Dropped Pairs', Object.values(this.DroppedPairs).map((pair): any => ({
      pair: pair.pair,
      side: pair.side,
      reason: pair.reason
      // minBase: pair.minBase,
      // baseAmount: parseStepSize(pair.baseAmount),
      // minQuote: pair.minQuote,
      // quoteAmount: parseStepSize(pair.quoteAmount),
      // provider: pair.provider.providerSymbol,
      // fundsBtc: parseStepSize(pair.providerFundsBtc),
      // spendableBtc: parseStepSize(pair.provider.spendableBtc),
      // spendable: parseStepSize(pair.provider.spendable),
      // collector: pair.collector.collectorSymbol,
      // amountBtc: parseStepSize(pair.collectorAmountBtc),
      // demandBtc: parseStepSize(pair.collector.demandBtc),
      // demand: parseStepSize(pair.collector.demand)
    })).reduce((acc, pair) => {
      acc[pair.pair] = pair
      return acc
    }, {}))
    // console.log('Dropped Pairs:')
    console.table(Object.values(this.DroppedPairs).map((pair): any => ({
      pair: pair.pair,
      side: pair.side,
      reason: pair.reason,
      minBase: pair.minBase,
      baseAmount: parseStepSize(pair.baseAmount),
      minQuote: pair.minQuote,
      quoteAmount: parseStepSize(pair.quoteAmount),
      provider: pair.provider.providerSymbol,
      fundsBtc: parseStepSize(pair.providerFundsBtc),
      spendableBtc: parseStepSize(pair.provider.spendableBtc),
      spendable: parseStepSize(pair.provider.spendable),
      collector: pair.collector.collectorSymbol,
      amountBtc: parseStepSize(pair.collectorAmountBtc),
      demandBtc: parseStepSize(pair.collector.demandBtc),
      demand: parseStepSize(pair.collector.demand)
    })))

    let newBtcTotal: number = 0

    if (this.finalPairs.length > 0) {
      generateTable('Final Pairs', this.finalPairs.map(pair => ({
        ...pair.order,
        feeDollars: parseStepSize(pair.feeDollars)
      })).reduce((acc, pair) => {
        acc[pair.symbol] = pair
        return acc
      }, {}))
      // console.log('Final Pairs:')
      // console.table(this.finalPairs.map(pair => ({ ...pair.order, feeDollars: parseStepSize(pair.feeDollars)})))

      await Promise.all(this.finalPairs.map((order, idx) => {
        return new Promise(resolve => setTimeout(() => {
          resolve(Binance.newOrder(this.user, order.feeDollars, order.order))
        }, Math.floor((idx - 1) / 10) * 1000))
        .then((result: SavedOrder) => {
          this.orderResult.push(result)
        })
      }))
      // await Promise.all(this.finalPairs.map((order, idx) => {
      //   return new Promise(resolve => setTimeout(() => {
      //     resolve(Binance.newOrderTest(this.user, order.feeDollars, order.order))
      //   }, Math.floor((idx - 1) / 10) * 1000))
      //   .then((result: TestOrderResult) => {
      //     this.orderResultTest.push(result)
      //   })
      // }))


      generateTable('Order Result', (this.orderResult.length > 0 ? this.orderResult : this.orderResultTest).reduce((acc, pair) => {
        acc[pair.pair] = pair
        return acc
      }, {}))
      // console.log('Order Result:')
      // console.table(this.orderResult)

      const newDollarBalance: { [symbol: string]: number } = this.getNormalizedSymbols()

      await Binance.getAccountBalances(this.user.id).then(balances => {
        balances.forEach(balance => {
          const amount = parseFloat(balance.free)
          if (amount > 0 && this.symbols.includes(balance.asset)) {
            const amountBtc = amount * this.prices[`${balance.asset}BTC`]
            newBtcTotal += amountBtc
            newDollarBalance[balance.asset] += amountBtc * this.prices['BTCUSDT']
          }
        })
      })

      generateTable('New Dollar Balance', {
        ['$ old balance']: dollarBalance,
        ['$ new balance']: newDollarBalance
      })
      // console.log('New Dollar Balance: ')
      // console.table(Object.entries({
      //   ['$ old balance']: dollarBalance,
      //   ['$ new balance']: newDollarBalance
      // }).reduce((acc, [title, pie]) => {
      //   acc[title] = Object.entries(pie).reduce((acc, [symbol, amount]) => {
      //     acc[symbol] = parseStepSize(amount)
      //     return acc
      //   }, {})
      //   return acc
      // }, {}))

    }

    console.log(
      `    time: ${Date.now() - start}ms
    BTC ${parseStepSize(this.userTotalBtc)} - USD ${parseStepSize((newBtcTotal || this.userTotalBtc) * this.prices['BTCUSDT'])}
${'= '.repeat(30)}`
    )

  }

}

export default TradeBot