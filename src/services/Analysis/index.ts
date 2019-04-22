import { CandleChartInterval, Symbol } from 'binance-api-node'
import { Binance } from '../../index'
import CandleStickAnalysis from '../CandleStickAnalysis'
import Oscillators from '../Oscillators'
import MovingAverages from '../MovingAverages'
import StockData from 'technicalindicators/declarations/StockData'
import NewsAnalysis, { NewsAnalysisResult } from '../NewsAnalysis'

export interface AnalysisInput {
  pairsInfo: Symbol[]
}

class Analysis {

  // todo: user custom (list and weights)
  private readonly intervalList: CandleChartInterval[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d']
  private readonly intervalWeights: number[] = [0.025236593, 0.075709779, 0.126182965, 0.378548896, 0.189274448, 0.094637224, 0.047318612, 0.023659306, 0.015772871, 0.011829653, 0.007886435, 0.003943218]
  private readonly techAnalysisWeights = { oscillators: 0.45, candlesticks: 0.2, movingAverage: 0.35 }
  private readonly analysisWeights = { tech: 0.9, news: 0.1 }

  private readonly symbols: string[] = []
  private readonly pairs: string[] = []
  private readonly quoteSymbols: string[] = []
  private readonly pairsPerSymbol: { [symbol: string]: Symbol[] }

  private readonly pairsInfo: Symbol[] = []

  protected techAnalysis: { [pair: string]: number }
  protected newsAnalysis: NewsAnalysisResult | Promise<NewsAnalysisResult> | undefined

  constructor({ pairsInfo }: AnalysisInput) {
    this.pairsInfo = pairsInfo
    this.symbols = Object.keys(pairsInfo.reduce((acc, pair) => {
      acc[pair.baseAsset] = true
      acc[pair.quoteAsset] = true
      return acc
    }, {}))
    this.pairs = pairsInfo.map(pair => pair.symbol)

    const quoteSymbols = Object.entries(pairsInfo.map(pair => pair.quoteAsset)
    .reduce((acc, quoteSymbol) => {
      if (acc[quoteSymbol]) acc[quoteSymbol] = 0
      acc[quoteSymbol]++
      return acc
    }, {}))
    quoteSymbols.forEach(([quoteSymbol, count]) => {
      if (count > pairsInfo.length / quoteSymbols.length) this.quoteSymbols.push(quoteSymbol)
    })

    this.pairsPerSymbol = this.symbols.reduce((acc, symbol) => {
      acc[symbol] = []
      pairsInfo.forEach(pair => {
        if (pair.baseAsset === symbol || pair.quoteAsset === symbol) {
          acc[symbol].push(pair)
        }
      })
      return acc
    }, {})
  }

  public async run() {

    this.newsAnalysis = this.newsAnalysis ? Promise.resolve(this.newsAnalysis) : NewsAnalysis(this.symbols)

    const techAnalysisPromises: Promise<[string, number]>[] = []

    this.pairs.forEach(pair => {
      this.intervalList.forEach(interval => {
        techAnalysisPromises.push(Binance.getCandlesStockData(pair, interval)
        .then((candles: StockData) => [
          pair, (
            (Oscillators(candles)._score * this.techAnalysisWeights.oscillators)
            + (CandleStickAnalysis(candles)._score * this.techAnalysisWeights.candlesticks)
            + (MovingAverages(candles)._score * this.techAnalysisWeights.movingAverage))
          * this.intervalWeights[this.intervalList.indexOf(interval)]
        ]))
      })
    })

    this.techAnalysis = await Promise.all(techAnalysisPromises)
    .then(pairInterval => pairInterval.reduce((acc, [pair, score]) => {
      if (!acc[pair]) acc[pair] = 0
      acc[pair] += score
      return acc
    }, {}))

    this.newsAnalysis = await this.newsAnalysis.then(news => {
      this.symbols.forEach(symbol => {
        news._scores[symbol]
      })
    })


  }
}

export default Analysis