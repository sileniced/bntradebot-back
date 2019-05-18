import { CandleChartInterval, OrderSide, Symbol } from 'binance-api-node'

import StockData from 'technicalindicators/declarations/StockData'
import { Binance } from '../../index'
import Oscillators from './Oscillators'
import MovingAverages from './MovingAverages'
import CandleStickAnalysis from './CandleStickAnalysis'
import AnalysisNews from './NewsAnalysis'
import Logger from '../Logger'
import PriceChangeAnalysis from './PriceChangeAnalysis'
import { ScoresWeightsEntityV1Model } from '../../entities/ScoresWeightsEntityV1'
import { numShort } from '../../services/utils'
import MarketAnalysis, { MarketScore } from './MarketAnalysis'

export interface AssignedPair {
  pair: string,
  side: OrderSide,
  provider: string,
  collector: string
}

export interface AnalysisInput {
  pairsInfo: Symbol[]
  getNormalizedSymbols: () => { [symbol: string]: number }
}

export interface IAnalysis {
  run(logger: Logger): Promise<void>,

  techPairScore: { [pair: string]: number }
  techSymbolScore: { [symbol: string]: number }

  marketScore: MarketScore
  marketSymbolScore: { [symbol: string]: number }

  assignedPair: { [pair: string]: AssignedPair }

  newsScore: AnalysisNews
  symbolPie: { [pair: string]: number }
}

class Analysis implements IAnalysis {

  private readonly pairsInfo: Symbol[] = []
  public apiCalls: number = 0

