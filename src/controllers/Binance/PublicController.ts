import { Get, JsonController, Param } from 'routing-controllers'
import { binance } from '../../index'
import { CandleChartResult, CandleChartInterval } from 'binance-api-node'

import CandleStickAnalysis from '../../services/candleStickAnalysis'
import IndicatorAnalysis, { settings } from '../../services/indicatorsAnalysis'

@JsonController()
class PublicController {

  @Get('/public/analysis/:symbol')
  public async GetAnalysis(
    @Param('symbol') symbol: string
  ) {
    const candlePromise = (interval: CandleChartInterval) => binance.candles({ symbol, interval })
    // const intervalList: CandleChartInterval[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d']
    const intervalList: CandleChartInterval[] = ['1m', '1h', '1d']

    const candlesList: CandleChartResult[][] = await Promise.all(intervalList.map(candlePromise))

    return {
      description: { settings },
      body: candlesList.reduce((acc, candles, idx) => {
        acc[intervalList[idx]] = {
          candleStickAnalysis: CandleStickAnalysis(candles),
          indicatorsAnalysis: IndicatorAnalysis(candles)
        }
        return acc
      }, {}),
    }
  }
}

export default PublicController