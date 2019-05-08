import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { addEVENWeight, addScores, numShort } from '../../../services/utils'
import { OscillatorCollector } from '../../../entities/ScoresWeightsEntityV1'
import { dataCollectorOscillatorNames } from '../utils'

const oscillatorsList = addEVENWeight(Object.keys(settings).map(name => [name]))

export default (data: StockData, dataCollector: OscillatorCollector) => {
  const values = Values(data)
  const scoring = Scoring(values)

  const analysis = oscillatorsList.reduce((acc, [name, weight]) => {
    const score = scoring[name]()

    dataCollector[dataCollectorOscillatorNames[name]] = {
      w: numShort(weight),
      s: numShort(score)
    }

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