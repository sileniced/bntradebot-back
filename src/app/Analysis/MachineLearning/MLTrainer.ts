import User from '../../../entities/User'

import { Symbol } from 'binance-api-node'
import {
  CandleStickData,
  CandleStickLevelSW,
  IntervalData,
  IntervalDataSWA,
  MoveBackSW,
  OscillatorSW,
  PairData,
  TechAnalysis
} from '../../../entities/ScoresWeightsEntityV1'
import BinanceApi from '../../Binance'
import StockData from 'technicalindicators/declarations/StockData'
import Analysis from '../index'
import PairWeightsEntityV1 from '../../../entities/PairWeightsEntityV1'
import { calcWeight } from './mlWeightUtils'
import {
  CandlestickIdxs,
  CandlestickNames,
  EmaMoveBackNames,
  MoveBackIdxs,
  OscillatorIdxs,
  OscillatorNames,
  SmaMoveBackNames
} from '../utils'
import { calcScore, CandleStickAnalysisML, CandleStickLevels, sigmoid } from '../CandleStickAnalysis'
import { MovingAveragesML } from '../MovingAverages'
import { OscillatorsML } from '../Oscillators'
import PriceChangeAnalysis from '../PriceChangeAnalysis'
import { initWeights } from './utils'

// import * as util from 'util'

interface IMachineLearningTrainer {
  startTraining: () => void
}

const firstTradeDay = {
  'BTCUSDT': '08/17/2017',
  'ETHUSDT': '08/17/2017',
  'BNBUSDT': '11/06/2017',
  'NEOUSDT': '11/20/2017',
  'LTCUSDT': '12/13/2017',
  'EOSUSDT': '05/28/2018',
  'IOTAUSDT': '05/31/2018',
  // 'BCHABCUSDT': '11/16/2018',

  'ETHBTC': '07/14/2017',
  'LTCBTC': '07/14/2017',
  'BNBBTC': '07/14/2017',
  'NEOBTC': '07/14/2017',
  'IOTABTC': '09/30/2017',
  'EOSBTC': '10/11/2017',
  // 'BCHABCBTC': '11/16/2018',

  'EOSETH': '07/27/2017',
  'BNBETH': '08/09/2017',
  'NEOETH': '09/28/2017',
  'IOTAETH': '09/30/2017',
  'LTCETH': '12/13/2017',

  'NEOBNB': '11/20/2017',
  'IOTABNB': '11/28/2017',
  'LTCBNB': '12/13/2017',
  'EOSBNB': '05/28/2018'
}

function shuffle(array): any[] {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]] // swap elements
  }
  return array
}

class MLTrainer implements IMachineLearningTrainer {

  private pairsTrained = 0
  private pairsCorrect = 0

  private readonly Binance: BinanceApi

  private activateTrainingUsers: { [id: number]: User } = {}
  private activePairs: {
    [pair: string]: {
      users: number[]
      info: Symbol
      weights: PairData
    }
  } = {}

  constructor(Binance: BinanceApi) {
    this.Binance = Binance
  }

  // private show = true

