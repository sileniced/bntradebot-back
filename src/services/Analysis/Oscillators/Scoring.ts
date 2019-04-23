import settings from './settings'

export default (valuesList, settingsList = settings) => ({
  RSI: (
    [last, current] = valuesList.RSI,
    { buy, sell } = settingsList.RSI.scoring
  ) => {
    if (current < buy) {
      if (current > last) return 5 / 5
      return 4 / 5
    }
    if (current > sell) {
      if (current > last) return 1 / 5
      return 0 / 5
    }
    if (current > last) return 3 / 5
    return 2 / 5
  },
  StochRSI: (
    { k, d, stochRSI } = valuesList.StochRSI,
    { buy, sell } = settingsList.StochRSI.scoring
  ) => {
    if (stochRSI < buy) {
      if (k > d) return 5 / 5
      return 4 / 5
    }
    if (stochRSI > sell) {
      if (k > d) return 1 / 5
      return 0 / 5
    }
    if (k > d) return 3 / 5
    return 2 / 5
  },
  StochFast: (
    { k, d } = valuesList.StochFast,
    { buy, sell } = settingsList.StochFast.scoring
  ) => {
    const average = (k + d) / 2
    if (average < buy) {
      if (k > d) return 5 / 5
      return 4 / 5
    }
    if (average > sell) {
      if (k > d) return 1 / 5
      return 0 / 5
    }
    if (k > d) return 3 / 5
    return 2 / 5
  },
  CCI: (
    [last, current] = valuesList.CCI,
    { buy, sell } = settingsList.CCI.scoring
  ) => {
    if (current < buy) {
      if (current > last) return 5 / 5
      return 1 / 5
    }
    if (current > sell) {
      if (current > last) return 4 / 5
      return 0 / 5
    }
    if (current > last) return 3 / 5
    return 2 / 5
  },
  ADX: ({ adx, mdi, pdi } = valuesList.ADX) => {
    if (pdi > mdi) {
      if (adx > pdi) return 3 / 3
      return 2 / 3
    }
    if (adx > pdi) return 1 / 3
    return 0 / 3
  },
  AO: ([last, current] = valuesList.AO) => {
    if (current > 0) {
      if (current > last) return 3 / 3
      return 1 / 3
    }
    if (current > last) return 2 / 3
    return 0 / 3
  },
  MACD: ([last, current] = valuesList.MACD) => {
    if (current.histogram > 0) {
      if (current.histogram > last.histogram) return 3 / 3
      return 1 / 3
    }
    if (current.histogram > last.histogram) return 2 / 3
    return 0 / 3
  },
  WPR: (
    [last, current] = valuesList.WPR,
    { buy, sell } = settingsList.WPR.scoring
  ) => {
    if (current < buy) {
      if (current > last) return 5 / 5
      return 4 / 5
    }
    if (current > sell) {
      if (current > last) return 1 / 5
      return 0 / 5
    }
    if (current > last) return 3 / 5
    return 2 / 5
  },
})