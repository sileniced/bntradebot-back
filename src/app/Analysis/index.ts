import { CandleChartInterval, OrderSide, Symbol } from 'binance-api-node'

import StockData from 'technicalindicators/declarations/StockData'
import { Binance } from '../../index'
import Oscillators from './Oscillators'
import MovingAverages from './MovingAverages'
import CandleStickAnalysis from './CandleStickAnalysis'
import AnalysisNews from './NewsAnalysis'
import Logger from '../../services/Logger'
import PriceChangeAnalysis from './PriceChangeAnalysis'
import { ScoresWeightsEntityV1Model } from '../../entities/ScoresWeightsEntityV1'
import { dataCollectorMoveBackNames, dataCollectorCandlestickNames, dataCollectorOscillatorNames } from './utils'
import { addMachineLearningWeights } from './mlWeightUtils'

export interface AssignedPair {
  pair: string,
  side: OrderSide,
  provider: string,
  collector: string
}

export interface AnalysisInput {
  pairsInfo: Symbol[]
  getNormalizedSymbols: () => { [symbol: string]: number }
  prevOptimalScore: { [pair: string]: number | null }
  prevData: ScoresWeightsEntityV1Model
}

export interface MarketAnalysisResult {
  quoteSymbol: string,
  score: number,
  multiplier: number
  poweredScore: number
  battleScore: number
}

export interface IAnalysis {
  run(logger: Logger): Promise<void>,

  techPairScore: { [pair: string]: number }
  techSymbolScore: { [symbol: string]: number }

  marketScore: { [quoteSymbol: string]: MarketAnalysisResult }
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

  private readonly initIntervalWeights: number[] = [0.005434783, 0.016304348, 0.027173913, 0.081521739, 0.163043478, 0.326086957, 0.163043478, 0.081521739, 0.054347826, 0.04076087, 0.027173913, 0.013586957]
  private intervalWeights: { [pair: string]: number[] } = {}
  private readonly initTechAnalysisWeights = {
    candlesticks: 0.109,
    oscillators: 0.219,
    moveBack: 0.181,
    cross: 0.256,
    priceChange: 0.235
  }
  private readonly symbolPieWeights = { tech: 0.5, news: 0.05, markets: 0.45 }

  private readonly symbols: string[] = []
  private readonly pairs: string[] = []
  public readonly marketSymbols: string[] = []
  public readonly pairsPerSymbol: { [symbol: string]: Symbol[] } = {}

  public techPairScore: { [pair: string]: number } = {}
  public techSymbolScore: { [symbol: string]: number } = {}

  public marketScore: { [quoteSymbol: string]: MarketAnalysisResult } = {}
  public marketSymbolScore: { [symbol: string]: number } = {}
  public marketPairCollectorScore: { [pair: string]: number } = {}

  public assignedPair: { [pair: string]: AssignedPair } = {}

  public newsScore: AnalysisNews
  public symbolPie: { [pair: string]: number } = {}

  private symbolTotals: { [pair: string]: number } = {}
  private allTotals: number = 0

  public dataCollector: Partial<ScoresWeightsEntityV1Model> = {
    names: {
      moveBack: dataCollectorMoveBackNames,
      candlesticks: dataCollectorCandlestickNames,
      oscillators: dataCollectorOscillatorNames
    }
  }

  private readonly prevData: ScoresWeightsEntityV1Model
  private readonly prevOptimalScore: { [pair: string]: number | null }

  constructor({ pairsInfo, getNormalizedSymbols, prevData, prevOptimalScore }: AnalysisInput) {

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

    this.marketScore['ALTS'] = {
      quoteSymbol: 'ALTS',
      score: 0,
      multiplier: 0,
      poweredScore: 0,
      battleScore: 0
    }

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

    this.prevData = prevData
    this.prevOptimalScore = prevOptimalScore
  }

