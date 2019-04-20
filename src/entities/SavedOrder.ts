import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import User from './User'

@Entity()
class SavedOrder extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number

  @ManyToOne(() => User, user => user.savedOrders)
  public user: User

  @Column('text', { nullable: false })
  public clientOrderId: string

  @Column('integer', { nullable: false })
  public orderId: number

  @Column('text', { nullable: false })
  public pair: string

  @Column('text', { nullable: false })
  public side: string

  @Column('integer', { nullable: false })
  public transactTime: number

  @Column('integer', { nullable: false })
  public executedQty: number

  @Column('integer', { nullable: false })
  public cummulativeQuoteQty: number
}

export default SavedOrder