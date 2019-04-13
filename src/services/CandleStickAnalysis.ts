import { CandleChartResult } from 'binance-api-node'
import StockData from 'technicalindicators/declarations/StockData'
import CreateStockData from './createStockData'
import * as TI from 'technicalindicators'

const sliceStockData = (data: StockData, last: number): StockData => ({
  open: data.open.slice(-last),
  close: data.close.slice(-last),
  high: data.high.slice(-last),
  low: data.low.slice(-last)
})

const addWeight = arr => {
  const total = Array(arr.length).fill(arr.length).reduce((acc, num, idx) => acc + (num - idx), 0)
  return arr.map((pattern, idx) => [...pattern, ((arr.length - idx) / total)])
}

const bullishArr = addWeight([
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
])

const bearishArr = addWeight([
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
])

export default (candles: CandleChartResult[]) => {
  const data: StockData = CreateStockData(candles)
  const dataLast = {
    [1]: sliceStockData(data, 1),
    [2]: sliceStockData(data, 2),
    [3]: sliceStockData(data, 3),
    [5]: sliceStockData(data, 5)
  }

  const arrReducer = (acc, [name, amount, weight]) => {
    acc[name] = TI[name.toLowerCase()](dataLast[amount])
    acc._score += acc[name] ? weight : 0
    return acc
  }

  const analysis = {
    bullish: bullishArr.reduce(arrReducer, { _score: 0 }),
    bearish: bearishArr.reduce(arrReducer, { _score: 0 })
  }

  return {
    _score: 0.5 + (analysis.bullish._score / 2) - (analysis.bearish._score / 2),
    ...analysis
  }
}