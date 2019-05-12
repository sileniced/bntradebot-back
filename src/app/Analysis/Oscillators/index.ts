import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { OscillatorSW } from '../../../entities/ScoresWeightsEntityV1'
import { addScores, dataCollectorOscillatorNames } from '../utils'
import { addEVENWeight, numShort } from '../mlWeightUtils'

const oscillatorsList = addEVENWeight(Object.keys(settings).map(name => [name]))

export default (data: StockData, dataCollector: OscillatorSW) => {
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