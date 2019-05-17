import User from '../entities/User'

import { Symbol } from 'binance-api-node'
import {
  CandleStickData,
  CandleStickBullBear, CandleStickLevelSW,
  IntervalData,
  IntervalDataSWA, OscillatorSW,
  PairData,
  TechAnalysis
} from '../entities/ScoresWeightsEntityV1'
import BinanceApi from './Binance'
import StockData from 'technicalindicators/declarations/StockData'
import Analysis from './Analysis'
import PairWeightsEntityV1 from '../entities/PairWeightsEntityV1'
import { addEVENWeight, addNAIVEWeight, calcWeight } from './Analysis/mlWeightUtils'
import oscillatorsSettings from './Analysis/Oscillators/settings'
import { CandlestickIdxs, CandlestickNames, MoveBackIdxs, OscillatorIdxs, OscillatorNames } from './Analysis/utils'
import {
  bearish,
  bullish, calcScore,
  CandleStickAnalysisML, CandleStickLevels,
  settings as candleSticksSettings, sigmoid
} from './Analysis/CandleStickAnalysis'
import movingAveragesSettings from './Analysis/MovingAverages/settings'
import { MovingAveragesML } from './Analysis/MovingAverages'
import { OscillatorsML } from './Analysis/Oscillators'
import PriceChangeAnalysis from './Analysis/PriceChangeAnalysis'

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
  'BCHABCUSDT': '11/16/2018',

  'ETHBTC': '07/14/2017',
  'LTCBTC': '07/14/2017',
  'BNBBTC': '07/14/2017',
  'NEOBTC': '07/14/2017',
  'IOTABTC': '09/30/2017',
  'EOSBTC': '10/11/2017',
  'BCHABCBTC': '11/16/2018',

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

class MachineLearningTrainer implements IMachineLearningTrainer {

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

  private trainingExecute = async (): Promise<void> => {
    const selectedPairs = shuffle(Object.keys(this.activePairs)).slice(-10)
    const now = Date.now() - (1000 * 60 * 10)

    let history = {}

    /**
     * SELECT TRAINING TIME
     */
    const participatingPairs = selectedPairs.filter(pair => {
      const firstTrainDay = new Date(firstTradeDay[pair]).getTime() + (1000 * 60 * 60 * 24 * 200)
      if (firstTrainDay > now) return false
      history[pair] = Math.round(firstTrainDay + (Math.random() * (now - firstTrainDay)))
      return true
    })

    console.table(history)

    /**
     *
     */
    const prevOptimalScorePromises: Promise<void>[] = participatingPairs.map(pair => {
      return this.Binance.getCandlesStockData(
        pair,
        '5m',
        15,
        history[pair] + (1000 * 60 * 10))
      .then((candles: StockData) => {
        const [current, , future] = candles.close.slice(-3)
        this.activePairs[pair].weights.o = Analysis.getPrevOptimalScore(
          Analysis.getPrevOptimalSmaScore(candles),
          Analysis.getPriceChangeScore(current, future)
        )
      })
    })

    await Promise.all(prevOptimalScorePromises)

    console.table(participatingPairs.reduce((acc, pair) => {
      acc[pair] = this.activePairs[pair].weights.o
      return acc
    }, {}))


    // first get the scores with the current weights
    // use the prevOptimalScore to change the current weights to new weights


    const techAnalysisPromises: Promise<void>[] = []
    selectedPairs.forEach(pair => {
      const optimalScore = this.activePairs[pair].weights.o
        Analysis.intervalList.forEach(interval => {
        techAnalysisPromises.push(this.Binance.getCandlesStockData(pair, interval, 200, history[pair])
        .then((candles: StockData) => {

          const techAnalysis: TechAnalysis = this.activePairs[pair].weights.a[interval].a.tech.a

          MovingAveragesML(
            candles,
            techAnalysis.moveBack.a,
            techAnalysis.cross,
          )


          techAnalysis.priceChange.s = PriceChangeAnalysis(candles)
          techAnalysis.priceChange.w = calcWeight(
            techAnalysis.priceChange.s,
            techAnalysis.priceChange.w,
            optimalScore
          )

          // Oscillators
          const oscillatorData: OscillatorSW = OscillatorsML(
            candles,
            techAnalysis.oscillators.a
          )

          const oscillatorTotalWeights = OscillatorNames.reduce((acc, name) => {
            let data = oscillatorData[OscillatorIdxs[name]]
            data.w = calcWeight(data.s, data.w, optimalScore)
            return acc + data.w
          }, 0)

          techAnalysis.oscillators.s = OscillatorNames.reduce((acc, name) => {
            let data = oscillatorData[OscillatorIdxs[name]]
            data.w /= oscillatorTotalWeights
            return acc + (data.s * data.w)
          }, 0)

          techAnalysis.oscillators.w = calcWeight(
            techAnalysis.oscillators.s,
            techAnalysis.oscillators.w,
            optimalScore
          )

          // candleSticks
          const candleStickData: CandleStickData = CandleStickAnalysisML(
            candles,
            techAnalysis.candlesticks.a
          )

          const candleStickLevelTotalWeights = CandleStickLevels.reduce((acc, level) => {
            let levelData: CandleStickLevelSW = candleStickData[level[0]]

            const bullishTotalWeights = CandlestickNames.bullish.reduce((acc, name) => {
              let data = levelData.a.bullish[CandlestickIdxs.bullish[name]]
              data.w = calcWeight(data.s ? 0.51 : 0, data.w, optimalScore)
              return acc + data.w
            }, 0)

            const bullishScore = CandlestickNames.bullish.reduce((acc, name) => {
              let data = levelData.a.bullish[CandlestickIdxs.bullish[name]]
              data.w /= bullishTotalWeights
              acc.score += data.w * sigmoid(acc.count, CandlestickNames.bullish.length)
              return acc
            }, {
              score: 0,
              count: 0
            }).score
            
            const bearishTotalWeights = CandlestickNames.bearish.reduce((acc, name) => {
              let data = levelData.a.bearish[CandlestickIdxs.bearish[name]]
              data.w = calcWeight(data.s ? 0.51 : 0, data.w, 1 - optimalScore)
              return acc + data.w
            }, 0)

            const bearishScore = CandlestickNames.bearish.reduce((acc, name) => {
              let data = levelData.a.bearish[CandlestickIdxs.bearish[name]]
              data.w /= bearishTotalWeights
              acc.score += data.s ? data.w * sigmoid(acc.count, CandlestickNames.bearish.length) : 0
              acc.count += data.s
              return acc
            }, {
              score: 0,
              count: 0
            }).score

            levelData.s = calcScore(bullishScore, bearishScore)
            levelData.w = calcWeight(levelData.s, levelData.w, optimalScore)
            return acc + levelData.w
          }, 0)

          techAnalysis.candlesticks.s = CandleStickLevels.reduce((acc, level) => {
            let data: CandleStickLevelSW = candleStickData[level[0]]
            data.w /= candleStickLevelTotalWeights
            return acc + (data.s * data.w)
          }, 0)

          techAnalysis.candlesticks.w = calcWeight(
            techAnalysis.candlesticks.s,
            techAnalysis.candlesticks.w,
            optimalScore
          )

        })
        .catch((e) => {
          console.error(e)
          throw e
        }))
      })
    })



  }

