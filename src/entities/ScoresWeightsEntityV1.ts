import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

export interface MoveBackCollector {
  [maLengthNumber: number]: {
    w: number
    s: number
  }
}

export interface CrossCollector {
  w: number
  s: number
}

export interface OscillatorCollector {
  [oscilatorNumber: number]: {
    w: number
    s: number
  }
}

export interface CandleStickCollectorAnalysis {
  bullish: {
    [bullishNumber: number]: {
      w: number
      s: number
    }
  }
  bearish: {
    [bearishNumber: number]: {
      w: number
      s: number
    }
  }
}

export interface CandleStickCollector {
  [depthLevelNumber: number]: {
    w: number
    a: CandleStickCollectorAnalysis
  }
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
    [pair: string]: {
      [interval: string]: {
        w: number
        a: {
          tech: {
            w: number
            a: {
              oscillators: {
                w: number
                a: OscillatorCollector
              }
              candlesticks: {
                w: number
                a: CandleStickCollector
              }
              moveBack: {
                w: number
                a: MoveBackCollector
              }
              cross: CrossCollector
              priceChange: {
                w: number
                s: number
              }
            }
          }
        }
      }
    }
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

@Entity()
class ScoresWeightsEntityV1 extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number

  @Column('simple-json')
  public scoresWeights: ScoresWeightsEntityV1Model

}

export default ScoresWeightsEntityV1