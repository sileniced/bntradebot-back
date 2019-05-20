import Analysis from '../index'
import { addEVENWeight, addNAIVEWeight } from './mlWeightUtils'
import {
  CandlestickIdxs,
  EmaMoveBackNames,
  MoveBackIdxs,
  OscillatorIdxs,
  OscillatorNames,
  SmaMoveBackNames
} from '../utils'
import { bearish, bullish, CandleStickLevels } from '../CandleStickAnalysis'
import { CandleStickBullBear, IntervalDataSWA } from '../../../entities/ScoresWeightsModelV1'

export const initWeights = () => Analysis.intervalList.reduce((acc, interval, intervalIdx) => {
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
            a: addEVENWeight(OscillatorNames.map(name => [name])).reduce((acc, [name, weight]) => {
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
              ...addNAIVEWeight(EmaMoveBackNames).reduce((acc, [name, weight]) => {
                acc[MoveBackIdxs[name]] = {
                  w: weight,
                  s: 0
                }
                return acc
              }, {}),
              ...addNAIVEWeight(SmaMoveBackNames).reduce((acc, [name, weight]) => {
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