  public async run(logger: Logger): Promise<void> {
    const start = Date.now()
    this.newsScore = new AnalysisNews({ symbols: this.symbols })
    const newsAnalysisPromise = this.newsScore.run(logger)

    this.dataCollector.pairs = {}

    const techAnalysisPromises: Promise<void>[] = []

    /** this.techPairScore[pair] = */
    this.pairs.forEach(pair => {
      if (!this.dataCollector.pairs) return
      this.dataCollector.pairs[pair] = {}

      const prevOptimalScore = this.prevOptimalScore[pair]
      if (prevOptimalScore !== null) {
        const prevIntervalData = this.prevData.pairs[pair]

        this.intervalWeights[pair] = []
        addMachineLearningWeights(prevOptimalScore, Object.entries(prevIntervalData).map(([interval, { w, s }]) => ({
          name: interval,
          prevData: { w, s }
        }))).forEach(([interval, weight]) => {
          this.intervalWeights[pair][this.intervalList.indexOf(interval as CandleChartInterval)] = weight
        })
      } else this.intervalWeights[pair] = this.initIntervalWeights

      this.intervalList.forEach((interval, intervalIdx) => {
        techAnalysisPromises.push(Binance.getCandlesStockData(pair, interval)
        .then((candles: StockData) => {
          if (!this.dataCollector.pairs) return
          this.dataCollector.pairs[pair][interval] = {
            w: 0, s: 0, a: {
              tech: {
                w: this.symbolPieWeights.tech, s: 0, a: {
                  oscillators: { w: 0, s: 0, a: {} },
                  candlesticks: { w: 0, s: 0, a: {} },
                  moveBack: { w: 0, s: 0, a: {} },
                  cross: { w: 0, s: 0 },
                  priceChange: { w: 0, s: 0 }
                }
              }
            }
          }

          const intervalCollector = this.dataCollector.pairs[pair][interval]
          const techCollector = intervalCollector.a.tech
          const collector = techCollector.a

          const prevOptimalScore: number | null = this.prevOptimalScore[pair]
          const prevData = prevOptimalScore ? this.prevData.pairs[pair][interval].a.tech.a : collector

          const { crossScore: cross, moveBackScore: moveBack } = MovingAverages(
            candles,
            collector.moveBack.a,
            collector.cross,
            prevData.moveBack.a,
            // prevData.cross,
            prevOptimalScore
          )

          const oscillators = Oscillators(
            candles,
            collector.oscillators.a,
            prevData.oscillators.a,
            prevOptimalScore
          )._score

          const candlesticks = CandleStickAnalysis(
            candles,
            collector.candlesticks.a,
            prevData.candlesticks.a,
            prevOptimalScore
          )._score

          const priceChange = PriceChangeAnalysis(candles)

          collector.moveBack.s = moveBack
          collector.oscillators.s = oscillators
          collector.candlesticks.s = candlesticks
          collector.priceChange.s = priceChange

          const weights = prevOptimalScore !== null
            ? addMachineLearningWeights(
              prevOptimalScore,
              Object.entries(prevData).map(([name, { s, w }]) => ({ name, prevData: { s, w } }))
            ).reduce((acc, [name, weight]) => {
              acc[name] = weight
              return acc
            }, {})
            : this.initTechAnalysisWeights

          const techScore = (
            (oscillators * weights['oscillators'])
            + (candlesticks * weights['candlesticks'])
            + (moveBack * weights['moveBack'])
            + (cross * weights['cross'])
            + (priceChange * weights['priceChange'])
          )

          techCollector.s = techScore
          collector.oscillators.w = this.initTechAnalysisWeights.oscillators
          collector.candlesticks.w = this.initTechAnalysisWeights.candlesticks
          collector.moveBack.w = this.initTechAnalysisWeights.moveBack
          collector.cross.w = this.initTechAnalysisWeights.cross
          collector.priceChange.w = this.initTechAnalysisWeights.priceChange

          intervalCollector.s = techScore
          intervalCollector.w = this.intervalWeights[pair][intervalIdx]

          this.techPairScore[pair] += techScore * this.intervalWeights[pair][intervalIdx]

        }))
      })


    })

    await Promise.all(techAnalysisPromises)

    this.apiCalls = techAnalysisPromises.length

    /** this.marketScore[quoteSymbol | altsMarket] = */
    const qen = this.marketSymbols.length
    for (let i = 0; i < qen; i++) {
      const quoteSymbol = this.marketSymbols[i]

      const [baseScore, quoteScore] = this.pairsPerSymbol[quoteSymbol]
      .filter(pair => pair.quoteAsset === quoteSymbol)
      .reduce((acc, pair, _, src) => {
        const quoteScore = -(this.techPairScore[pair.symbol] - 0.5) * 2
        return quoteScore < 0
          ? [acc[0] - quoteScore / src.length, acc[1]]
          : [acc[0], acc[1] + quoteScore / src.length]
      }, [0, 0])

      const quoteMultiplier = Math.sqrt(quoteScore)
      const baseMultiplier = Math.sqrt(baseScore)

      this.marketScore[quoteSymbol] = {
        quoteSymbol,
        score: quoteScore,
        multiplier: quoteMultiplier,
        poweredScore: quoteScore + quoteMultiplier,
        battleScore: quoteScore + quoteMultiplier
      }

      this.marketScore['ALTS'].score += baseScore / qen
      this.marketScore['ALTS'].multiplier += baseMultiplier / qen
      this.marketScore['ALTS'].poweredScore += (baseScore + baseMultiplier) / qen
      this.marketScore['ALTS'].battleScore += (baseScore + baseMultiplier) / qen

    }

    for (let i = 0; i < qen; i++) {
      const quoteSymbol = this.marketSymbols[i]
      this.pairsPerSymbol[quoteSymbol].forEach(pair => {
        if (this.marketSymbols.includes(pair.baseAsset) && pair.quoteAsset === quoteSymbol) {
          this.marketScore[pair.baseAsset].battleScore = this.marketScore[pair.baseAsset].poweredScore
          this.marketScore[pair.quoteAsset].battleScore = this.marketScore[pair.quoteAsset].poweredScore

          const baseTechScore = (this.techPairScore[pair.symbol] - 0.5) * 2
          this.marketScore[pair.baseAsset].battleScore += baseTechScore
          this.marketScore[pair.quoteAsset].battleScore -= baseTechScore
        }
      })
    }

    for (let i = 0; i < qen; i++) {
      const quoteSymbol = this.marketSymbols[i]
      this.marketScore[quoteSymbol].battleScore = this.marketScore[quoteSymbol].battleScore < 0 ? 0 : this.marketScore[quoteSymbol].battleScore
    }

    for (let i = 0; i < qen; i++) {
      logger.addMarketAnalysis(this.marketScore[this.marketSymbols[i]])
    }
    logger.addMarketAnalysis(this.marketScore['ALTS'])
    logger.marketAnalysis()

    /** this.techSymbolScore[symbol] = */
    /** this.marketSymbolScore[symbol] = */
    const pen = this.pairs.length
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


      logger.addPairAnalysis({
        pair: pair.symbol,
        side,
        score: this.techPairScore[pair.symbol],
        symbolScore: this.marketPairCollectorScore[pair.symbol]
      })

    }
    logger.pairAnalysis()

    await newsAnalysisPromise
    logger.newsPosts()

    this.dataCollector.symbols = {}
    this.dataCollector.market = {}

    const sen = this.symbols.length
    for (let i = 0; i < sen; i++) {
      const symbol = this.symbols[i]

      const newsScore = this.newsScore.symbolAnalysis[symbol] < 0 ? 0 : this.newsScore.symbolAnalysis[symbol]
      this.dataCollector.symbols[symbol] = {
        news: {
          w: this.symbolPieWeights.news,
          s: newsScore
        }
      }

      const marketSymbol = this.marketSymbols.includes(symbol) ? symbol : 'ALTS'
      this.dataCollector.market[marketSymbol] = {
        w: this.symbolPieWeights.markets,
        s: this.marketScore[marketSymbol].battleScore
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
    logger.addTime({ item: 'analysis', time: Date.now() - start })
  }
}

export default Analysis