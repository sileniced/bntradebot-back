import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { addEVENWeight, addScores } from '../../../services/utils'

const oscillatorsList = addEVENWeight(Object.keys(settings).map(name => [name]))

export default (data: StockData) => {
  const values = Values(data)
  const scoring = Scoring(values)

  const analysis = oscillatorsList.reduce((acc, [name, weight]) => {
    const score = scoring[name]()
    acc[name] = {
      _score: score * weight,
      _unweightedScore: score,
      values: values[name],
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})

  return {
    _score: addScores(analysis),
    // analysis
  }
}