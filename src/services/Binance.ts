import binance, { Binance, ExchangeInfo, Symbol, AssetBalance, OrderBook, NewOrder, Order } from 'binance-api-node'
import User from '../entities/User'
import TradeBot from './TradeBot'

class BinanceApi {

  public api: Binance
  private authenticatedApi: {
    [userId: number]: Binance
  } = {}

  private readonly exchangeInfo: Promise<ExchangeInfo>

  constructor() {
    this.api = binance()
    this.exchangeInfo = this.api.exchangeInfo()
  }


  public startAutoTradeBots = (): void => {
    User.find({
      where: { autoTrading: true }
    }).then(users => {

      users.forEach(user => {

        this.setAuthenticatedApi(user.id, { apiKey: user.binanceKey, apiSecret: user.binanceSecret })

        console.log(`
          traderBot started for: ${user.fullName()}
        `)

        setInterval(() => {
          TradeBot(user).then(result => {
            console.log(result.data.finalOrders)
            console.log(result.data.ordersResult)
          })
        }, 1000 * 60 * 5)

      })
    })


  }


  public getTime = (): Promise<number> => this.api.time()
  public getPairs = (): Promise<Symbol[]> => this.exchangeInfo.then(ExchangeInfo => ExchangeInfo.symbols)
  public getBook = (symbol): Promise<OrderBook> => this.api.book({ symbol })

  public checkAuthenticatedApi = (userId: number): boolean => !!this.authenticatedApi[userId]
  public setAuthenticatedApi = (userId: number, options: { apiKey: string, apiSecret: string }): void => {
    this.authenticatedApi[userId] = binance(options)
  }

  public getAccountBalances = (userId: number): Promise<AssetBalance[]> => this.authenticatedApi[userId].accountInfo()
  .then(result => result.balances)

  public newOrder = (userId: number, order: NewOrder): Promise<Order> => this.authenticatedApi[userId].order(order).catch(error => {
    console.error(error)
    return error
  })

  public newOrderTest = (userId: number, order: NewOrder): Promise<Order> => this.authenticatedApi[userId].orderTest(order).catch(error => {
    console.error(error)
    return error
  })
}

export default BinanceApi