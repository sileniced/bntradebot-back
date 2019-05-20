import StockData from 'technicalindicators/declarations/StockData'
import Values from './Values'
import Scoring from './Scoring'
import { OscillatorSW } from '../../../entities/ScoresWeightsEntityV1'
import { OscillatorNames } from '../utils'

export const Oscillators = (
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