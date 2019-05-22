import { CandleChartInterval, OrderSide, Symbol } from 'binance-api-node'

import StockData from 'technicalindicators/declarations/StockData'
import Logger from '../../services/Logger'
import PriceChangeAnalysis from './PriceChangeAnalysis'
import { PairData } from '../../entities/ScoresWeightsModelV1'
import { SMA } from 'technicalindicators'
import BinanceApi from '../Binance'
import MLTrainer from './MachineLearning/MLTrainer'

export interface AssignedPair {
  pair: string,
  side: OrderSide,
  provider: string,
  collector: string
}

export interface AnalysisInput {
  pairsInfo: Symbol[]
  getNormalizedSymbols: () => { [symbol: string]: number }
  pairData: { [pair: string]: PairData }
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

  // newsScore: AnalysisNews
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
  static readonly initTechAnalysisWeights = {
    candlesticks: 0.109,
    oscillators: 0.219,
    moveBack: 0.181,
    cross: 0.256,
    priceChange: 0.235
  }
  static readonly symbolPieWeights = { tech: 0.8, /*news: 0.05, */markets: 0.2 }

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

  // public newsScore: AnalysisNews
  public symbolPie: { [pair: string]: number } = {}

  private symbolTotals: { [pair: string]: number } = {}
  private allTotals: number = 0

  private pairData: { [pair: string]: PairData }

  private fullBattleScore: string | null = null

  constructor({ pairsInfo, getNormalizedSymbols, pairData }: AnalysisInput) {

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

    this.pairData = pairData
  }

  public async run(logger: Logger, Binance: BinanceApi): Promise<void> {
    const start = Date.now()
    // this.newsScore = new AnalysisNews({ symbols: this.symbols })
    // const newsAnalysisPromise = this.newsScore.run(logger)

    const techAnalysisPromises: Promise<void>[] = []

    /** this.techPairScore[pair] = */
    this.pairs.forEach(pair => {
      Analysis.intervalList.forEach(interval => {
        techAnalysisPromises.push(Binance.getCandlesStockData(pair, interval)
        .then((candles: StockData) => {

          const intervalCollector = this.pairData[pair].a[interval]
          const techAnalysis = intervalCollector.a.tech.a

          MLTrainer.getMovingAveragesScores(candles, techAnalysis)
          MLTrainer.getOscillatorScores(candles, techAnalysis)
          MLTrainer.getCandleStickScore(candles, techAnalysis)
          techAnalysis.priceChange.s = PriceChangeAnalysis(candles)

        })
        .catch((e) => {
          console.error(e)
          throw e
        }))
      })
    })

    await Promise.all(techAnalysisPromises)
    this.pairsInfo.forEach(pair => {
      Analysis.intervalList.forEach(interval => {
        const pairData: PairData = this.pairData[pair.symbol]
        const techAnalysis = pairData.a[interval].a.tech.a
        techAnalysis.moveBack.s = MLTrainer.sumMovingAveragesScore(techAnalysis.moveBack.a)
        techAnalysis.oscillators.s = MLTrainer.sumOscillatorsScore(techAnalysis.oscillators.a)
        techAnalysis.candlesticks.s = MLTrainer.sumCandleStickScores(techAnalysis.candlesticks.a)

        this.techPairScore[pair.symbol] = MLTrainer.sumIntervalScoresAndSumPairScore(pairData.a)
      })
    })

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

    const marketScoreSorted = this.marketSymbols
    .sort((quoteSymbolA, quoteSymbolB) => {
      if (this.marketScore[quoteSymbolA].battleWins === this.marketScore[quoteSymbolB].battleWins) {
        return this.marketScore[quoteSymbolA].score - this.marketScore[quoteSymbolB].score
      }
      return this.marketScore[quoteSymbolA].battleWins - this.marketScore[quoteSymbolB].battleWins
    })

    if (this.marketScore[marketScoreSorted[0]].battleScore === this.marketSymbols.length - 1) {
      this.fullBattleScore = marketScoreSorted[0]
    }

    marketScoreSorted.forEach((quoteSymbol, idx, src) => {
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

    // await newsAnalysisPromise
    // logger.newsPosts()


    const sen = this.symbols.length
    for (let i = 0; i < sen; i++) {
      const symbol = this.symbols[i]

      // const newsScore = this.newsScore.symbolAnalysis[symbol] < 0 ? 0 : this.newsScore.symbolAnalysis[symbol]

      const marketSymbol = this.marketSymbols.includes(symbol) ? symbol : 'ALTS'

      // console.log('this.marketScore[marketSymbol].battleScore = ', symbol, this.marketScore[marketSymbol].battleScore)
      // console.log('this.techSymbolScore[symbol] = ', symbol, this.techSymbolScore[symbol])
      // console.log('this.newsScore.symbolAnalysis[symbol] = ', symbol, this.newsScore.symbolAnalysis[symbol])
      this.symbolTotals[symbol] += this.marketScore[marketSymbol].battleScore * Analysis.symbolPieWeights.markets
      this.symbolTotals[symbol] += this.techSymbolScore[symbol] * Analysis.symbolPieWeights.tech
      // this.symbolTotals[symbol] += newsScore * Analysis.symbolPieWeights.news
      this.allTotals += this.symbolTotals[symbol]
    }

    /** this.symbolPie = */
    for (let i = 0; i < sen; i++) {
      this.symbolPie[this.symbols[i]] += this.symbolTotals[this.symbols[i]] / this.allTotals
    }

    if (typeof this.fullBattleScore === 'string') {
      this.pairsPerSymbol[this.fullBattleScore].forEach(pair => {
        if (pair.quoteAsset === this.fullBattleScore) {
          if (this.techPairScore[pair.symbol] < 0.5) {
            this.symbolPie[pair.quoteAsset] += this.symbolPie[pair.baseAsset]
            this.symbolPie[pair.baseAsset] = 0
          }
        } else {
          if (this.techPairScore[pair.symbol] > 0.5) {
            this.symbolPie[pair.baseAsset] += this.symbolPie[pair.quoteAsset]
            this.symbolPie[pair.quoteAsset] = 0
          }
        }
      })
    }

    logger.addTime({ item: 'analysis', time: Date.now() - start })
  }
}

export default Analysis