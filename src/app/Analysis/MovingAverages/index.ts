import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { addNAÏVEWeight, addScores } from '../../../services/utils'

const emaMovingAveragesList = addNAÏVEWeight(settings.EMA.periods.map(period => [`EMA${period}`]))
const smaMovingAveragesList = addNAÏVEWeight(settings.SMA.periods.map(period => [`SMA${period}`]))

export default (data: StockData) => {
  const values = Values(data)
  const close = data.close.slice(-1)[0]
  const scoring = Scoring(close, values)

  const emaMoveBackAnalysis = emaMovingAveragesList.reduce((acc, [name, weight]) => {
    acc[name] = {
      _score: scoring[name]._score * weight,
      // _unweightedScore: scoring[name]._score,
      // values: scoring[name].value[0],
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})

  const smaMoveBackAnalysis = smaMovingAveragesList.reduce((acc, [name, weight]) => {
    acc[name] = {
      _score: scoring[name]._score * weight,
      // _unweightedScore: scoring[name]._score,
      // values: scoring[name].value[0],
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})



  return {
    moveBackScore: (addScores(emaMoveBackAnalysis) + addScores(smaMoveBackAnalysis)) / 2,
    // _close: close,
    // analysis
  }
}