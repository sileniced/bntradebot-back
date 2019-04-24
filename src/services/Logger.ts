import { MarketAnalysisResult } from './Analysis'

function parseValue(value: any) {
  switch (typeof value) {
    case 'number':
      return value.toFixed(8)

    case 'object':
      return value.logger

    default:
      return value
  }

}

const logRow = (data: any[], title: string = '', len: number = 15): void => {
  console.log(data.reduce((acc, value, idx) => {
    const sid = title === '' ? idx : idx + 1
    const cnt = ((sid) * len) - acc.length
    return acc + ' '.repeat(cnt > 0 ? cnt : 0) + parseValue(value)
  }, title))
}

interface PairAnalysis {
  pair: string,
  side: string,
  score: number,
  symbolScore: number
}


interface ILogger {

}

class Logger implements ILogger {

  private _marketAnalysis: MarketAnalysisResult[] = []
  public addMarketAnalysis = (analysis: MarketAnalysisResult) => {
    this._marketAnalysis.push(analysis)
  }

  public marketAnalysis = (): void => {
    console.log(`MARKET ANALYSIS`)
    const data = this._marketAnalysis.sort((a, b) => b.poweredScore - a.poweredScore)
    logRow(data.map(({ quoteSymbol }) => quoteSymbol), 'Quote')
    logRow(data.map(({ score }) => score), 'Score')
    logRow(data.map(({ poweredScore }) => poweredScore), 'Power')
    console.log('')
  }

  private _pairAnalysis: PairAnalysis[] = []
  public addPairAnalysis = (pair: PairAnalysis): void => {
    this._pairAnalysis.push(pair)
  }

  public pairAnalysis = (): void => {
    console.log(`TOP 10 PAIRS`)
    const data = this._pairAnalysis.sort((a, b) => b.symbolScore - a.symbolScore).slice(0, 10)
    logRow(data.map(({ pair }) => pair), 'Pair')
    logRow(data.map(({ side }) => side), 'Side')
    logRow(data.map(({ score }) => score), 'Score')
    logRow(data.map(({ symbolScore }) => symbolScore), 'Collector')
    console.log('')
  }

  private _newsPosts: { title: string, score: number }[] = []
  public addNewsPosts = (analysis: { title: string, score: number }) => {
    this._newsPosts.push(analysis)
  }

  public newsPosts = (): void => {
    console.log(`NEWS ANALYSIS`)
    logRow(['TOP 5', 'WORST 5'], '', 90)
    const data = this._newsPosts.sort((a, b) => b.score - a.score)
    for (let i = 0; i < 5; i++) {
      logRow([data[i].title, data[(data.length - 1) - i].title], '', 90)
    }
    console.log('')
  }

  private _symbolPie: {}[] = []
  public addSymbolPie = (pie) => this._symbolPie[pie.name] = pie.values
  public symbolPie = () => {
    console.log(this._symbolPie)
    console.log(`SYMBOLPIE`)
    const data = Object.entries(this._symbolPie['$ Diff']).sort((a: [string, number], b: [string, number]) => a[1] - b[1])
    logRow(data.map(([symbol]) => symbol), 'Symbol')
    logRow(data.map(([symbol]) => this._symbolPie['$ Balance'][symbol] ),'$ Balance')
    logRow(data.map(([symbol]) => this._symbolPie['$ SymbolPie'][symbol] ), '$ SymbolPie')
    logRow(data.map(([symbol]) => this._symbolPie['$ Diff'][symbol] ), '$ Diff')
  }

}

export default Logger

// console.log('Market Analysis')
// console.table(Object.entries(this.analysis.marketQuoteScore).reduce((acc, [title, pie]) => {
//   acc[title] = Object.entries(pie).reduce((acc, [symbol, amount]) => {
//     acc[symbol] = parseStepSize(amount)
//     return acc
//   }, {})
//   return acc
// }, {}))

// generateTable('SymbolPie', {
// ['% balance']: this.userBalancePercentage,
// ['% symbol pie']: this.analysis.symbolPie,
// ['% difference']: this.differencePercentage,
//   ['$ balance']: dollarBalance,
//   ['$ symbol pie']: dollarSymbolPie,
//   ['$ difference']: dollarDifference
// })

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

// generateTable('Participating Pairs', this.participatingPairs.map(pair => ({ ...pair, ...pair.provider, ...pair.collector })).reduce((acc, pair) => {
//   acc[pair.pair] = pair
//   return acc
// }, {}))
// console.log('Participating Pairs:')
// console.table(this.participatingPairs.map(pair => ({ ...pair, ...pair.provider, ...pair.collector })))

// generateTable('Dropped Pairs', Object.values(this.DroppedPairs).map((pair): any => ({
//   pair: pair.pair,
//   side: pair.side,
//   reason: pair.reason
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
// })).reduce((acc, pair) => {
//   acc[pair.pair] = pair
//   return acc
// }, {}))

// // console.log('Dropped Pairs:')
// console.table(Object.values(this.DroppedPairs).map((pair): any => ({
//   pair: pair.pair,
//   side: pair.side,
//   reason: pair.reason,
//   minBase: pair.minBase,
//   baseAmount: parseStepSize(pair.baseAmount),
//   minQuote: pair.minQuote,
//   quoteAmount: parseStepSize(pair.quoteAmount),
//   provider: pair.provider.providerSymbol,
//   fundsBtc: parseStepSize(pair.providerFundsBtc),
//   spendableBtc: parseStepSize(pair.provider.spendableBtc),
//   spendable: parseStepSize(pair.provider.spendable),
//   collector: pair.collector.collectorSymbol,
//   amountBtc: parseStepSize(pair.collectorAmountBtc),
//   demandBtc: parseStepSize(pair.collector.demandBtc),
//   demand: parseStepSize(pair.collector.demand)
// })))

// console.log('Final Pairs:')
// console.table(this.finalPairs.map(pair => ({ ...pair.order, feeDollars: parseStepSize(pair.feeDollars)})))


// console.log('Order Result:')
// console.table(this.orderResult)

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