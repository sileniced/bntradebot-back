import StockData from 'technicalindicators/declarations/StockData'
import * as TI from 'technicalindicators'
import { addEVENWeight } from './utils'

const bullishArr = addEVENWeight([
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
  // ['HammerPatternUnconfirmed', 5],
  ['TweezerBottom', 5]
])

const bearishArr = addEVENWeight([
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
  // ['ShootingStarUnconfirmed', 5],
  ['TweezerTop', 5]
])

const sliceStockData = (data: StockData, last: number): StockData => ({
  open: data.open.slice(-last),
  close: data.close.slice(-last),
  high: data.high.slice(-last),
  low: data.low.slice(-last)
})

export default (data: StockData) => {
  const dataLast = {
    [1]: sliceStockData(data, 1),
    [2]: sliceStockData(data, 2),
    [3]: sliceStockData(data, 3),
    [5]: sliceStockData(data, 5)
  }

  const arrReducer = (acc, [name, amount, weight], _, src) => {
    acc[name] = TI[name.toLowerCase()](dataLast[amount])
    acc._score += acc[name] ? weight * (2 - ((2 * acc._count) / src.length)) : 0
    acc._unSigmoidScore += acc[name] ? weight : 0
    acc._count += acc[name] ? 1 : 0
    return acc
  }

  const analysis = {
    bullish: bullishArr.reduce(arrReducer, {
      _score: 0,
      _unSigmoidScore: 0,
      _count: 0
    }),
    bearish: bearishArr.reduce(arrReducer, {
      _score: 0,
      _unSigmoidScore: 0,
      _count: 0
    })
  }

  const score = 0.5 + (analysis.bullish._score / 2) - (analysis.bearish._score / 2)

  return {
    _score: score,
    analysis
  }
}