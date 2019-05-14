import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { OscillatorSW } from '../../../entities/ScoresWeightsEntityV1'
import { addScores, dataCollectorOscillatorNames } from '../utils'
import { addEVENWeight, addMachineLearningWeights } from '../mlWeightUtils'

export default (
  data: StockData,
  dataCollector: OscillatorSW,
  prevData: OscillatorSW,
  prevOptimalScore: number | null
) => {

  const oscillatorsList = prevOptimalScore !== null
    ? addMachineLearningWeights(prevOptimalScore, Object.keys(settings).map(name => ({
      name,
      prevData: prevData[dataCollectorOscillatorNames[name]]
    })), false)
    : addEVENWeight(Object.keys(settings).map(name => [name]))

  const values = Values(data)
  const scoring = Scoring(values)

  const analysis = oscillatorsList.reduce((acc, [name, weight]) => {
    const score = scoring[name]()

    dataCollector[dataCollectorOscillatorNames[name]] = {
      w: weight,
      s: score
    }

    acc[name] = {
      _score: score * weight,
      _unweightedScore: score,
      values: values[name]
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})

  return {
    _score: addScores(analysis)
    // analysis
  }
}