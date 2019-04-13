import { CandleChartResult } from 'binance-api-node'
import StockData from 'technicalindicators/declarations/StockData'
import CreateStockData from './createStockData'
import { RSI, StochasticRSI } from 'technicalindicators'

export const settings = {
  stdPeriod: 14,
  RSI: {
    sell: 70,
    buy: 30
  },
  stochRSI: {
    kPeriod: 3,
    dPeriod: 3,
    sell: 80,
    buy: 20
  }
}

export default (candles: CandleChartResult[]) => {
  const { close }: StockData = CreateStockData(candles)

  const values = {
    RSI: RSI.calculate({
      values: close,
      period: settings.stdPeriod
    }).slice(-1)[0],
    StochRSI: StochasticRSI.calculate({
      values: close,
      rsiPeriod: settings.stdPeriod,
      stochasticPeriod: settings.stdPeriod,
      dPeriod: settings.stochRSI.dPeriod,
      kPeriod: settings.stochRSI.kPeriod
    }).slice(-1)[0]

  }

  return {
    RSI: {
      _score: values.RSI > settings.RSI.sell ? 0 : (values.RSI < settings.RSI.buy ? 1 : 0.5),
      value: values.RSI
    },
    stochRSI: {
      _score: values.StochRSI.stochRSI > settings.stochRSI.sell ? (
        values.StochRSI.k < values.StochRSI.d ? 0 : 0.33
      ) : (
        values.StochRSI.k < values.StochRSI.d ? 0.66 : 1
      ),
      value: values.StochRSI
    }

  }
}