  private getInitWeights = (pair): IntervalData => {
    const data = Analysis.intervalList.reduce((acc, interval, intervalIdx) => {
      acc[interval] = {
        w: Analysis.initIntervalWeights[intervalIdx],
        s: 0,
        a: {
          tech: {
            w: Analysis.symbolPieWeights.tech,
            s: 0,
            a: {
              oscillators: {
                w: Analysis.initTechAnalysisWeights.oscillators,
                s: 0,
                a: addEVENWeight(Object.keys(oscillatorsSettings).map(name => [name])).reduce((acc, [name, weight]) => {
                  acc[OscillatorIdxs[name]] = {
                    w: weight,
                    s: 0
                  }
                  return acc
                }, {})
              },
              candlesticks: {
                w: Analysis.initTechAnalysisWeights.candlesticks,
                s: 0,
                a: addNAIVEWeight(CandleStickLevels).reduce((acc, [level, weight]) => {
                  acc[level] = {
                    w: weight,
                    s: 0,
                    a: {
                      bullish: addEVENWeight(bullish).reduce((acc, [name, , weight]) => {
                        acc[CandlestickIdxs.bullish[name]] = {
                          w: weight,
                          s: 0
                        }
                        return acc
                      }, {}),
                      bearish: addEVENWeight(bearish).reduce((acc, [name, , weight]) => {
                        acc[CandlestickIdxs.bearish[name]] = {
                          w: weight,
                          s: 0
                        }
                        return acc
                      }, {})
                    } as CandleStickBullBear
                  }
                  return acc
                }, {})
              },
              moveBack: {
                w: Analysis.initTechAnalysisWeights.moveBack,
                s: 0,
                a: {
                  ...addNAIVEWeight(movingAveragesSettings.EMA.periods.map(period => [`EMA${period}`])).reduce((acc, [name, weight]) => {
                    acc[MoveBackIdxs[name]] = {
                      w: weight,
                      s: 0
                    }
                    return acc
                  }, {}),
                  ...addNAIVEWeight(movingAveragesSettings.SMA.periods.map(period => [`SMA${period}`])).reduce((acc, [name, weight]) => {
                    acc[MoveBackIdxs[name]] = {
                      w: weight,
                      s: 0
                    }
                    return acc
                  }, {})
                }
              },
              cross: {
                w: Analysis.initTechAnalysisWeights.cross,
                s: 0
              },
              priceChange: {
                w: Analysis.initTechAnalysisWeights.priceChange,
                s: 0
              }
            }
          }
        }
      } as IntervalDataSWA
      return acc
    }, {})

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

    this.trainingExecute().catch(console.error)
    // setInterval(this.trainingExecute, 6000)
  }

}

export default MachineLearningTrainer