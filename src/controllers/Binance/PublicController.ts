import { Get, JsonController, Param, QueryParam } from 'routing-controllers'
import { binance } from '../../index'
import { CandleChartInterval, CandleChartResult } from 'binance-api-node'
import CandleStickAnalysis from '../../services/candleStickAnalysis'
import { RSI } from 'technicalindicators'

@JsonController()
class PublicController {

  @Get('/public/analysis/:symbol')
  public async GetAnalysis(
    @Param('symbol') symbol: string,
    @QueryParam('interval') interval: CandleChartInterval = '5m'
  ) {
    const candles: CandleChartResult[] = await binance.candles({ symbol, interval })
    return {
      candleStickAnalysis: CandleStickAnalysis(candles),
      indicators: {
        RSI: RSI.calculate({
          period: 14,
          values: candles.map(candle => parseFloat(candle.close))
        }).slice(-1)[0]
      }
    }
  }

}

export default PublicController