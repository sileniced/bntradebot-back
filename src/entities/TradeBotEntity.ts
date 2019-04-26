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
  private _pricesPairs: string[]

  @Column('simple-array')
  private _balanceSymbols: string[]

  @Column('simple-array')
  public quoteSymbols: string[]

  get pricesPairs(): { [pair: string]: number } {
    return this.pairs.reduce((acc, pair, idx) => {
      acc[pair] = parseFloat(this._pricesPairs[idx])
      return acc
    }, {})
  }

  set pricesPairs(value: { [pair: string]: number }) {
    this._pricesPairs = this.pairs.map(pair => value[pair].toString())
  }

  get balanceSymbols(): { [symbol: string]: number } {
    return this.symbols.reduce((acc, symbol, idx) => {
      acc[symbol] = parseFloat(this._balanceSymbols[idx])
      return acc
    }, {})
  }

  set balanceSymbols(value: { [symbol: string]: number }) {
    this._balanceSymbols = this.symbols.map(symbol => value[symbol].toString())
  }
}

export default TradeBotEntity