  private trainingExecute = async (): Promise<void> => {
    const selectedPairs = shuffle(Object.keys(this.activePairs)).slice(-5)
    const now = Date.now() - (1000 * 60 * 10)

    let history = {}

    /**
     * SELECT TRAINING TIME
     */
    const participantPairs = selectedPairs.filter(pair => {
      const firstTrainDay = new Date(firstTradeDay[pair]).getTime() + (1000 * 60 * 60 * 24 * 200)
      if (firstTrainDay > now) return false
      history[pair] = Math.round(firstTrainDay + (Math.random() * (now - firstTrainDay)))
      return true
    })


    /**
     *
     */
    const prevOptimalScorePromises: Promise<number>[] = participantPairs.map(pair => {
      return MLTrainer.getPrevOptimalScorePromise(pair, this.Binance, history[pair])
    })

    await Promise.all(prevOptimalScorePromises)
    .then((prevOptimalScores => {
      participantPairs.forEach((pair, idx) => {
        this.activePairs[pair].weights.o = prevOptimalScores[idx]
      })
    }))

    const techAnalysisPromises: Promise<void>[] = []
    participantPairs.forEach(pair => {
      const optimalScore = this.activePairs[pair].weights.o
      Analysis.intervalList.forEach(interval => {
        techAnalysisPromises.push(this.Binance.getCandlesStockData(pair, interval, 200, history[pair])
        .then((candles: StockData) => {

          let techAnalysis: TechAnalysis = this.activePairs[pair].weights.a[interval].a.tech.a

          // if (this.show) {
          //   // console.log('before techAnalysis = ', pair, interval)
          //   // console.log(util.inspect(techAnalysis, false, null, true))
          // }

          MLTrainer.MovingAverages(candles, techAnalysis, optimalScore) // moveBack & cross
          MLTrainer.PriceChange(candles, techAnalysis, optimalScore)
          MLTrainer.Oscillators(candles, techAnalysis, optimalScore)
          MLTrainer.CandleSticks(candles, techAnalysis, optimalScore)

          // if (this.show) {
          //   // console.log('after techAnalysis = ', pair, interval)
          //   // console.log(util.inspect(techAnalysis, false, null, true))
          //   this.show = false
          // }

        })
        .catch((e) => {
          console.error(e)
          throw e
        }))
      })
    })

    await Promise.all(techAnalysisPromises)

    // console.log('after promise:', participatingPairs[0], Analysis.intervalList[0])
    // console.log(util.inspect(this.activePairs[participatingPairs[0]].weights.a[Analysis.intervalList[0]].a.tech.a, false, null, true))

    participantPairs.forEach(pair => {

      let pairData = this.activePairs[pair].weights
      const optimalScore = pairData.o

      MLTrainer.setIntervalWeightsAndPairScore(
        pairData,
        optimalScore,
        this.activePairs[pair].weights.a
      )

    })

    // console.log(util.inspect(this.activePairs[participatingPairs[0]], false, null, true))

    if (this.pairsTrained > 1000) {
      this.pairsTrained = 0
      this.pairsCorrect = 0
    }

    this.pairsTrained += participantPairs.length

    console.table(participantPairs.map(pair => {
      const correct = (this.activePairs[pair].weights.s > 0.5 && this.activePairs[pair].weights.o > 0.5) || (this.activePairs[pair].weights.s < 0.5 && this.activePairs[pair].weights.o < 0.5)
      this.pairsCorrect += correct ? 1 : 0
      return {
        pair,
        trainDate: new Date(history[pair]),
        score: this.activePairs[pair].weights.s,
        optimal: this.activePairs[pair].weights.o,
        correct
      }
    }))

    console.log(this.pairsCorrect, this.pairsTrained, `correct: ${Math.round((this.pairsCorrect / this.pairsTrained) * 100)}%`)

    const updatePairsPromises: Promise<any>[] = []

    participantPairs.forEach(pair => {
      PairWeightsEntityV1.find({ where: { pairName: pair } })
      .then((result: PairWeightsEntityV1[]): PairWeightsEntityV1 => result[0])
      .then(pairEntity => {
        pairEntity.weights = this.activePairs[pair].weights.a
        updatePairsPromises.push(pairEntity.save())
      })
    })

    await Promise.all(updatePairsPromises)
  }

  static sumIntervalScoresAndSumPairScore = (pairData: { [interval: string]: IntervalDataSWA }) => {
    return Analysis.intervalList.reduce((acc, interval) => {
      let techAnalysis: TechAnalysis = pairData[interval].a.tech.a
      return acc + MLTrainer.techNames.reduce((acc, name) => {
        return acc + (techAnalysis[name].s * techAnalysis[name].w)
      }, 0)
    }, 0)
  }

  static setIntervalWeightsAndPairScore(
    pairData: PairData,
    optimalScore: number,
    intervalData: { [interval: string]: IntervalDataSWA }
  ) {
    const intervalTotalWeights = Analysis.intervalList.reduce((acc, interval) => {
      let intervalAnalysis: IntervalDataSWA = intervalData[interval]
      let techAnalysis: TechAnalysis = intervalAnalysis.a.tech.a

      const techTotalWeights = this.techNames.reduce((acc, name) => {
        return acc + techAnalysis[name].w
      }, 0)

      intervalAnalysis.s = this.techNames.reduce((acc, name) => {
        techAnalysis[name].w /= techTotalWeights
        return acc + (techAnalysis[name].s * techAnalysis[name].w)
      }, 0)

      intervalAnalysis.w = calcWeight(
        intervalAnalysis.s,
        intervalAnalysis.w,
        optimalScore
      )

      return acc + intervalAnalysis.w
    }, 0)

    pairData.s = Analysis.intervalList.reduce((acc, interval) => {
      let intervalAnalysis: IntervalDataSWA = intervalData[interval]
      intervalAnalysis.w /= intervalTotalWeights
      return acc + (intervalAnalysis.s * intervalAnalysis.w)
    }, 0)
  }

