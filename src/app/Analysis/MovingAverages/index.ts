import StockData from 'technicalindicators/declarations/StockData'
import Values from './Values'
import Scoring from './Scoring'
import { CrossSW, MoveBackSW } from '../../../entities/ScoresWeightsEntityV1'
import { MoveBackNames } from '../utils'

export const MovingAverages = (
  stockData: StockData,
  moveBackSW: MoveBackSW,
  crossSW: CrossSW
) => {
  const maLengthIdxs = Object.keys(moveBackSW)

  const values = Values(stockData)
  const close = stockData.close.slice(-1)[0]
  const scoring = Scoring(close, values)

  maLengthIdxs.forEach(maLengthIdx => {
    moveBackSW[maLengthIdx].s = scoring[MoveBackNames[maLengthIdx]]._score
  })

  crossSW.s = CrossScore(values)

  return moveBackSW
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