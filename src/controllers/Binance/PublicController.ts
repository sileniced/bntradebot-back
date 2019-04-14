import { Get, JsonController, Param } from 'routing-controllers'
import { binance } from '../../index'
import { CandleChartResult } from 'binance-api-node'

import CandleStickAnalysis from '../../services/candleStickAnalysis'
import Oscillators from '../../services/Oscillators'
import StockData from 'technicalindicators/declarations/StockData'
import CreateStockData from '../../services/CreateStockData'
import { addEVENWeight, addScores } from '../../services/utils'
import MovingAverages from '../../services/MovingAverages'

@JsonController()
class PublicController {

  @Get('/public/analysis/:symbol')
  public async GetAnalysis(
    @Param('symbol') symbol: string
  ) {
    const intervalList = addEVENWeight([['1m'], ['3m'], ['5m'], ['15m'], ['30m'], ['1h'], ['2h'], ['4h'], ['6h'], ['8h'], ['12h'], ['1d']])
    // const intervalList = addEVENWeight([['1m'], ['1h'], ['1d']])
    const analysisList = addEVENWeight([
      ['Oscillators', Oscillators],
      ['CandleStickAnalysis', CandleStickAnalysis],
      ['MovingAverages', MovingAverages]
    ], [0.45, 0.2, 0.35])

    const candlesList: CandleChartResult[][] = await Promise.all(intervalList.map(([interval]) => binance.candles({
      symbol,
      interval,
      limit: 200
    })))

    const intervalAnalysis = candlesList.reduce((acc, intervalCandles, idx) => {
      const IntervalData: StockData = CreateStockData(intervalCandles)

      const analysis = analysisList.reduce((acc, [name, executable, weight]) => {
        const values = executable(IntervalData)
        acc[name] = {
          _score: values._score * weight,
          _unWeightedScore: values._score,
          values
        }
        return acc
      }, {})

      const unweightedScore = addScores(analysis)

      acc[intervalList[idx][0]] = {
        _score: unweightedScore * intervalList[idx][1],
        _unweightedScore: unweightedScore,
        analysis: analysis
      }

      return acc
    }, {})

    return {
      _score: addScores(intervalAnalysis),
      intervalAnalysis
    }

  }
}

export default PublicController