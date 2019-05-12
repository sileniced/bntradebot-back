import StockData from 'technicalindicators/declarations/StockData'
import * as TI from 'technicalindicators'
import { CandleStickData, CandleStickSW } from '../../entities/ScoresWeightsEntityV1'
import { dataCollectorCandlestickNames } from './utils'
import { addEVENWeight, addMachineLearningWeights, addNAIVEWeight } from './mlWeightUtils'

const settings = {
  depth: 10
}

const bullish: [string, number][] = [
  ['BullishEngulfingPattern', 2],
  ['DownsideTasukiGap', 3],
  ['BullishHarami', 2],
  ['BullishHaramiCross', 2],
  ['MorningDojiStar', 3],
  ['MorningStar', 3],
  ['BullishMarubozu', 1],
  ['PiercingLine', 2],
  ['ThreeWhiteSoldiers', 3],
  ['BullishHammerStick', 1],
  ['BullishInvertedHammerStick', 1],
  ['HammerPattern', 5],
  ['HammerPatternUnconfirmed', 5],
  ['TweezerBottom', 5]
]

const bearish: [string, number][] = [
  ['BearishEngulfingPattern', 2],
  ['BearishHarami', 2],
  ['BearishHaramiCross', 2],
  ['EveningDojiStar', 3],
  ['EveningStar', 3],
  ['BearishMarubozu', 1],
  ['ThreeBlackCrows', 3],
  ['BearishHammerStick', 1],
  ['BearishInvertedHammerStick', 1],
  ['HangingMan', 5],
  ['HangingManUnconfirmed', 5],
  ['ShootingStar', 5],
  ['ShootingStarUnconfirmed', 5],
  ['TweezerTop', 5]
]

const sliceStockData = (data: StockData, last: number): StockData => ({
  open: data.open.slice(-last),
  close: data.close.slice(-last),
  high: data.high.slice(-last),
  low: data.low.slice(-last)
})

const run = (
  data: StockData,
  dataCollector: CandleStickSW,
  prevData: CandleStickSW,
  prevOptimalScore: number | null
) => {

  const bullishArr = prevOptimalScore
    ? addMachineLearningWeights(prevOptimalScore, bullish.map(([name]) => ({
      name,
      prevData: prevData.bullish[dataCollectorCandlestickNames.bullish[name]]
    }))).map(([name, weight], idx) => [name, bullish[idx][1], weight])
    : addEVENWeight(bullish)

  const bearishArr = prevOptimalScore
    ? addMachineLearningWeights(1 - prevOptimalScore, bearish.map(([name]) => ({
      name,
      prevData: prevData.bullish[dataCollectorCandlestickNames.bearish[name]]
    }))).map(([name, weight], idx) => [name, bearish[idx][1], weight])
    : addEVENWeight(bearish)

  const dataLast = {
    [1]: sliceStockData(data, 1),
    [2]: sliceStockData(data, 2),
    [3]: sliceStockData(data, 3),
    [5]: sliceStockData(data, 5)
  }

  const analysis = {
    bullish: bullishArr.reduce((acc, [name, amount, weight], _, src) => {
      acc[name] = TI[name.toLowerCase()](dataLast[amount])
      dataCollector.bullish[dataCollectorCandlestickNames.bullish[name]] = {
        w: weight,
        s: acc[name] ? 0.75 : 0.25
      }
      acc._score += acc[name] ? weight * (2 - ((2 * acc._count) / src.length)) : 0
      acc._unSigmoidScore += acc[name] ? weight : 0
      acc._count += acc[name] ? 1 : 0
      return acc
    }, {
      _score: 0,
      _unSigmoidScore: 0,
      _count: 0
    }),
    bearish: bearishArr.reduce((acc, [name, amount, weight], _, src) => {
      acc[name] = TI[name.toLowerCase()](dataLast[amount])
      dataCollector.bearish[dataCollectorCandlestickNames.bearish[name]] = {
        w: weight,
        s: acc[name] ? 0.75 : 0.25
      }
      acc._score += acc[name] ? weight * (2 - ((2 * acc._count) / src.length)) : 0
      acc._unSigmoidScore += acc[name] ? weight : 0
      acc._count += acc[name] ? 1 : 0
      return acc
    }, {
      _score: 0,
      _unSigmoidScore: 0,
      _count: 0
    })
  }

  const score = 0.5 + (analysis.bullish._score / 2) - (analysis.bearish._score / 2)

  return {
    _score: score
    // analysis
  }
}

const shortenStockData = (data: StockData, length: number): StockData => ({
  open: data.open.slice(0, length),
  close: data.close.slice(0, length),
  high: data.high.slice(0, length),
  low: data.low.slice(0, length)
})

export default (
  data: StockData,
  dataCollector: CandleStickData,
  prevData: CandleStickData,
  prevOptimalScore: number | null
) => {

  const length = data.close.length

  const levelArr: [number][] = Array(settings.depth).fill(null).map((_, level) => {
    dataCollector[level] = {
      w: 0,
      a: {
        bullish: {},
        bearish: {}
      }
    }
    return [level]
  })

  const leverArrScore = levelArr.map(([level]) => run(
    shortenStockData(data, length - level),
    dataCollector[level].a,
    prevOptimalScore !== null ? prevData[level].a : dataCollector[level].a,
    prevOptimalScore
  )._score)

  /** OLD SCORES NEW WEIGHTS */



  const levelArrWeighted: [number, number][] = addNAIVEWeight(levelArr)

  return {
    _score: levelArrWeighted.reduce((acc, [level, weight]) => {
      dataCollector[level].w = weight
      return acc + (leverArrScore[level] * weight)
    }, 0)
  }


}