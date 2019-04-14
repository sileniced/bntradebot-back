import StockData from 'technicalindicators/declarations/StockData'
import * as TI from 'technicalindicators'
import settings from './settings'

export default ({ high, low, close }: StockData) => ({
  RSI: TI.RSI.calculate({
    ...settings.RSI.analyse,
    values: close
  }).slice(-2),
  StochRSI: TI.StochasticRSI.calculate({
    ...settings.StochRSI.analyse,
    values: close
  }).slice(-1)[0],
  StochFast: TI.Stochastic.calculate({
    ...settings.StochFast.analyse,
    close, high, low
  }).slice(-1)[0],
  CCI: TI.CCI.calculate({
    ...settings.CCI.analyse,
    high, low, close,
  }).slice(-2),
  ADX: TI.ADX.calculate({
    ...settings.ADX.analyse,
    high, low, close
  }).slice(-1)[0],
  AO: TI.AwesomeOscillator.calculate({
    ...settings.AO.analyse,
    high, low
  }).slice(-2),
  MACD: TI.MACD.calculate({
    ...settings.MACD.analyse,
    values: close
  }).slice(-2),
  WPR: TI.WilliamsR.calculate({
    ...settings.WPR.analyse,
    high, low, close
  }).slice(-2)
})