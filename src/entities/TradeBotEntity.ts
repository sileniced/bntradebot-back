import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import User from './User'
import { DroppedPair } from '../exec/TradeBot/TradeBot'
import { parseDropCode } from '../services/utils'

@Entity()
class TradeBotEntity extends BaseEntity {
  /* todo: REMEMBER THAT THIS SHOULD CONVERT TO CSV FOR TRAINING AND ARCHIVING */

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
  public marketSymbols: string[]

  @Column('integer')
  public dollarDiffPostTrade: number

  @Column('simple-array')
  private _pricesPairs: string[]

  @Column('simple-array')
  private _balanceSymbols: string[]

  @Column('simple-array')
  private _analysisPair: string[]

  @Column('simple-array')
  private _analysisMarket: string[]

  @Column('simple-array')
  private _symbolPie: string[]

  @Column('simple-array')
  private _droppedPairs: string[]

  @Column('simple-array')
  private _balancePostTradeSymbols: string[]

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

  get symbolPie(): { [symbol: string]: number } {
    return this.symbols.reduce((acc, symbol, idx) => {
      acc[symbol] = parseFloat(this._symbolPie[idx])
      return acc
    }, {})
  }

  set symbolPie(value: { [symbol: string]: number }) {
    this._symbolPie = this.symbols.map(symbol => value[symbol].toString())
  }

  get analysisPair(): { [pair: string]: number } {
    return this.pairs.reduce((acc, pair, idx) => {
      acc[pair] = parseFloat(this._analysisPair[idx])
      return acc
    }, {})
  }

  set analysisPair(value: { [pair: string]: number }) {
    this._analysisPair = this.pairs.map(pair => value[pair].toString())
  }

  get analysisMarket(): { [market: string]: number } {
    return this.marketSymbols.reduce((acc, marketSymbol, idx) => {
      acc[marketSymbol] = parseFloat(this._analysisMarket[idx])
      return acc
    }, {})
  }

  set analysisMarket(value: { [market: string]: number }) {
    this._analysisMarket = this.marketSymbols.map(marketSymbol => value[marketSymbol].toString())
  }

  get droppedPairs(): DroppedPair[] {
    const droppedPairs: DroppedPair[] = []
    for (let i = 0, len = this.pairs.length * 2; i < len; i + 2) {
      droppedPairs.push({
        score: 0,
        side: 'BUY',
        provider: '',
        collector: '',
        pair: this.pairs[2 / 2],
        dropCode: parseInt(this._droppedPairs[i]),
        proof: this._droppedPairs[i + 2]
      } as DroppedPair)
    }
    return droppedPairs
  }

  set droppedPairs(value: DroppedPair[]) {
    const droppedPairs = this.pairs.reduce((acc, pair) => {
      acc[pair] = {}
      return acc
    }, {})
    value.forEach(pair => {
      droppedPairs[pair.pair] = pair
    })
    this._droppedPairs = this.pairs.map(pair => droppedPairs[pair].pair
      ? `${droppedPairs[pair].dropCode},${parseDropCode(droppedPairs[pair])[1]}`
      : ',')
  }

  get balancePostTradeSymbols(): { [symbol: string]: number } {
    return this.symbols.reduce((acc, symbol, idx) => {
      acc[symbol] = parseFloat(this._balancePostTradeSymbols[idx])
      return acc
    }, {})
  }

  set balancePostTradeSymbols(value: { [symbol: string]: number }) {
    this._balancePostTradeSymbols = this.symbols.map(symbol => value[symbol].toString())
  }
}

export default TradeBotEntity