import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import User from './User'

@Entity()
class TradeBotEntity extends BaseEntity {

  /* todo: REMEMBER THAT THIS SHOULD CONVERT TO CSV FOR TRAINING AND  */

  @PrimaryGeneratedColumn()
  public id: number

  @ManyToOne(() => User, user => user.savedOrders)
  public user: User

  @Column('time with time zone')
  public tradeTime: Date

  @Column('simple-array')
  public symbols: string[]

  @Column('simple-array')
  public pairs: string[]

  @Column('simple-array')
  private _pricesPairs: number[]

  @Column('simple-array')
  public BalanceSymbols: number[]

  @Column('simple-array')
  public quoteSymbols: string[]

  get pricesPairs(): { [p: string]: number } {
    return this.symbols.forEach(symbol => {
      
    })
  }

  set pricesPairs(value: { [p: string]: number }) {
    this._pricesPairs = value
  }

  private _balanceSymbols: { [symbol: string]: number }
}

export default TradeBotEntity