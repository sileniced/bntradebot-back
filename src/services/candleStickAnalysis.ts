import { CandleChartResult } from "binance-api-node"
import StockData from 'technicalindicators/declarations/StockData'
import { createStockData } from '../utils'
import {
  bearishengulfingpattern,
  bearishhammerstick,
  bearishharami,
  bearishharamicross,
  bearishinvertedhammerstick,
  bearishmarubozu,
  bullishengulfingpattern,
  bullishhammerstick,
  bullishharami,
  bullishharamicross,
  bullishinvertedhammerstick,
  bullishmarubozu,
  downsidetasukigap,
  eveningdojistar,
  eveningstar,
  hammerpattern,
  hammerpatternunconfirmed, hangingman, hangingmanunconfirmed,
  morningdojistar,
  morningstar,
  piercingline, shootingstar, shootingstarunconfirmed,
  threeblackcrows,
  threewhitesoldiers,
  tweezerbottom, tweezertop
} from 'technicalindicators'


const sliceStockData = (data: StockData, last: number): StockData => ({
  open: data.open.slice(-last),
  close: data.close.slice(-last),
  high: data.high.slice(-last),
  low: data.low.slice(-last)
})

const generateResult = analysis => Object.entries(analysis).filter(([, result]) => result).map(([name]) => name)

const CandleStickAnalysis = (candles: CandleChartResult[]): {
  bullish?: string[],
  bearish?: string[]
} => {
  const data: StockData = createStockData(candles)
  const dataLast = {
    [1]: sliceStockData(data, 1),
    [2]: sliceStockData(data, 2),
    [3]: sliceStockData(data, 3),
    [5]: sliceStockData(data, 5)
  }

  return {
    bullish: generateResult({
      BullishEngulfingPattern: bullishengulfingpattern(dataLast[2]),
      DownsideTasukiGap: downsidetasukigap(dataLast[3]),
      BullishHarami: bullishharami(dataLast[2]),
      BullishHaramiCross: bullishharamicross(dataLast[2]),
      MorningDojiStar: morningdojistar(dataLast[3]),
      MorningStar: morningstar(dataLast[3]),
      BullishMarubozu: bullishmarubozu(dataLast[1]),
      PiercingLine: piercingline(dataLast[2]),
      ThreeWhiteSoldiers: threewhitesoldiers(dataLast[3]),
      BullishHammerStick: bullishhammerstick(dataLast[1]),
      BullishInvertedHammerStick: bullishinvertedhammerstick(dataLast[1]),
      HammerPattern: hammerpattern(dataLast[5]),
      HammerPatternUnconfirmed: hammerpatternunconfirmed(dataLast[5]),
      TweezerBottom: tweezerbottom(dataLast[5])
    }),
    bearish: generateResult({
      BearishEngulfingPattern: bearishengulfingpattern(dataLast[2]),
      BearishHarami: bearishharami(dataLast[2]),
      BearishHaramiCross: bearishharamicross(dataLast[2]),
      EveningDojiStar: eveningdojistar(dataLast[3]),
      EveningStar: eveningstar(dataLast[3]),
      BearishMarubozu: bearishmarubozu(dataLast[1]),
      ThreeBlackCrows: threeblackcrows(dataLast[3]),
      BearishHammerStick: bearishhammerstick(dataLast[1]),
      BearishInvertedHammerStick: bearishinvertedhammerstick(dataLast[1]),
      HangingMan: hangingman(sliceStockData(data, 5)),
      HangingManUnconfirmed: hangingmanunconfirmed(dataLast[5]),
      ShootingStar: shootingstar(dataLast[5]),
      ShootingStarUnconfirmed: shootingstarunconfirmed(dataLast[5]),
      TweezerTop: tweezertop(dataLast[5])
    })
  }
}

export default CandleStickAnalysis