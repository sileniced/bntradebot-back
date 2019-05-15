import binance, {
  AssetBalance,
  AvgPriceResult,
  Binance, CandleChartInterval,
  CandleChartResult,
  ExchangeInfo,
  NewOrder,
  OrderBook,
  OrderFill,
  OrderSide,
  OrderStatus,
  OrderType,
  Symbol,
  TimeInForce
} from 'binance-api-node'
import User from '../entities/User'
import SavedOrder from '../entities/SavedOrder'
import TradeBot from './TradeBot/TradeBot'
import CreateTechAnalysisData from './Analysis/CreateTechAnalysisData'
import StockData from 'technicalindicators/declarations/StockData'
// import TradeBotEntity from '../entities/TradeBotEntity'
// import { Raw } from 'typeorm'

export interface RealOrderResult {
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

export interface TestOrderResult {
  feeDollars: number,
  pair: string,
  orderId: string
}

class BinanceApi {

  public api: Binance
  private authenticatedApi: { [userId: number]: Binance } = {}

  private readonly exchangeInfo: Promise<ExchangeInfo>

  private readonly settings = {
    globalTradeInterval: 1000 * 60 * 10 /*10000*/
  }

  private prevTradeBot: { [userId: number]: TradeBot } = {}
  private activeTradeBotUserIds: number[] = []
  private activeTradeBotUsers: { [userId: number]: User } = {}
  private tradeBotExecute = (): void => {

    this.activeTradeBotUserIds.forEach(id => {

      this.prevTradeBot[id] = new TradeBot(this.activeTradeBotUsers[id], this.prevTradeBot[id])
      this.prevTradeBot[id].run(this).catch(console.error)
    })



    // TradeBotEntity.find({
    //   relations: ['scoresWeightsV1'],
    //   where: {
    //     tradeTime: Raw(alias => `${alias} < NOW() - INTERVAL '1 DAY'`)
    //   },
    // }).then(tradeBotEntity => {
    //   tradeBotEntity.forEach(entity => entity.scoresWeightsV1.remove())
    // })
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
  public getAvgPrice = (symbol): Promise<number> => this.api.avgPrice({ symbol })
  .then((avgPrice: AvgPriceResult): number => {
    return parseFloat({}.toString.call(avgPrice) == '[object Array]' ? avgPrice[0].price : avgPrice.price)
  })
  .catch(error => {
    console.error(symbol, error)
    return error
  })

  public getCandles = (symbol, interval): Promise<CandleChartResult[]> => this.api.candles({
    symbol,
    interval,
    limit: 200
  })
  .catch(error => {
    console.error(error)
    return error
  })

  public getCandlesStockData = (
    symbol: string,
    interval: CandleChartInterval,
    limit: number = 200,
    history?: number
  ): Promise<StockData> => this.api.candles({
    symbol,
    interval,
    limit,
    endTime: history
  })
  .then(candles => CreateTechAnalysisData(candles))
  .catch(error => {
    console.error(error)
    return error
  })

  public getBook = (symbol): Promise<OrderBook> => this.api.book({ symbol })

  public checkAuthenticatedApi = (userId: number): boolean => !!this.authenticatedApi[userId]
  public setAuthenticatedApi = (userId: number, options: { apiKey: string, apiSecret: string }): void => {
    this.authenticatedApi[userId] = binance(options)
  }

  public getAccountBalances = (userId: number): Promise<AssetBalance[]> => this.authenticatedApi[userId].accountInfo()
  .then(result => result.balances)


  public newOrder = (user: User, feeDollars: number, order: NewOrder): Promise<SavedOrder> =>
    this.authenticatedApi[user.id].order(order)
    .then((result: RealOrderResult) => SavedOrder.create({
        user,
        ...result,
        pair: result.symbol,
        executedQty: parseFloat(result.executedQty),
        cummulativeQuoteQty: parseFloat(result.cummulativeQuoteQty),
        feeDollars
      })
    )
    .catch(error => {
      console.error(error)
      return error
    })

  public newOrderTest = (user: User, feeDollars: number, order: NewOrder): Promise<SavedOrder> =>
    this.authenticatedApi[user.id].orderTest(order)
    .then((result: any) => {
      result.baseAmount = order.quantity
      result.pair = order.symbol
      result.feeDollars = feeDollars
      result.orderId = 'test'
      return result
    })
    .catch(error => {
      console.error(error)
      return error
    })
}

export default BinanceApi