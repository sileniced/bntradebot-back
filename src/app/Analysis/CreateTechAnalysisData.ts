import StockData from 'technicalindicators/declarations/StockData'
import { CandleChartResult } from 'binance-api-node'

export default (candles: CandleChartResult[]): StockData => {

  let acc = {
    open: <number[]>[],
    close: <number[]>[],
    high: <number[]>[],
    low: <number[]>[]
  }

  for (let i = 0, len = candles.length; i < len; i++) {
    const candle = candles[i]
    acc.open.push(parseFloat(candle.open))
    acc.high.push(parseFloat(candle.high))
    acc.low.push(parseFloat(candle.low))
    acc.close.push(parseFloat(candle.close))
  }

  return acc
}