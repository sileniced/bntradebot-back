import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { IntervalData } from './ScoresWeightsEntityV1'

@Entity()
class PairWeightsEntityV1 extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number

  @Column('text', { unique: true })
  public pairName

  @Column('simple-json')
  public weights: IntervalData

}

export default PairWeightsEntityV1