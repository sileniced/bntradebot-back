import { MarketAnalysisResult } from './Analysis'
import { DroppedPair, FinalPair } from './TradeBot/TradeBot'
import { parseDropCode } from '../services/utils'

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

const logRow = (data: any[], title: string = '', len: number = 20): void => {
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
    logRow(['TOP 5', 'WORST 5'], '', 100)
    const data = this._newsPosts.sort((a, b) => b.score - a.score)
    for (let i = 0; i < 5; i++) {
      const best = data[i].title
      const worst = data[(data.length - 1) - i].title
      logRow([
        best.length > 99 ? best.slice(0, 95) + '...' : best,
        worst.length > 99 ? worst.slice(0, 95) + '...' : worst
      ], '', 100)
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
    const len = 20
    logRow([pair.side, pair.provider, pair.collector, ...parseDropCode(pair)], pair.pair, len)
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
  }

  private _time: { [item: string]: number } = {}
  public addTime = ({ item, time }) => {
    this._time[item] = time
  }

  public endLog = ({ oldDollarBalance, newDollarBalance, btc, dollar, dollarDiff, tradeTime }: {
    oldDollarBalance: { [symbol: string]: number }
    newDollarBalance: { [symbol: string]: number }
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
      return Math.abs(cal) > 0.0001 ? cal : ' '
    }), 'diff $')
    console.log('')
    logRow(['BTC', 'USDT', 'USDT Diff', 'run time', 'analysis time', 'news analysis time'], ' ')
    logRow([btc, dollar, dollarDiff, `${tradeTime}ms`, `${this._time['analysis']}ms`, `${this._time['news']}ms`], ' ')
    console.log('')
    logRow(Array(40).fill(' _ '), '', 3)
  }

}

export default Logger