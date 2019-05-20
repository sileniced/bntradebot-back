import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { OscillatorSW } from '../../../entities/ScoresWeightsEntityV1'
import { addScores, OscillatorIdxs, OscillatorNames } from '../utils'
import { addEVENWeight, addMachineLearningWeights, MachineLearningData } from '../MachineLearning/mlWeightUtils'

export const OscillatorsML = (
  stockData: StockData,
  oscillatorSW: OscillatorSW,
) => {
  const oscillatorsIdxs = Object.keys(oscillatorSW)

  const values = Values(stockData)
  const scoring = Scoring(values)

  oscillatorsIdxs.forEach(oscillatorsIdx => {
    oscillatorSW[oscillatorsIdx].s = scoring[OscillatorNames[oscillatorsIdx]]()
  })

  return oscillatorSW
}

export default (
  data: StockData,
  dataCollector: OscillatorSW,
  prevData: OscillatorSW,
  prevOptimalScore: number | null
) => {

  const oscillatorsList = prevOptimalScore !== null
    ? addMachineLearningWeights(prevOptimalScore, Object.keys(settings).map((name): MachineLearningData => ({
      name,
      prevData: prevData[OscillatorIdxs[name]]
    })), false)
    : addEVENWeight(Object.keys(settings).map(name => [name]))

  const values = Values(data)
  const scoring = Scoring(values)

  const analysis = oscillatorsList.reduce((acc, [name, weight]) => {
    const score = scoring[name]()

    dataCollector[OscillatorIdxs[name]] = {
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