import binance, {
  Binance,
  ExchangeInfo,
  Symbol,
  AssetBalance,
  OrderBook,
  NewOrder,
  Order,
  OrderSide, OrderStatus, TimeInForce, OrderType, OrderFill
} from 'binance-api-node'
import User from '../entities/User'
import tradebot, { TradeBot } from './TradeBot'
import SavedOrder from '../entities/SavedOrder'

interface realOrder {
  clientOrderId: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  icebergQty?: string;
  orderId: number;
  origQty: string;
  price: string;
  side: OrderSide;
  status: OrderStatus;
  stopPrice?: string;
  symbol: string;
  timeInForce: TimeInForce;
  transactTime: number;
  type: OrderType;
  fills?: OrderFill[];
}




class BinanceApi {

  public api: Binance
  private authenticatedApi: { [userId: number]: Binance } = {}

  private readonly exchangeInfo: Promise<ExchangeInfo>

  private readonly settings = {
    globalTradeInterval: 1000 * 10
  }

  private readonly beautifulLog = (result: TradeBot) => [
  `
  
  tradeinterval: ${this.settings.globalTradeInterval / 1000 / 60}m
  bugs: getNotionalAmount()
  time: ${new Date()}
  
  Participating Pairs: 
  ${result.data.participatingPairs.toString()}
  
  Order Pairs:
  `,
  `
  
  Final Orders: 
  `,
  `
  
  Order Result: 
  `
    ]

  private activeTradeBotUserIds: number[] = []
  private activeTradeBotUsers: { [userId: number]: User } = {}
  private tradeBotExecute = (): void => {
    this.activeTradeBotUserIds.forEach(id => {
      tradebot(this.activeTradeBotUsers[id]).then(result => {
        const log = this.beautifulLog(result)
        console.log(log[0])
        console.table(result.data.orderPairs)
        console.log(log[1])
        console.table(result.data.finalOrders)
        console.log(log[2])
        console.table(result.data.ordersResult)

      })
    })
  }

  constructor() {
    this.api = binance()
    this.exchangeInfo = this.api.exchangeInfo()
  }


  public startAutoTradeBots = (startNow: boolean = true): void => {
    User.find({ where: { autoTrading: true } }).then(users => {

      users.forEach(user => {
        this.setAuthenticatedApi(user.id, { apiKey: user.binanceKey, apiSecret: user.binanceSecret })
        this.activateTradeBot(user)
      })

      if (startNow) this.tradeBotExecute()
      setInterval(this.tradeBotExecute, this.settings.globalTradeInterval)
    })
  }

  public activateTradeBot = (user: User): void => {
    console.log(`traderBot started for: ${user.fullName()}`)
    this.activeTradeBotUserIds.push(user.id)
    this.activeTradeBotUsers[user.id] = user
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


  public newOrder = (user: User, order: NewOrder): Promise<SavedOrder> => this.authenticatedApi[user.id].order(order)
  .then((result: realOrder) => SavedOrder.create({
      user,
      clientOrderId: result.clientOrderId,
      orderId: result.orderId,
      pair: result.symbol,
      side: result.side,
      transactTime: result.transactTime,
      executedQty: parseFloat(result.executedQty),
      cummulativeQuoteQty: parseFloat(result.cummulativeQuoteQty)
    })
  )
  .catch(error => {
    console.error(error)
    return error
  })

  public newOrderTest = (userId: number, order: NewOrder): Promise<Order> => this.authenticatedApi[userId].orderTest(order).catch(error => {
    console.error(error)
    return error
  })
}

export default BinanceApi