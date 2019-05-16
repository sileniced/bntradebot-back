import StockData from 'technicalindicators/declarations/StockData'
import settings from './settings'
import Values from './Values'
import Scoring from './Scoring'
import { CrossSW, MoveBackSW } from '../../../entities/ScoresWeightsEntityV1'
import { addScores, MoveBackIdxs, MoveBackNames } from '../utils'
import { addMachineLearningWeights, addNAIVEWeight, MachineLearningData } from '../mlWeightUtils'

export const MovingAveragesML = (
  stockData: StockData,
  moveBackSW: MoveBackSW,
  crossSW: CrossSW
) => {
  const maLengthNumbers = Object.keys(moveBackSW)

  const values = Values(stockData)
  const close = stockData.close.slice(-1)[0]
  const scoring = Scoring(close, values)

  maLengthNumbers.forEach(maLengthNumber => {
    moveBackSW[maLengthNumber].s = scoring[MoveBackNames[maLengthNumber]]
  })

  crossSW.s = CrossScore(values)
}

const CrossScore = ({ SMA, EMA }) => {

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

  return ((emaCrossAnalysis / maxScore) + (smaCrossAnalysis / maxScore)) / 2
}

export default (
  data: StockData,
  moveBackDataCollector: MoveBackSW,
  crossDataCollector: CrossSW,
  prevMoveBackData: MoveBackSW,
  // prevCrossData: CrossSW,
  prevOptimalScore: number | null
) => {

  const emaMovingAveragesList: [string, number][] = prevOptimalScore !== null
    ? addMachineLearningWeights(prevOptimalScore, settings.EMA.periods.map((period): MachineLearningData => {
      const prevData = prevMoveBackData[MoveBackIdxs[`EMA${period}`]]
      if (!prevData) {
        console.error(prevData)
        console.error(prevMoveBackData)
        console.error(`EMA${period}`)
        console.error(MoveBackIdxs[`EMA${period}`])
        throw 'NO PREVDATA WHY'
      }
      return {
        name: `EMA${period}`,
        prevData
      }
    }))
    : addNAIVEWeight(settings.EMA.periods.map(period => [`EMA${period}`]))

  const smaMovingAveragesList: [string, number][] = prevOptimalScore !== null
    ? addMachineLearningWeights(prevOptimalScore, settings.SMA.periods.map((period): MachineLearningData => ({
      name: `SMA${period}`,
      prevData: prevMoveBackData[MoveBackIdxs[`SMA${period}`]]
    })))
    : addNAIVEWeight(settings.SMA.periods.map(period => [`SMA${period}`]))

  const values = Values(data)
  const close = data.close.slice(-1)[0]
  const scoring = Scoring(close, values)

  const emaMoveBackAnalysis = emaMovingAveragesList.reduce((acc, [name, weight]) => {
    moveBackDataCollector[MoveBackIdxs[name]] = {
      w: weight,
      s: scoring[name]._score
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
    moveBackDataCollector[MoveBackIdxs[name]] = {
      w: weight,
      s: scoring[name]._score
    }
    acc[name] = {
      _score: scoring[name]._score * weight
      // _unweightedScore: scoring[name]._score,
      // values: scoring[name].value[0],
      // scoring: scoring[name].toString()
    }
    return acc
  }, {})

  const crossScore = CrossScore(values)
  crossDataCollector.s = crossScore

  const moveBackScore = (addScores(emaMoveBackAnalysis) + addScores(smaMoveBackAnalysis)) / 2

  return { moveBackScore, crossScore }
}