  private static techNames = ['oscillators', 'candlesticks', 'moveBack', 'cross', 'priceChange']

  static getPrevOptimalScorePromise(pair, Binance: BinanceApi, history?: number) {
    let optimalScore = 0.5
    return Binance.getCandlesStockData(
      pair,
      '5m',
      15,
      history && history + (1000 * 60 * 10)
    ).then((candles: StockData) => {
      const [current, , future] = candles.close.slice(-3)
      optimalScore = Analysis.getPrevOptimalScore(
        Analysis.getPrevOptimalSmaScore(candles),
        Analysis.getPriceChangeScore(current, future)
      )
      return Binance.getCandlesStockData(
        pair,
        '1h',
        15,
        history && history + (1000 * 60 * 10)
      )
    })
    .then((candles: StockData) => {
      return Analysis.getPrevOptimalScore(
        Analysis.getPrevOptimalSmaScore(candles),
        optimalScore
      )
    })
    .catch(error => {
      console.error(error)
      return optimalScore
    })
  }

  private static MovingAverages(candles: StockData, techAnalysis: TechAnalysis, optimalScore) {
    let moveBackData = MLTrainer.getMovingAveragesScores(candles, techAnalysis)
    MLTrainer.setMovingAveragesWeights(moveBackData, moveBackData, optimalScore, techAnalysis)
  }

  static getMovingAveragesScores(
    candles: StockData,
    techAnalysis: TechAnalysis
  ) {
    return MovingAveragesML(
      candles,
      techAnalysis.moveBack.a,
      techAnalysis.cross
    )
  }

  static sumMovingAveragesScore = moveBackData => {
    const emaMoveBackScore = EmaMoveBackNames.reduce((acc, [name]) => {
      const { s: score, w: weight } = moveBackData[MoveBackIdxs[name]]
      return acc + (score * weight)
    }, 0)

    const smaMoveBackScore = SmaMoveBackNames.reduce((acc, [name]) => {
      const { s: score, w: weight } = moveBackData[MoveBackIdxs[name]]
      return acc + (score * weight)
    }, 0)

    return (emaMoveBackScore + smaMoveBackScore) / 2
  }

  static setMovingAveragesWeights(
    moveBackDataWeights: MoveBackSW,
    moveBackDataScores: MoveBackSW,
    optimalScore: number,
    techAnalysis: TechAnalysis
  ) {

    // moveBack
    const emaMoveBackTotalWeights = EmaMoveBackNames.reduce((acc, [name]) => {
      const score = moveBackDataScores[MoveBackIdxs[name]].s
      let weight = moveBackDataWeights[MoveBackIdxs[name]].w
      weight = calcWeight(score ? 0.75 : 0.25, weight, optimalScore)
      return acc + weight
    }, 0)

    const smaMoveBackTotalWeights = SmaMoveBackNames.reduce((acc, [name]) => {
      const score = moveBackDataScores[MoveBackIdxs[name]].s
      let weight = moveBackDataWeights[MoveBackIdxs[name]].w
      weight = calcWeight(score ? 0.75 : 0.25, weight, optimalScore)
      return acc + weight
    }, 0)

    const emaMoveBackScore = EmaMoveBackNames.reduce((acc, [name]) => {
      const score = moveBackDataScores[MoveBackIdxs[name]].s
      let weight = moveBackDataWeights[MoveBackIdxs[name]].w
      weight /= emaMoveBackTotalWeights
      return acc + (score * weight)
    }, 0)

    const smaMoveBackScore = SmaMoveBackNames.reduce((acc, [name]) => {
      const score = moveBackDataScores[MoveBackIdxs[name]].s
      let weight = moveBackDataWeights[MoveBackIdxs[name]].w
      weight /= smaMoveBackTotalWeights
      return acc + (score * weight)
    }, 0)

    techAnalysis.moveBack.s = (emaMoveBackScore + smaMoveBackScore) / 2
    techAnalysis.moveBack.w = calcWeight(
      techAnalysis.moveBack.s,
      techAnalysis.moveBack.w,
      optimalScore
    )

    // cross
    techAnalysis.cross.w = calcWeight(
      techAnalysis.cross.s,
      techAnalysis.cross.w,
      optimalScore
    )
  }

