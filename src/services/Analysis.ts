import { CandleChartInterval, Symbol } from 'binance-api-node'

import StockData from 'technicalindicators/declarations/StockData'
import { Binance } from '../index'
import Oscillators from './Oscillators'
import MovingAverages from './MovingAverages'
import CandleStickAnalysis from './CandleStickAnalysis'
import AnalysisNews from './AnalysisNews'

export interface PairScore {
  _pairScore: number,
  base: {
    symbol: string,
    score: number
  },
  quote: {
    symbol: string,
    score: number
  }
}

export interface AnalysisInput {
  pairsInfo: Symbol[]
  normalizedSymbols: { [symbol: string]: number }
}

export interface MarketAnalysisResult {
  score: number,
  multiplier: number
  poweredScore: number
}

export interface IAnalysis {
  run(): Promise<void>,

  apiCalls: number
  techAnalysis: { [pair: string]: number },
  techSymbolAnalysis: { [symbol: string]: number },
  newsAnalysis: AnalysisNews,
  symbolPie: { [pair: string]: number }
  pairAnalysis: { [pair: string]: PairScore }
}

class Analysis implements IAnalysis {

  private readonly pairsInfo: Symbol[] = []
  public apiCalls: number = 0

  // todo: user custom (list and weights)
  private readonly intervalList: CandleChartInterval[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d']

  private readonly intervalWeights: number[] = [0.025236593, 0.075709779, 0.126182965, 0.378548896, 0.189274448, 0.094637224, 0.047318612, 0.023659306, 0.015772871, 0.011829653, 0.007886435, 0.003943218]
  private readonly techAnalysisWeights = { oscillators: 0.45, candlesticks: 0.2, movingAverage: 0.35 }
  private readonly symbolPieWeights = { tech: 0.5, news: 0.1, markets: 0.4 }

  private readonly symbols: string[] = []
  private readonly pairs: string[] = []
  private readonly quoteSymbols: string[] = []
  private readonly pairsPerSymbol: { [symbol: string]: Symbol[] } = {}

  public techAnalysis: { [pair: string]: number } = {}
  public techSymbolAnalysis: { [symbol: string]: number } = {}
  public newsAnalysis: AnalysisNews
  public marketAnalysis: { [quoteSymbol: string]: MarketAnalysisResult } = {}
  public pairAnalysis: { [pair: string]: PairScore } = {}
  public symbolPie: { [pair: string]: number } = {}

  private symbolTotals: { [pair: string]: number } = {}
  private allTotals: number = 0

  constructor({ pairsInfo, normalizedSymbols }: AnalysisInput) {

    this.pairsInfo = pairsInfo
    this.pairs = pairsInfo.map(pair => pair.symbol)

    this.symbols = Object.keys(pairsInfo.reduce((acc, pair) => {
      acc[pair.baseAsset] = true
      acc[pair.quoteAsset] = true
      return acc
    }, {}))

    this.techSymbolAnalysis = { ...normalizedSymbols }
    this.symbolPie = { ...normalizedSymbols }
    this.symbolTotals = { ...normalizedSymbols }

    this.marketAnalysis['ALTS'] = {
      score: 0,
      multiplier: 0,
      poweredScore: 0
    }

    const quoteSymbols = Object.entries(pairsInfo.map(pair => pair.quoteAsset)
    .reduce((acc, quoteSymbol) => {
      acc[quoteSymbol]++
      return acc
    }, { ...normalizedSymbols }))

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

  public async run(): Promise<void> {
    const start = Date.now()

    this.newsAnalysis = new AnalysisNews({ symbols: this.symbols })
    const newsAnalysisPromise = this.newsAnalysis.run()

    const techAnalysisPromises: Promise<[string, number]>[] = []

    this.pairs.forEach(pair => {
      this.intervalList.forEach(interval => {
        this.apiCalls++
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

    /** this.techAnalysis[pair] = */
    await Promise.all(techAnalysisPromises)
    .then(pairInterval => pairInterval.forEach(([pair, score]) => {
      if (!this.techAnalysis[pair]) this.techAnalysis[pair] = 0
      this.techAnalysis[pair] += score
    }))

    /** this.marketAnalysis[quoteSymbol | altsMarket] = */
    this.quoteSymbols.forEach(quoteSymbol => {
      const [baseScore, quoteScore] = this.pairsPerSymbol[quoteSymbol]
      .filter(pair => pair.quoteAsset === quoteSymbol)
      .reduce((acc, pair, _, src) => {
        const quoteScore = -(this.techAnalysis[pair.symbol] - 0.5) * 2
        return quoteScore < 0
          ? [acc[0] - quoteScore / src.length, acc[1]]
          : [acc[0], acc[1] + quoteScore / src.length]
      }, [0, 0])

      const quoteMultiplier = Math.pow(quoteScore + 1, baseScore + 2)
      const baseMultiplier = Math.pow(baseScore + 1, baseScore + 2)

      this.marketAnalysis[quoteSymbol] = {
        score: quoteScore,
        multiplier: quoteMultiplier,
        poweredScore: quoteScore * quoteMultiplier
      }

      this.marketAnalysis['ALTS'].score += baseScore / this.quoteSymbols.length
      this.marketAnalysis['ALTS'].multiplier += baseMultiplier / this.quoteSymbols.length
      this.marketAnalysis['ALTS'].poweredScore += baseScore * baseMultiplier / this.quoteSymbols.length
    })

    /** this.techSymbolAnalysis[symbol] = */
    /** this.pairAnalysis[symbol] = */
    this.pairsInfo.forEach(pair => {
      const pairTechScore = this.techAnalysis[pair.symbol]

      function pairToSymbols(pairScore) {
        const baseScore = (pairScore - 0.5) * 2
        return baseScore > 0 ? [baseScore, 0] : [0, -baseScore]
      }

      const [baseTechScore, quoteTechScore] = pairToSymbols(pairTechScore)

      this.techSymbolAnalysis[pair.baseAsset] += baseTechScore / this.pairsPerSymbol[pair.baseAsset].length
      this.techSymbolAnalysis[pair.quoteAsset] += quoteTechScore / this.pairsPerSymbol[pair.quoteAsset].length

      const addMarketMultiplier = symbol => this.marketAnalysis[this.quoteSymbols.includes(symbol) ? symbol : 'ALTS'].multiplier

      this.pairAnalysis[pair.symbol] = {
        _pairScore: pairTechScore,
        base: {
          symbol: pair.baseAsset,
          score: baseTechScore * addMarketMultiplier(pair.baseAsset)
        },
        quote: {
          symbol: pair.quoteAsset,
          score: quoteTechScore * addMarketMultiplier(pair.quoteAsset)
        }
      }
    })

    await newsAnalysisPromise

    this.symbols.forEach(symbol => {
      this.symbolTotals[symbol] += this.marketAnalysis[this.quoteSymbols.includes(symbol) ? symbol : 'ALTS'].poweredScore * this.symbolPieWeights.markets
      this.symbolTotals[symbol] += this.techSymbolAnalysis[symbol] * this.symbolPieWeights.tech
      this.symbolTotals[symbol] += (this.newsAnalysis.symbolAnalysis[symbol] < 0 ? 0 : this.newsAnalysis.symbolAnalysis[symbol]) * this.symbolPieWeights.news
      this.allTotals += this.symbolTotals[symbol]
    })

    /** this.symbolPie = */
    this.symbols.forEach(symbol => {
      this.symbolPie[symbol] += this.symbolTotals[symbol] / this.allTotals
    })

    console.log(`analysis time: ${Date.now() - start}ms`)
  }
}

export default Analysis