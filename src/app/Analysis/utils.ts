export const dataCollectorMoveBackNames = {
  'EMA10': 0,
  'EMA20': 1,
  'EMA50': 2,
  'EMA100': 3,
  'EMA200': 4,
  'SMA10': 5,
  'SMA20': 6,
  'SMA50': 7,
  'SMA100': 8,
  'SMA200': 9,
}

export const dataCollectorCandlestickNames = {
  bullish: {
    'BullishEngulfingPattern': 0,
    'DownsideTasukiGap': 1,
    'BullishHarami': 2,
    'BullishHaramiCross': 3,
    'MorningDojiStar': 4,
    'MorningStar': 5,
    'BullishMarubozu': 6,
    'PiercingLine': 7,
    'ThreeWhiteSoldiers': 8,
    'BullishHammerStick': 9,
    'BullishInvertedHammerStick': 10,
    'HammerPattern': 11,
    'HammerPatternUnconfirmed': 12,
    'TweezerBottom': 13
  },
  bearish: {
    'BearishEngulfingPattern': 0,
    'BearishHarami': 1,
    'BearishHaramiCross': 2,
    'EveningDojiStar': 3,
    'EveningStar': 4,
    'BearishMarubozu': 5,
    'ThreeBlackCrows': 6,
    'BearishHammerStick': 7,
    'BearishInvertedHammerStick': 8,
    'HangingMan': 9,
    'HangingManUnconfirmed': 10,
    'ShootingStar': 11,
    'ShootingStarUnconfirmed': 12,
    'TweezerTop': 13
  }
}

export const dataCollectorOscillatorNames = {
  'RSI': 0,
  'StochRSI': 1,
  'StochFast': 2,
  'CCI': 3,
  'ADX': 4,
  'AO': 5,
  'MACD': 6,
  'WPR': 7
}

export const addScores = scores => Object.values(scores).reduce((acc, { _score }) => acc + _score, 0)