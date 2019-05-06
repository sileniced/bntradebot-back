import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

export interface MoveBackCollector {
  [maLength: string]: {
    w: number
    s: number
  }
}

export interface CrossCollector {
  w: number
  s: number
}

export interface OscillatorCollector {
  [oscilatorName: string]: {
    w: number
    s: number
    se: {
      a: object,
      s: object
    }
  }
}

export interface CandleStickCollectorAnalysis {
  bullish: {
    [name: string]: {
      w: number
      s: number
    }
  }
  bearish: {
    [name: string]: {
      w: number
      s: number
    }
  }
}

export interface CandleStickCollector {
  [depthLevel: number]: {
    w: number
    a: CandleStickCollectorAnalysis
  }
}

export interface ScoresWeightsEntityV1Model {
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
    [symbol: string]:{
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