import StockData from 'technicalindicators/declarations/StockData'
import * as TI from 'technicalindicators'
import { CandleStickData } from '../../entities/ScoresWeightsEntityV1'
import { CandlestickNames } from './utils'

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

const ShortenStockData = (data: StockData, length: number): StockData => ({
  open: data.open.slice(0, length),
  close: data.close.slice(0, length),
  high: data.high.slice(0, length),
  low: data.low.slice(0, length)
})

export const CandleStickLevels = Array(settings.depth).fill(null).map((_, level) => [level])

export const CandleStickAnalysis = (
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
