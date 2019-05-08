import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { addNAÏVEWeight, addScores, numShort } from '../../../services/utils'
import { CrossCollector, MoveBackCollector } from '../../../entities/ScoresWeightsEntityV1'
import { dataCollectorMoveBackNames } from '../utils'

const emaMovingAveragesList = addNAÏVEWeight(settings.EMA.periods.map(period => [`EMA${period}`]))
const smaMovingAveragesList = addNAÏVEWeight(settings.SMA.periods.map(period => [`SMA${period}`]))

export default (data: StockData, moveBackDataCollector: MoveBackCollector, crossDataCollector: CrossCollector) => {
  const values = Values(data)
  const close = data.close.slice(-1)[0]
  const scoring = Scoring(close, values)

  const emaMoveBackAnalysis = emaMovingAveragesList.reduce((acc, [name, weight]) => {
    moveBackDataCollector[dataCollectorMoveBackNames[name]] = {
      w: numShort(weight),
      s: numShort(scoring[name]._score)
    }
    acc[name] = {
      _score: scoring[name]._score * weight
      // _unweightedScore: scoring[name]._score,
      // values: scoring[name].value[0],
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})

  const smaMoveBackAnalysis = smaMovingAveragesList.reduce((acc, [name, weight]) => {
    moveBackDataCollector[dataCollectorMoveBackNames[name]] = {
      w: numShort(weight),
      s: numShort(scoring[name]._score)
    }
    acc[name] = {
      _score: scoring[name]._score * weight
      // _unweightedScore: scoring[name]._score,
      // values: scoring[name].value[0],
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})

  const { SMA, EMA } = values

  const periods = [200, 100, 50, 20, 10]
  const maxScore = 4 + 4 + 4 + 4 + 3 + 3 + 3 + 2 + 2 + 1

  const emaCrossAnalysis = periods.reduce((acc, period, idx) => {
    return acc + periods.slice(idx + 1).reduce((cAcc, cPeriod) => {
      return EMA[period] > EMA[cPeriod] ? cAcc + (periods.length - (idx + 1)) : cAcc
    }, 0)
  }, 0)

  const smaCrossAnalysis = periods.reduce((acc, period, idx) => {
    return acc + periods.slice(idx + 1).reduce((acc, cPeriod) => {
      return SMA[period] > SMA[cPeriod] ? acc + (periods.length - (idx + 1)) : acc
    }, 0)
  }, 0)

  const crossScore = ((emaCrossAnalysis / maxScore) + (smaCrossAnalysis / maxScore)) / 2
  crossDataCollector.s = numShort(crossScore)

  return {
    moveBackScore: (addScores(emaMoveBackAnalysis) + addScores(smaMoveBackAnalysis)) / 2,
    crossScore: crossScore
    // _close: close,
    // analysis
  }
}