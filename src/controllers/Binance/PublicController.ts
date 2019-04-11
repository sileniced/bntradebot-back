import { Get, JsonController, Param, QueryParam } from 'routing-controllers'
import { binance } from '../../index'
import { CandleChartInterval } from 'binance-api-node'

@JsonController()
class PublicController {

  @Get('/public/:symbol')
  public async GetCandles(
    @Param('symbol') symbol: string,
    @QueryParam("interval") interval: CandleChartInterval = '5m'
  ) {
    return await binance.candles({ symbol, interval })
  }

}

export default PublicController