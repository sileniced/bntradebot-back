import StockData from 'technicalindicators/declarations/StockData'
import { CandleChartResult } from 'binance-api-node'

export default (candles: CandleChartResult[]): StockData => candles.reduce((acc: StockData, candle: CandleChartResult) => {
  acc.open.push(parseFloat(candle.open))
  acc.high.push(parseFloat(candle.high))
  acc.low.push(parseFloat(candle.low))
  acc.close.push(parseFloat(candle.close))
  return acc
}, {
  open: [],
  close: [],
  high: [],
  low: []
})