  // todo: user custom (list and weights)
  private readonly intervalList: CandleChartInterval[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d']

  private readonly intervalWeights: number[] = [0.005434783, 0.016304348, 0.027173913, 0.081521739, 0.163043478, 0.326086957, 0.163043478, 0.081521739, 0.054347826, 0.04076087, 0.027173913, 0.013586957]
  private readonly techAnalysisWeights = {
    candlesticks: 0.109,
    oscillators: 0.219,
    moveBack: 0.181,
    crosses: 0.256,
    priceChange: 0.235
  }
  private readonly symbolPieWeights = { tech: 0.4, news: 0.05, markets: 0.55 }

  private readonly symbols: string[] = []
  private readonly pairs: string[] = []
  public readonly marketSymbols: string[] = []
  public readonly pairsPerSymbol: { [symbol: string]: Symbol[] } = {}

  public techPairScore: { [pair: string]: number } = {}
  public techSymbolScore: { [symbol: string]: number } = {}

  public marketScore: MarketScore = {}
  public marketSymbolScore: { [symbol: string]: number } = {}
  public marketPairCollectorScore: { [pair: string]: number } = {}

  public assignedPair: { [pair: string]: AssignedPair } = {}

  public newsScore: AnalysisNews
  public symbolPie: { [pair: string]: number } = {}

  private symbolTotals: { [pair: string]: number } = {}
  private allTotals: number = 0

  public dataCollector: Partial<ScoresWeightsEntityV1Model> = {}

  constructor({ pairsInfo, getNormalizedSymbols }: AnalysisInput) {

    this.pairsInfo = pairsInfo
    this.pairs = pairsInfo.map(pair => pair.symbol)

    this.symbols = Object.keys(pairsInfo.reduce((acc, pair) => {
      acc[pair.baseAsset] = true
      acc[pair.quoteAsset] = true
      return acc
    }, {}))

    this.techPairScore = this.pairs.reduce((acc, pair) => {
      acc[pair] = 0
      return acc
    }, {})
    this.techSymbolScore = getNormalizedSymbols()
    this.marketSymbolScore = getNormalizedSymbols()
    this.symbolPie = getNormalizedSymbols()
    this.symbolTotals = getNormalizedSymbols()

    const quoteSymbols = Object.entries(pairsInfo.map(pair => pair.quoteAsset)
    .reduce((acc, quoteSymbol) => {
      acc[quoteSymbol]++
      return acc
    }, getNormalizedSymbols()))

    quoteSymbols.forEach(([quoteSymbol, count]) => {
      if (count > pairsInfo.length / quoteSymbols.length) this.marketSymbols.push(quoteSymbol)
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

  public async run(/*logger: Logger*/): Promise<void> {
    // const start = Date.now()
    this.newsScore = new AnalysisNews({ symbols: this.symbols })
    const newsAnalysisPromise = this.newsScore.run(/*logger*/)

    this.dataCollector.pairs = {}

    const techAnalysisPromises: Promise<void>[] = []

    /** this.techPairScore[pair] = */
    const pen = this.pairs.length
    const ien = this.intervalList.length
    for (let i = 0; i < pen; i++) {
      this.dataCollector.pairs[this.pairs[i]] = {}
      for (let j = 0; j < ien; j++) {

        techAnalysisPromises.push(Binance.getCandlesStockData(this.pairs[i], this.intervalList[j])
        .then((candles: StockData) => {
          if (this.dataCollector.pairs) {

            const priceChangeScore = PriceChangeAnalysis(candles)

            this.dataCollector.pairs[this.pairs[i]][this.intervalList[j]] = {
              w: numShort(this.intervalWeights[j]),
              a: {
                tech: {
                  w: numShort(this.symbolPieWeights.tech),
                  a: {
                    oscillators: {
                      w: numShort(this.techAnalysisWeights.oscillators),
                      a: {}
                    },
                    candlesticks: {
                      w: numShort(this.techAnalysisWeights.candlesticks),
                      a: {}
                    },
                    moveBack: {
                      w: numShort(this.techAnalysisWeights.moveBack),
                      a: {}
                    },
                    cross: {
                      w: numShort(this.techAnalysisWeights.crosses),
                      s: 0
                    },
                    priceChange: {
                      w: numShort(this.techAnalysisWeights.priceChange),
                      s: numShort(priceChangeScore)
                    }
                  }
                }
              }
            }
            const collector = this.dataCollector.pairs[this.pairs[i]][this.intervalList[j]].a.tech.a

            const movingAverages = MovingAverages(candles, collector.moveBack.a, collector.cross)

            this.techPairScore[this.pairs[i]] += (
              (Oscillators(candles, collector.oscillators.a)._score * this.techAnalysisWeights.oscillators)
              + (CandleStickAnalysis(candles, collector.candlesticks.a)._score * this.techAnalysisWeights.candlesticks)
              + (movingAverages.moveBackScore * this.techAnalysisWeights.moveBack)
              + (movingAverages.crossScore * this.techAnalysisWeights.crosses)
              + (priceChangeScore * this.techAnalysisWeights.priceChange)
            ) * this.intervalWeights[j]
          }
        }))
      }
    }

    await Promise.all(techAnalysisPromises)

    this.apiCalls = techAnalysisPromises.length

    /** this.marketScore[quoteSymbol | altsMarket] = */
    this.marketScore = MarketAnalysis(this.marketSymbols, this.pairsPerSymbol, this.techPairScore)

    // for (let i = 0; i < qen; i++) {
      // logger.addMarketAnalysis(this.marketScore[this.marketSymbols[i]])
    // }
    // logger.addMarketAnalysis(this.marketScore['ALTS'])
    // logger.marketAnalysis()

    /** this.techSymbolScore[symbol] = */
    /** this.marketSymbolScore[symbol] = */
    for (let i = 0; i < pen; i++) {
      const pair = this.pairsInfo[i]
      const baseScore = (this.techPairScore[pair.symbol] - 0.5) * 2
      const side = baseScore > 0 ? 'BUY' : 'SELL'
      this.assignedPair[pair.symbol] = baseScore > 0 ? {
        pair: pair.symbol,
        side: side,
        provider: pair.quoteAsset,
        collector: pair.baseAsset
      } : {
        pair: pair.symbol,
        side: side,
        provider: pair.baseAsset,
        collector: pair.quoteAsset
      }
      const collector = this.assignedPair[pair.symbol].collector
      const marketQuoteSymbol = this.marketSymbols.includes(collector) ? collector : 'ALTS'
      const battleScore = this.marketScore[marketQuoteSymbol].battleScore
      const altDivider = (marketQuoteSymbol === 'ALTS' ? qen : 1)
      this.techSymbolScore[collector] += Math.abs(baseScore) / this.pairsPerSymbol[collector].length
      this.marketSymbolScore[collector] += (this.techSymbolScore[collector] + battleScore) / altDivider
      this.marketPairCollectorScore[pair.symbol] = (this.techSymbolScore[collector] + battleScore) / altDivider


      // logger.addPairAnalysis({
      //   pair: pair.symbol,
      //   side,
      //   score: this.techPairScore[pair.symbol],
      //   symbolScore: this.marketPairCollectorScore[pair.symbol]
      // })

    }
    // logger.pairAnalysis()

    await newsAnalysisPromise
    // logger.newsPosts()

    this.dataCollector.symbols = {}
    this.dataCollector.market = {}

    const sen = this.symbols.length
    for (let i = 0; i < sen; i++) {
      const symbol = this.symbols[i]

      const newsScore = this.newsScore.symbolAnalysis[symbol] < 0 ? 0 : this.newsScore.symbolAnalysis[symbol]
      this.dataCollector.symbols[symbol] = {
        news: {
          w: numShort(this.symbolPieWeights.news),
          s: numShort(newsScore)
        }
      }

      const marketSymbol = this.marketSymbols.includes(symbol) ? symbol : 'ALTS'
      this.dataCollector.market[marketSymbol] = {
        w: numShort(this.symbolPieWeights.markets),
        s: numShort(this.marketScore[marketSymbol].battleScore)
      }

      this.symbolTotals[symbol] += this.marketScore[marketSymbol].battleScore * this.symbolPieWeights.markets
      this.symbolTotals[symbol] += this.techSymbolScore[symbol] * this.symbolPieWeights.tech
      this.symbolTotals[symbol] += newsScore * this.symbolPieWeights.news
      this.allTotals += this.symbolTotals[symbol]
    }

    /** this.symbolPie = */
    for (let i = 0; i < sen; i++) {
      this.symbolPie[this.symbols[i]] += this.symbolTotals[this.symbols[i]] / this.allTotals
    }
    // logger.addTime({ item: 'analysis', time: Date.now() - start })
  }
}

export default Analysis