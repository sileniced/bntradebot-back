import settings from './settings'

export default (close, valuesList, settingsList = settings) => Object.keys(settingsList).reduce((acc, movingAverage) => {
  return {
    ...acc,
    ...settingsList[movingAverage].periods.reduce((acc, period) => {
      acc[`${movingAverage}${period}`] = {
        _score: valuesList[movingAverage][period] < close ? 1 : 0,
        value: valuesList[movingAverage][period]
      }
      return acc
    }, {})
  }
}, {})