  private static Oscillators(candles: StockData, techAnalysis: TechAnalysis, optimalScore) {
    let oscillatorData = MLTrainer.getOscillatorScores(candles, techAnalysis)
    MLTrainer.setOscillatorWeights(oscillatorData, oscillatorData, optimalScore, techAnalysis)
  }

  static getOscillatorScores(candles: StockData, techAnalysis: TechAnalysis) {
    return OscillatorsML(
      candles,
      techAnalysis.oscillators.a
    )
  }

  static sumOscillatorsScore = oscillatorData => OscillatorNames.reduce((acc, name) => {
    const { s: score, w: weight } = oscillatorData[OscillatorIdxs[name]]
    return acc + (score * weight)
  }, 0)


  static setOscillatorWeights(
    oscillatorDataWeights: OscillatorSW,
    oscillatorDataScores: OscillatorSW,
    optimalScore: number,
    techAnalysis: TechAnalysis
  ) {
    const oscillatorTotalWeights = OscillatorNames.reduce((acc, name) => {
      let weight = oscillatorDataWeights[OscillatorIdxs[name]].w
      const score = oscillatorDataScores[OscillatorIdxs[name]].s
      weight = calcWeight(score, weight, optimalScore)
      return acc + weight
    }, 0)

    techAnalysis.oscillators.s = OscillatorNames.reduce((acc, name) => {
      let weight = oscillatorDataWeights[OscillatorIdxs[name]].w
      const score = oscillatorDataScores[OscillatorIdxs[name]].s
      weight /= oscillatorTotalWeights
      return acc + (score * weight)
    }, 0)

    techAnalysis.oscillators.w = calcWeight(
      techAnalysis.oscillators.s,
      techAnalysis.oscillators.w,
      optimalScore
    )
  }

  private static PriceChange(candles: StockData, techAnalysis: TechAnalysis, optimalScore) {
    techAnalysis.priceChange.s = PriceChangeAnalysis(candles)
    MLTrainer.setPriceChangeWeights(techAnalysis, techAnalysis, optimalScore)
  }

  static setPriceChangeWeights(
    techAnalysisWeight: TechAnalysis,
    techAnalysisScore: TechAnalysis,
    optimalScore: number
  ) {
    techAnalysisWeight.priceChange.w = calcWeight(
      techAnalysisScore.priceChange.s,
      techAnalysisWeight.priceChange.w,
      optimalScore
    )
  }

  private static CandleSticks(candles: StockData, techAnalysis: TechAnalysis, optimalScore) {
    let candleStickData = MLTrainer.getCandleStickScore(candles, techAnalysis)
    MLTrainer.setCandleSticksWeights(candleStickData, candleStickData, optimalScore, techAnalysis)
  }

  static getCandleStickScore(candles: StockData, techAnalysis: TechAnalysis) {
    return CandleStickAnalysisML(
      candles,
      techAnalysis.candlesticks.a
    )
  }

  static sumCandleStickScores = candleStickData => {
    return CandleStickLevels.reduce((acc, [level]) => {
      const levelData = candleStickData[level]

      const bullishScore = CandlestickNames.bullish.reduce((acc, name) => {
        const { s: score, w: weight } = levelData.a.bullish[CandlestickIdxs.bullish[name]]
        acc.score += score ? weight * sigmoid(acc.count, CandlestickNames.bullish.length) : 0
        acc.count += score
        return acc
      }, {
        score: 0,
        count: 0
      }).score

      const bearishScore = CandlestickNames.bearish.reduce((acc, name) => {
        const { s: score, w: weight } = levelData.a.bearish[CandlestickIdxs.bearish[name]]
        acc.score += score ? weight * sigmoid(acc.count, CandlestickNames.bearish.length) : 0
        acc.count += score
        return acc
      }, {
        score: 0,
        count: 0
      }).score

      levelData.s = calcScore(bullishScore, bearishScore)

      return acc + (levelData.s * levelData.w)
    }, 0)
  }

