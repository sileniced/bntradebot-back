import StockData from 'technicalindicators/declarations/StockData'
import * as TI from 'technicalindicators'
import settings from './settings'

export default ({ close }: StockData) => Object.keys(settings).reduce((acc, movingAverage) => {
  acc[movingAverage] = settings[movingAverage].periods.reduce((acc, period) => {
    acc[period] = TI[movingAverage].calculate({
      period,
      values: close,
    }).slice(-1)
    return acc
  }, {})
  return acc
}, {
  EMA: {},
  SMA: {}
})