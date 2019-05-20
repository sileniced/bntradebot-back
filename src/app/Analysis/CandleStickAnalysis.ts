import StockData from 'technicalindicators/declarations/StockData'
import * as TI from 'technicalindicators'
import { CandleStickData, CandleStickBullBear } from '../../entities/ScoresWeightsEntityV1'
import { CandlestickIdxs, CandlestickNames } from './utils'
import { addEVENWeight, addMachineLearningWeights, addNAIVEWeight, MachineLearningData } from './MachineLearning/mlWeightUtils'

export const settings = {
  depth: 10
}

export const bullish: [string, number][] = [
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

export const bearish: [string, number][] = [
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

export const sigmoid = (count, length) => (2 - ((2 * count) / length))
export const calcScore = (bullish, bearish) => 0.5 + (bullish / 2) - (bearish / 2)

const DataLast = (data: StockData) => ({
  [1]: sliceStockData(data, 1),
  [2]: sliceStockData(data, 2),
  [3]: sliceStockData(data, 3),
  [5]: sliceStockData(data, 5)
})

const run = (
  data: StockData,
  dataCollector: CandleStickBullBear,
  prevData: CandleStickBullBear,
  prevOptimalScore: number | null
) => {

  const bullishArr = prevOptimalScore
    ? addMachineLearningWeights(prevOptimalScore, bullish.map(([name]): MachineLearningData => ({
      name,
      prevData: prevData.bullish[CandlestickIdxs.bullish[name]]
    }))).map(([name, weight], idx) => [name, bullish[idx][1], weight])
    : addEVENWeight(bullish)

  const bearishArr = prevOptimalScore
    ? addMachineLearningWeights(1 - prevOptimalScore, bearish.map(([name]): MachineLearningData => ({
      name,
      prevData: prevData.bearish[CandlestickIdxs.bearish[name]]
    }))).map(([name, weight], idx) => [name, bearish[idx][1], weight])
    : addEVENWeight(bearish)

  const dataLast = DataLast(data)

  const analysis = {
    bullish: bullishArr.reduce((acc, [name, amount, weight], _, src) => {
      acc[name] = TI[name.toLowerCase()](dataLast[amount])
      dataCollector.bullish[CandlestickIdxs.bullish[name]] = {
        w: weight,
        s: acc[name] ? 0.51 : 0
      }
      acc._score += acc[name] ? weight * sigmoid(acc._count, src.length) : 0
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
      dataCollector.bearish[CandlestickIdxs.bearish[name]] = {
        w: weight,
        s: acc[name] ? 0.51 : 0
      }
      acc._score += acc[name] ? weight * sigmoid(acc._count, src.length) : 0
      acc._unSigmoidScore += acc[name] ? weight : 0
      acc._count += acc[name] ? 1 : 0
      return acc
    }, {
      _score: 0,
      _unSigmoidScore: 0,
      _count: 0
    })
  }

  const score = calcScore(analysis.bullish._score, analysis.bearish._score)

  return {
    _score: score
    // analysis
  }
}

const ShortenStockData = (data: StockData, length: number): StockData => ({
  open: data.open.slice(0, length),
  close: data.close.slice(0, length),
  high: data.high.slice(0, length),
  low: data.low.slice(0, length)
})

export const CandleStickLevels = Array(settings.depth).fill(null).map((_, level) => [level])

export const CandleStickAnalysisML = (
  stockData: StockData,
  candleStickData: CandleStickData
) => {
  const length = stockData.close.length
  const levels: string[] = Object.keys(candleStickData)
  levels.forEach(level => {
    const shortenedData = ShortenStockData(stockData, length - parseInt(level))
    const dataLast = DataLast(shortenedData)

    const bullishNumbers = Object.keys(candleStickData[level].a.bullish)
    const bearishNumbers = Object.keys(candleStickData[level].a.bearish)

    bullishNumbers.forEach(bullishNumber => {
      candleStickData[level].a.bullish[bullishNumber].s = TI[CandlestickNames.bullish[bullishNumber].toLowerCase()](dataLast[bullish[bullishNumber][1]]) ? 1 : 0
    })

    bearishNumbers.forEach(bearishNumber => {
      candleStickData[level].a.bearish[bearishNumber].s = TI[CandlestickNames.bearish[bearishNumber].toLowerCase()](dataLast[bearish[bearishNumber][1]]) ? 1 : 0
    })
    
  })

  return candleStickData
}

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
      s: 0,
      a: {
        bullish: {},
        bearish: {}
      }
    }
    return [level]
  })

  const leverArrScore = levelArr.map(([level]) => run(
    ShortenStockData(data, length - level),
    dataCollector[level].a,
    prevOptimalScore !== null ? prevData[level].a : dataCollector[level].a,
    prevOptimalScore
  )._score)

  /** OLD SCORES NEW WEIGHTS */

  if (prevOptimalScore !== null) {

    const prevDataEntries = Object.entries(prevData) as [string, {
      w: number
      /** trick is to turn that :a: into an :s: */
      a: CandleStickBullBear
    }][]

    const machineLearningData: MachineLearningData[] = prevDataEntries.map(([level, { w, a: { bullish, bearish } }]) => {

      const bullishEntries = Object.entries(bullish) as [string, { w: number, s: number }][]
      const bullishReduced = bullishEntries.reduce((acc, [bullishNumber, { s }]) => {
        acc.score += s > 0.5 ? dataCollector[level].a.bullish[bullishNumber].w * sigmoid(acc.count, bullishEntries.length) : 0
        acc.count += s > 0.5 ? 1 : 0
        return acc
      }, {
        score: 0,
        count: 0
      })

      const bearishEntries = Object.entries(bearish) as [string, { w: number, s: number }][]
      const bearishReduced = bearishEntries.reduce((acc, [bearishNumber, { s }]) => {
        acc.score += s > 0.5 ? dataCollector[level].a.bearish[bearishNumber].w * sigmoid(acc.count, bearishEntries.length) : 0
        acc.count += s > 0.5 ? 1 : 0
        return acc
      }, {
        score: 0,
        count: 0
      })
      
      return {
        name: level,
        prevData: {
          w,
          s: calcScore(bullishReduced.score, bearishReduced.score)
        }
      }
    })

    const levelArrWeighted: [string, number][] = addMachineLearningWeights(prevOptimalScore, machineLearningData)

    return {
      _score: levelArrWeighted.reduce((acc, [level, weight]) => {
        dataCollector[level].w = weight
        dataCollector[level].s = leverArrScore[level]
        return acc + (leverArrScore[level] * weight)
      }, 0)
    }

  }

  const levelArrWeighted: [number, number][] = addNAIVEWeight(levelArr)

  return {
    _score: levelArrWeighted.reduce((acc, [level, weight]) => {
      dataCollector[level].w = weight
      dataCollector[level].s = leverArrScore[level]
      return acc + (leverArrScore[level] * weight)
    }, 0)
  }


}