  static setCandleSticksWeights(
    candleStickDataWeights: CandleStickData,
    candleStickDataScores: CandleStickData,
    optimalScore: number,
    techAnalysis: TechAnalysis
  ) {
    const candleStickLevelTotalWeights = CandleStickLevels.reduce((acc, [level]) => {
      let levelDataWeights: CandleStickLevelSW = candleStickDataWeights[level]
      const levelDataScores: CandleStickLevelSW = candleStickDataScores[level]

      const bullishTotalWeights = CandlestickNames.bullish.reduce((acc, name) => {
        let weight = levelDataWeights.a.bullish[CandlestickIdxs.bullish[name]].w
        const score = levelDataScores.a.bullish[CandlestickIdxs.bullish[name]].s
        weight = calcWeight(score ? 0.51 : 0, weight, optimalScore)
        return acc + weight
      }, 0)

      const bullishScore = CandlestickNames.bullish.reduce((acc, name) => {
        let weight = levelDataWeights.a.bullish[CandlestickIdxs.bullish[name]].w
        const score = levelDataScores.a.bullish[CandlestickIdxs.bullish[name]].s
        weight /= bullishTotalWeights
        acc.score += score ? weight * sigmoid(acc.count, CandlestickNames.bullish.length) : 0
        acc.count += score
        return acc
      }, {
        score: 0,
        count: 0
      }).score

      const bearishTotalWeights = CandlestickNames.bearish.reduce((acc, name) => {
        let weight = levelDataWeights.a.bearish[CandlestickIdxs.bearish[name]].w
        const score = levelDataScores.a.bearish[CandlestickIdxs.bearish[name]].s
        weight = calcWeight(score ? 0.51 : 0, weight, optimalScore)
        return acc + weight
      }, 0)

      const bearishScore = CandlestickNames.bearish.reduce((acc, name) => {
        let weight = levelDataWeights.a.bearish[CandlestickIdxs.bearish[name]].w
        const score = levelDataScores.a.bearish[CandlestickIdxs.bearish[name]].s
        weight /= bearishTotalWeights
        acc.score += score ? weight * sigmoid(acc.count, CandlestickNames.bearish.length) : 0
        acc.count += score
        return acc
      }, {
        score: 0,
        count: 0
      }).score

      // if (this.show) {
      //   // console.log('bear:', bearishScore, 'bull:', bullishScore)
      // }

      levelDataWeights.s = calcScore(bullishScore, bearishScore)
      levelDataWeights.w = calcWeight(levelDataWeights.s, levelDataWeights.w, optimalScore)
      return acc + levelDataWeights.w
    }, 0)

    techAnalysis.candlesticks.s = CandleStickLevels.reduce((acc, [level]) => {
      let data: CandleStickLevelSW = candleStickDataWeights[level]
      data.w /= candleStickLevelTotalWeights
      return acc + (data.s * data.w)
    }, 0)

    techAnalysis.candlesticks.w = calcWeight(
      techAnalysis.candlesticks.s,
      techAnalysis.candlesticks.w,
      optimalScore
    )
  }

  private getInitWeights = (pair): IntervalData => {
    const data = initWeights()

    PairWeightsEntityV1.create({
      pairName: pair,
      weights: data
    }).save().catch(console.error)

    return data
  }

  public startTraining = async (): Promise<void> => {

    const allPairs = await this.Binance.getPairs()
    const users = await User.find({ where: { autoTrading: true } })

    let pairWeightsPromises: Promise<void>[] = []

    users.forEach(user => {
      this.activateTrainingUsers[user.id] = user
      allPairs
      .filter(pair => user.symbols.includes(pair.baseAsset) && user.symbols.includes(pair.quoteAsset))
      .forEach(pair => {
        if (!this.activePairs[pair.symbol]) {
          pairWeightsPromises.push(PairWeightsEntityV1.find({ where: { pairName: pair.symbol } }).then(pairWeights => {
            this.activePairs[pair.symbol] = {
              users: [user.id],
              info: pair,
              weights: {
                a: pairWeights[0] ? pairWeights[0].weights : this.getInitWeights(pair.symbol),
                o: 0.5,
                s: 0.5
              }
            }
          }))
        } else {
          this.activePairs[pair.symbol].users.push(user.id)
        }
      })
    })

    await Promise.all(pairWeightsPromises)

    // this.trainingExecute().catch(console.error)
    setInterval(this.trainingExecute, 12000)
  }

}

export default MLTrainer