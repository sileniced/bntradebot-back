export default {
  RSI: {
    analyse: {
      period: 14
    },
    scoring: {
      buy: 30,
      sell: 70
    }
  },
  StochRSI: {
    analyse: {
      kPeriod: 3,
      dPeriod: 3,
      rsiPeriod: 14,
      stochasticPeriod: 14
    },
    scoring: {
      buy: 20,
      sell: 80
    }
  },
  StochFast: {
    analyse: {
      period: 14,
      signalPeriod: 3
    },
    scoring: {
      buy: 20,
      sell: 80
    }
  },
  CCI: {
    analyse: {
      period: 20
    },
    scoring: {
      sell: 100,
      buy: -100
    }
  },
  ADX: {
    analyse: {
      period: 14
    }
  },
  AO: {
    analyse: {
      fastPeriod: 5,
      slowPeriod: 34
    }
  },
  MACD: {
    analyse: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    }
  },
  WPR: {
    analyse: {
      period: 14
    },
    scoring: {
      buy: -80,
      sell: -20
    }
  }
}