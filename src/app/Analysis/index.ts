import { CandleChartInterval, OrderSide, Symbol } from 'binance-api-node'

import StockData from 'technicalindicators/declarations/StockData'
import Oscillators from './Oscillators'
import MovingAverages from './MovingAverages'
import CandleStickAnalysis from './CandleStickAnalysis'
import AnalysisNews from './NewsAnalysis'
import Logger from '../../services/Logger'
import PriceChangeAnalysis from './PriceChangeAnalysis'
import { IntervalData, ScoresWeightsEntityV1Model } from '../../entities/ScoresWeightsEntityV1'
import { MoveBackIdxs, CandlestickIdxs, OscillatorIdxs } from './utils'
import { addMachineLearningWeights, MachineLearningData } from './mlWeightUtils'
import { SMA } from 'technicalindicators'
import BinanceApi from '../Binance'

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
  battleWins: number
}

export interface IAnalysis {
  run(logger: Logger, Binance: BinanceApi): Promise<void>,

  techPairScore: { [pair: string]: number }
  techSymbolScore: { [symbol: string]: number }

  marketScore: { [quoteSymbol: string]: MarketAnalysisResult }
  marketSymbolScore: { [symbol: string]: number }

  assignedPair: { [pair: string]: AssignedPair }

  newsScore: AnalysisNews
  symbolPie: { [pair: string]: number }
}

class Analysis implements IAnalysis {

  static getPrevOptimalScore = (sma, priceChange) => (sma * 0.8) + (priceChange * 0.2)

  static getPriceChangeScore = (previous, current) => {
    const change = (current - previous) / previous
    if (change > 0) {
      const quote = Math.sqrt(change)
      return quote > 0.5 ? 1 : 0.5 + quote
    } else {
      const quote = Math.sqrt(-change)
      return quote > 0.5 ? 0 : 0.5 - quote
    }
  }

  static getPrevOptimalSmaScore = (candles: StockData, period = 12) => {
    const [previous, current] = SMA.calculate({
      values: candles.close,
      period
    }).slice(-2)

    return Analysis.getPriceChangeScore(previous, current)
  }

  private readonly pairsInfo: Symbol[] = []
  public apiCalls: number = 0

