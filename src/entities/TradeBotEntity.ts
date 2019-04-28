import { BaseEntity, Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import User from './User'
import { parseDropCode } from '../services/utils'
import { OrderSide } from 'binance-api-node'
import { Trade } from '../app/TradeBot/TradeBot'
import SavedOrder from './SavedOrder'

export interface DroppedPairEntity {
  pair: string
  dropCode: number
  proof?: string
  score?: number
  price?: number
  side?: OrderSide
  provider?: string
  collector?: string
  pairScore?: number
  minBase?: number
  minQuote?: number
  stepSize?: number
  providerFundsBtc?: number
  collectorAmountBtc?: number
  providerFunds?: number
  collectorAmount?: number
  baseAmount?: number
  quoteAmount?: number
}

export interface TradePairEntity extends Trade {
  pair: string
  baseAmount: number
  status: string
}

@Entity()
class TradeBotEntity extends BaseEntity {
  /* todo: REMEMBER THAT THIS SHOULD CONVERT TO CSV FOR TRAINING AND ARCHIVING */

  @PrimaryGeneratedColumn()
  public id: number

  @ManyToOne(() => User, user => user.tradeBotEntity)
  public user: User

  @OneToMany(() => SavedOrder, savedOrders => savedOrders.tradeBotEntity)
  public savedOrders: SavedOrder

  @Column('timestamp with time zone')
  public tradeTime: Date

  @Column('simple-array')
  public symbols: string[]

  @Column('simple-array')
  public pairs: string[]

  @Column('simple-array')
  public markets: string[]

  @Column('decimal')
  public dollarDiffPostTrade: number

  @Column('simple-array')
  private _pricesPairs: string[]

  @Column('simple-array')
  private _balanceSymbols: string[]

  @Column('simple-array')
  private _analysisTechPairs: string[]

  @Column('simple-array')
  private _analysisMarket: string[]

  @Column('simple-array')
  private _symbolPie: string[]

  @Column('text')
  private _droppedPairs: string

  @Column('text')
  private _tradePairs: string

  @Column('simple-array')
  private _balancePostTradeSymbols: string[]

  get pricesPairs(): { [pair: string]: number } {
    return this.pairs.reduce((acc, pair, idx) => {
      acc[pair] = parseFloat(this._pricesPairs[idx])
      return acc
    }, {})
  }

  set pricesPairs(pairs: { [pair: string]: number }) {
    this._pricesPairs = this.pairs.map(pair => {
      if (pairs[pair]) return pairs[pair].toString()
      return ''
    })
  }

  get balanceSymbols(): { [symbol: string]: number } {
    return this.symbols.reduce((acc, symbol, idx) => {
      acc[symbol] = parseFloat(this._balanceSymbols[idx])
      return acc
    }, {})
  }

  set balanceSymbols(symbols: { [symbol: string]: number }) {
    this._balanceSymbols = this.symbols.map(symbol => symbols[symbol].toString())
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

  get analysisTechPairs(): { [pair: string]: number } {
    return this.pairs.reduce((acc, pair, idx) => {
      acc[pair] = parseFloat(this._analysisTechPairs[idx])
      return acc
    }, {})
  }

  set analysisTechPairs(pairs: { [pair: string]: number }) {
    this._analysisTechPairs = this.pairs.map(pair => pairs[pair].toString())
  }

  get analysisMarket(): { [market: string]: number } {
    return this.markets.reduce((acc, marketSymbol, idx) => {
      acc[marketSymbol] = parseFloat(this._analysisMarket[idx])
      return acc
    }, {})
  }

  set analysisMarket(markets: { [market: string]: number }) {
    this._analysisMarket = this.markets.map(market => markets[market].toString())
  }

  get droppedPairs(): DroppedPairEntity[] {
    const split = this._droppedPairs.split(',')
    const droppedPairs: DroppedPairEntity[] = []
    for (let i = 0, len = split.length; i < len; i += 3) {
      droppedPairs.push({
        pair: split[i],
        dropCode: parseInt(split[i + 1]),
        proof: split[i + 2]
      } as DroppedPairEntity)
    }
    return droppedPairs
  }

  set droppedPairs(pairs: DroppedPairEntity[]) {
    const droppedPairs = pairs.reduce((acc, pair) => acc + `${pair.pair},${pair.dropCode},${parseDropCode(pair)[1]},`, '')
    this._droppedPairs = droppedPairs.slice(0, droppedPairs.length - 1)
  }

  get tradePairs(): TradePairEntity[] {
    const split = this._tradePairs.split(',')
    const trades: TradePairEntity[] = []
    for (let i = 0, len = split.length; i < len; i += 3) {
      trades.push({
        pair: split[i],
        baseAmount: parseInt(split[i + 1]),
        status: split[i + 2]
      } as TradePairEntity)
    }
    return trades
  }

  set tradePairs(pairs: TradePairEntity[]) {
    const trades = pairs.reduce((acc, pair) => acc + `${pair.pair},${pair.baseAmount},${pair.success},`, '')
    this._tradePairs = trades.slice(0, trades.length - 1)
  }

  get balancePostTradeSymbols(): { [symbol: string]: number } {
    return this.symbols.reduce((acc, symbol, idx) => {
      acc[symbol] = parseFloat(this._balancePostTradeSymbols[idx])
      return acc
    }, {})
  }

  set balancePostTradeSymbols(symbols: { [symbol: string]: number }) {
    this._balancePostTradeSymbols = this.symbols.map(symbol => symbols[symbol].toString())
  }
}

export default TradeBotEntity