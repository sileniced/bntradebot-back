import binance, { Binance, ExchangeInfo, Symbol } from 'binance-api-node'

class BinanceApi {
  public api: Binance
  private readonly exchangeInfo: Promise<ExchangeInfo>

  constructor(options?) {
    this.api = binance(options)
    this.exchangeInfo = this.api.exchangeInfo()
  }

  public getPairs = (): Promise<Symbol[]> => this.exchangeInfo.then(ExchangeInfo => ExchangeInfo.symbols)

  public getTime = (): Promise<number> => this.api.time()

}

export default BinanceApi