  // todo: user custom (list and weights)
  static readonly intervalList: CandleChartInterval[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d']

  static readonly initIntervalWeights: number[] = [0.008, 0.016, 0.032, 0.032, 0.064, 0.128, 0.096, 0.048, 0.096, 0.144, 0.192, 0.144]
  private intervalWeights: { [pair: string]: number[] } = {}
  static readonly initTechAnalysisWeights = {
    candlesticks: 0.109,
    oscillators: 0.219,
    moveBack: 0.181,
    cross: 0.256,
    priceChange: 0.235
  }
  static readonly symbolPieWeights = { tech: 0.5, news: 0.05, markets: 0.45 }

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
      moveBack: MoveBackIdxs,
      candlesticks: CandlestickIdxs,
      oscillators: OscillatorIdxs
    }
  }

  private readonly prevData: ScoresWeightsEntityV1Model
  private readonly prevOptimalPriceChangeScore: { [pair: string]: number | null }
  private prevOptimalSMAScore: { [pair: string]: number } = {}
  public prevOptimalScore: { [pair: string]: number } = {}

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
      battleScore: 0,
      battleWins: 0
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
    this.prevOptimalPriceChangeScore = prevOptimalScore
  }

  public async run(logger: Logger, Binance: BinanceApi): Promise<void> {
    const start = Date.now()
    this.newsScore = new AnalysisNews({ symbols: this.symbols })
    const newsAnalysisPromise = this.newsScore.run(logger)

    this.dataCollector.pairs = {}

    const prevOptimalSMAScorePromises: Promise<void>[] = []

    /** this.prevOptimalScore[pair] = */
    this.pairs.forEach(pair => {
      prevOptimalSMAScorePromises.push(Binance.getCandlesStockData(pair, '5m', 15)
      .then((candles: StockData) => {

        if (!this.dataCollector.pairs) return
        this.dataCollector.pairs[pair] = {
          o: Analysis.getPrevOptimalSmaScore(candles),
          s: 0,
          a: {}
        }

        const prevOptimalPriceChangeScore = this.prevOptimalPriceChangeScore[pair]
        if (prevOptimalPriceChangeScore !== null) {
          const prevOptimalScore: number = Analysis.getPrevOptimalScore(this.prevOptimalSMAScore[pair], prevOptimalPriceChangeScore)

          const prevIntervalData: IntervalData = this.prevData.pairs[pair].a
          this.dataCollector.pairs[pair].o = prevOptimalScore
          this.prevOptimalScore[pair] = prevOptimalScore

          this.intervalWeights[pair] = []
          addMachineLearningWeights(prevOptimalScore, Object.entries(prevIntervalData).map(([interval, { w, s }]): MachineLearningData => ({
            name: interval,
            prevData: { w, s }
          }))).forEach(([interval, weight]) => {
            this.intervalWeights[pair][Analysis.intervalList.indexOf(interval as CandleChartInterval)] = weight
          })
        } else {
          this.intervalWeights[pair] = Analysis.initIntervalWeights
          this.prevOptimalScore[pair] = this.prevOptimalSMAScore[pair]
        }
      }))
    })

    await Promise.all(prevOptimalSMAScorePromises)

    const techAnalysisPromises: Promise<void>[] = []

    /** this.techPairScore[pair] = */
    this.pairs.forEach(pair => {
      Analysis.intervalList.forEach((interval, intervalIdx) => {
        techAnalysisPromises.push(Binance.getCandlesStockData(pair, interval)
        .then((candles: StockData) => {
          if (!this.dataCollector.pairs) return
          this.dataCollector.pairs[pair].a[interval] = {
            w: 0, s: 0, a: {
              tech: {
                w: Analysis.symbolPieWeights.tech, s: 0, a: {
                  oscillators: { w: 0, s: 0, a: {} },
                  candlesticks: { w: 0, s: 0, a: {} },
                  moveBack: { w: 0, s: 0, a: {} },
                  cross: { w: 0, s: 0 },
                  priceChange: { w: 0, s: 0 }
                }
              }
            }
          }

          const intervalCollector = this.dataCollector.pairs[pair].a[interval]
          const techCollector = intervalCollector.a.tech
          const collector = techCollector.a

          const prevOptimalPriceChangeScore: number | null = this.prevOptimalPriceChangeScore[pair]

          const prevOptimalScore: number | null =
            prevOptimalPriceChangeScore !== null
              ? Analysis.getPrevOptimalScore(this.prevOptimalSMAScore[pair], prevOptimalPriceChangeScore)
              : null

          const prevData =
            prevOptimalScore
              ? this.prevData.pairs[pair].a[interval].a.tech.a
              : collector

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
              Object.entries(prevData).map(([name, { s, w }]): MachineLearningData => ({
                name,
                prevData: {
                  s,
                  w
                }
              }))
            ).reduce((acc, [name, weight]) => {
              acc[name] = weight
              return acc
            }, {})
            : Analysis.initTechAnalysisWeights

          const techScore = (
            (oscillators * weights['oscillators'])
            + (candlesticks * weights['candlesticks'])
            + (moveBack * weights['moveBack'])
            + (cross * weights['cross'])
            + (priceChange * weights['priceChange'])
          )

          techCollector.s = techScore
          collector.oscillators.w = Analysis.initTechAnalysisWeights.oscillators
          collector.candlesticks.w = Analysis.initTechAnalysisWeights.candlesticks
          collector.moveBack.w = Analysis.initTechAnalysisWeights.moveBack
          collector.cross.w = Analysis.initTechAnalysisWeights.cross
          collector.priceChange.w = Analysis.initTechAnalysisWeights.priceChange

          intervalCollector.s = techScore
          intervalCollector.w = this.intervalWeights[pair][intervalIdx]

          this.techPairScore[pair] += techScore * this.intervalWeights[pair][intervalIdx]

        })
        .catch((e) => {
          console.error(e)
          throw e
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
        battleScore: quoteScore + quoteMultiplier,
        battleWins: 0
      }

      this.marketScore['ALTS'].score += baseScore / qen
      this.marketScore['ALTS'].multiplier += baseMultiplier / qen
      this.marketScore['ALTS'].poweredScore += (baseScore + baseMultiplier) / qen
      this.marketScore['ALTS'].battleScore += (baseScore + baseMultiplier) / qen

    }

    /** battledScore */
    this.marketSymbols.forEach(quoteSymbol => {
      this.pairsPerSymbol[quoteSymbol].forEach(pair => {
        if (this.marketSymbols.includes(pair.baseAsset) && pair.quoteAsset === quoteSymbol) {
          this.marketScore[pair.baseAsset].battleScore = this.marketScore[pair.baseAsset].poweredScore
          this.marketScore[pair.quoteAsset].battleScore = this.marketScore[pair.quoteAsset].poweredScore

          const baseTechScore = (this.techPairScore[pair.symbol] - 0.5) * 2
          this.marketScore[pair.baseAsset].battleScore += baseTechScore
          this.marketScore[pair.quoteAsset].battleScore -= baseTechScore

          this.marketScore[baseTechScore > 0 ? pair.baseAsset : pair.quoteAsset].battleWins++
        }
      })
    })

    this.marketSymbols
    .sort((quoteSymbolA, quoteSymbolB) => {
      if (this.marketScore[quoteSymbolA].battleWins === this.marketScore[quoteSymbolB].battleWins) {
        return this.marketScore[quoteSymbolA].score - this.marketScore[quoteSymbolB].score
      }
      return this.marketScore[quoteSymbolA].battleWins - this.marketScore[quoteSymbolB].battleWins
    })
    .forEach((quoteSymbol, idx, src) => {
      const { battleWins, battleScore } = this.marketScore[quoteSymbol]
      this.marketScore[quoteSymbol].battleScore = battleScore < 0 ? 0 : battleWins * battleScore
      if (this.marketScore[quoteSymbol].battleScore !== 0 && src[idx + 1]) {
        const nextMarket = this.marketScore[src[idx + 1]]
        if (nextMarket.battleWins > battleWins) {
          const stolenScore = this.marketScore[quoteSymbol].battleScore * Math.pow(battleWins / nextMarket.battleWins, 2)
          this.marketScore[quoteSymbol].battleScore -= stolenScore
          this.marketScore[src[idx + 1]].battleScore += stolenScore
        }
      }

    })

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
          w: Analysis.symbolPieWeights.news,
          s: newsScore
        }
      }

      const marketSymbol = this.marketSymbols.includes(symbol) ? symbol : 'ALTS'
      this.dataCollector.market[marketSymbol] = {
        w: Analysis.symbolPieWeights.markets,
        s: this.marketScore[marketSymbol].battleScore
      }

      this.symbolTotals[symbol] += this.marketScore[marketSymbol].battleScore * Analysis.symbolPieWeights.markets
      this.symbolTotals[symbol] += this.techSymbolScore[symbol] * Analysis.symbolPieWeights.tech
      this.symbolTotals[symbol] += newsScore * Analysis.symbolPieWeights.news
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