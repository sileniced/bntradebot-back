export interface MoveBackSW {
  [maLengthIdx: number]: {
    w: number
    s: number
  }
}

export interface CrossSW {
  w: number
  s: number
}

export interface OscillatorSW {
  [oscilatorIdx: number]: {
    w: number
    s: number
  }
}

export interface CandleStickBullBear {
  bullish: {
    [bullishIdx: number]: {
      w: number
      s: number
    }
  }
  bearish: {
    [bearishIdx: number]: {
      w: number
      s: number
    }
  }
}

export interface CandleStickLevelSW {
  w: number
  s: number
  a: CandleStickBullBear
}

export interface CandleStickData {
  [depthLevelIdx: number]: CandleStickLevelSW
}

export interface TechAnalysis {
  oscillators: {
    w: number
    s: number
    a: OscillatorSW
  }
  candlesticks: {
    w: number
    s: number
    a: CandleStickData
  }
  moveBack: {
    w: number
    s: number
    a: MoveBackSW
  }
  cross: CrossSW
  priceChange: {
    w: number
    s: number
  }
}

export interface IntervalDataSWA {
  w: number
  s: number
  a: {
    tech: {
      w: number
      s: number
      a: TechAnalysis
    }
  }
}

export interface IntervalData {
  [interval: string]: IntervalDataSWA
}

export interface PairData {
  o: number,
  s: number
  a: IntervalData
}

export interface ScoresWeightsEntityV1Model {
  names: {
    oscillators: { [oscilatorName: string]: number }
    candlesticks: {
      bullish: { [bullishName: string]: number }
      bearish: { [bearishName: string]: number }
    }
    moveBack: { [moveBackName: string]: number }
  },
  pairs: {
    [pair: string]: PairData
  }
  symbols: {
    [symbol: string]: {
      news: {
        w: number
        s: number
      }
    }
  }
  market: {
    [market: string]: {
      w: number
      s: number
    }
  }
}

const test = (property: string, data: object, acc: number = 0): number => {
  if (typeof data !== 'object') return acc;
  if (property in data) {
    const sum = Object.keys(data).reduce((sum, p) => property === p ? sum + data[property] : sum, acc);
    return Object.keys(data).map(key => test(property, data[key], sum)).reduce((sum, n) => sum + n);

  } else {
    return Object.keys(data).map(key => test(property, data[key], acc)).reduce((sum, n) => sum + n);
  }
}