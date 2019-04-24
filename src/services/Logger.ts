import { MarketAnalysisResult } from './Analysis'
import { DroppedPair, FinalPair } from './TradeBot/TradeBot'

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

  public startLog = (totalBalance: { btc: number, dollar: number, btcPrice: number }) => {
    console.log('')
    logRow(Array(40).fill(' _ '), '', 3)
    console.log('')
    const date = new Date()
    logRow(['Date', 'Time', 'BTC', 'USDT', 'BTCUSDT'], ' ')
    logRow([
      date.toLocaleDateString('nl-NL'),
      date.toLocaleTimeString('nl-NL'),
      totalBalance.btc,
      totalBalance.dollar,
      totalBalance.btcPrice
    ], ' ')
    console.log('')
  }

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

  private _newsPostsTitles: string[] = []
  private _newsPosts: { title: string, score: number }[] = []
  public addNewsPosts = (analysis: { title: string, score: number }) => {
    if (!this._newsPostsTitles.includes(analysis.title)) {
      this._newsPosts.push(analysis)
      this._newsPostsTitles.push(analysis.title)
    }
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

  private symbolOrder: string[] = []

  private _symbolPie: {}[] = []
  public addSymbolPie = (pie) => this._symbolPie[pie.name] = pie.values
  public symbolPie = () => {
    console.log(`SYMBOLPIE`)
    this.symbolOrder = Object.entries(this._symbolPie['$ Diff'])
    .sort((a: [string, number], b: [string, number]) => a[1] - b[1])
    .map(([symbol]) => symbol)
    logRow(this.symbolOrder.map((symbol) => symbol), 'Symbol')
    logRow(this.symbolOrder.map((symbol) => this._symbolPie['$ Balance'][symbol]), '$ Balance')
    logRow(this.symbolOrder.map((symbol) => this._symbolPie['$ SymbolPie'][symbol]), '$ SymbolPie')
    logRow(this.symbolOrder.map((symbol) => this._symbolPie['$ Diff'][symbol]), '$ Diff')
    console.log('')
  }

  public startDroppedPairs = () => {
    console.log('DROPPED PAIRS')
    logRow(['Pair', 'Side', 'Provider', 'Collector', 'Reason'])
  }

  public droppedPair = (pair: DroppedPair) => {
    const len = 15
    const data: any[] = [pair.side, pair.provider, pair.collector]
    switch (pair.dropCode) {
      case 1:
        logRow(data.concat(['score=0', ' ', pair.score.toFixed(8)]), pair.pair, len)
        break
      case 2:
        logRow(data.concat(['coll<minBase', ' ', `${pair.collectorAmount && pair.collectorAmount.toFixed(8)}<${pair.minBase}`]), pair.pair, len)
        break
      case 3:
        logRow(data.concat(['prov<minQuot', ' ', `${pair.providerFunds && pair.providerFunds.toFixed(8)}<${pair.minQuote}`]), pair.pair, len)
        break
      case 4:
        logRow(data.concat(['prov<minBase', ' ', `${pair.providerFunds && pair.providerFunds.toFixed(8)}<${pair.minBase}`]), pair.pair, len)
        break
      case 5:
        logRow(data.concat(['coll<minQuote', ' ', `${pair.collectorAmount && pair.collectorAmount.toFixed(8)}<${pair.minQuote}`]), pair.pair, len)
        break
      case 6:
        logRow(data.concat(['funds dry', ' ', `collect: ${pair.collectorAmountBtc && pair.collectorAmountBtc.toFixed(8)}`]), pair.pair, len)
        break
      case 7:
        logRow(data.concat(['coll done', ' ', `provide: ${pair.providerFundsBtc && pair.providerFundsBtc.toFixed(8)}`]), pair.pair, len)
        break
      case 8:
        logRow(data.concat(['coll base<minBase', ' ', `${pair.baseAmount && pair.baseAmount.toFixed(8)}<${pair.minBase}`]), pair.pair, len)
        break
      case 9:
        logRow(data.concat(['prov quot<minQuot', ' ', `${pair.quoteAmount && pair.quoteAmount.toFixed(8)}<${pair.minQuote}`]), pair.pair, len)
        break
      case 10:
        logRow(data.concat(['coll quot<minQuot', ' ', `${pair.quoteAmount && pair.quoteAmount.toFixed(8)}<${pair.minQuote}`]), pair.pair, len)
        break
      case 11:
        logRow(data.concat(['prov base<minBase', ' ', `${pair.baseAmount && pair.baseAmount.toFixed(8)}<${pair.minBase}`]), pair.pair, len)
        break
      case 12:
        logRow(data.concat(['funds dry & coll done'], pair.pair, len))
        break
    }
  }

  private _trades: FinalPair[] = []
  public addTrade = (pair: FinalPair) => {
    this._trades.push(pair)
  }

  public hasTrades = (): boolean => this._trades.length > 0

  public trades = () => {
    console.log('')
    console.log('TRADES')
    logRow(['Pair', 'Side', 'Price', 'Collector', 'Base Amount', 'USDT Amount', 'Fee USDT Est', 'Status'])
    for (let i = 0, len = this._trades.length; i < len; i++) {
      const trade = this._trades[i]
      logRow([trade.pair, trade.side, trade.price, trade.collector, trade.baseAmount, trade.dollarValue, trade.feeDollar, trade.success ? 'Success' : ''])
    }
    console.log('')
  }

  private _time: { [item: string]: number } = {}
  public addTime = ({ item, time }) => {
    this._time[item] = time
  }

  public endLog = ({ oldDollarBalance, newDollarBalance, btc, dollar, dollarDiff, tradeTime }: {
    oldDollarBalance: {[symbol: string]: number}
    newDollarBalance: {[symbol: string]: number}
    btc: number,
    dollar: number,
    dollarDiff: number,
    tradeTime: number,
  }) => {
    console.log('')
    logRow(this.symbolOrder.map((symbol) => symbol), 'Symbol')
    logRow(this.symbolOrder.map(symbol => oldDollarBalance[symbol]), 'old $')
    logRow(this.symbolOrder.map(symbol => newDollarBalance[symbol]), 'new $')
    logRow(this.symbolOrder.map(symbol => {
      const cal = newDollarBalance[symbol] - oldDollarBalance[symbol]
      return cal !== 0 ? cal : ' '
    }), 'diff $')
    console.log('')
    logRow(['BTC', 'USDT', 'USDT Diff', 'run time', 'analysis time', 'news analysis time'])
    logRow([btc, dollar, dollarDiff, `${tradeTime}ms`, `${this._time['analysis']}ms`, `${this._time['news']}ms`])
    console.log('')
    logRow(Array(40).fill(' _ '), '', 3)
  }

}

export default Logger