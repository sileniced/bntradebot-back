import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import User from './User'
import TradeBotEntity from './TradeBotEntity'

@Entity()
class SavedOrder extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number

  @ManyToOne(() => User, user => user.savedOrders)
  public user: User

  @ManyToOne(() => TradeBotEntity, tradeBotEntity => tradeBotEntity.savedOrders)
  public tradeBotEntity: TradeBotEntity

  @Column('text', { nullable: false })
  public clientOrderId: string

  @Column('integer', { nullable: false })
  public orderId: number

  @Column('text', { nullable: false })
  public pair: string

  @Column('text', { nullable: false })
  public side: string

  @Column('bigint', { nullable: false })
  public transactTime: number

  @Column('decimal', { nullable: false })
  public executedQty: number

  @Column('decimal', { nullable: false })
  public cummulativeQuoteQty: number

  @Column('decimal', { nullable: false })
  public feeDollars: number
}

export default SavedOrder