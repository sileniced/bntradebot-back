import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { addNAÏVEWeight, addScores } from '../utils'

const movingAveragesList = addNAÏVEWeight([
  ...settings.EMA.periods.map(period => [`EMA${period}`]),
  ...settings.SMA.periods.map(period => [`SMA${period}`])
])

export default (data: StockData) => {
  const values = Values(data)
  const close = data.close.slice(-1)[0]
  const scoring = Scoring(close, values)

  const analysis = movingAveragesList.reduce((acc, [name, weight]) => {
    acc[name] = {
      _score: scoring[name]._score * weight,
      _unweightedScore: scoring[name]._score,
      values: scoring[name].value[0],
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})

  return {
    _score: addScores(analysis),
    _close: close,
    analysis
  }
}