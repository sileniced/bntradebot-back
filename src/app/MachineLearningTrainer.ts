import User from '../entities/User'

import { Symbol } from 'binance-api-node'
import { PairData } from '../entities/ScoresWeightsEntityV1'
import BinanceApi from './Binance'
import StockData from 'technicalindicators/declarations/StockData'
import Analysis from './Analysis'
import PairWeightsEntityV1 from '../entities/PairWeightsEntityV1'

interface IMachineLearningTrainer {
  startTraining: () => void
}

const firstTradeDay = {
  'BTCUSDT': '08/17/2017',
  'ETHUSDT': '08/17/2017',
  'BNBUSDT': '11/06/2017',
  'NEOUSDT': '11/20/2017',
  'LTCUSDT': '12/13/2017',
  'EOSUSDT': '05/28/2018',
  'IOTAUSDT': '05/31/2018',
  'BCHABCUSDT': '11/16/2018',

  'ETHBTC': '07/14/2017',
  'LTCBTC': '07/14/2017',
  'BNBBTC': '07/14/2017',
  'NEOBTC': '07/14/2017',
  'IOTABTC': '09/30/2017',
  'EOSBTC': '10/11/2017',
  'BCHABCBTC': '11/16/2018',

  'EOSETH': '07/27/2017',
  'BNBETH': '08/09/2017',
  'NEOETH': '09/28/2017',
  'IOTAETH': '09/30/2017',
  'LTCETH': '12/13/2017',

  'NEOBNB': '11/20/2017',
  'IOTABNB': '11/28/2017',
  'LTCBNB': '12/13/2017',
  'EOSBNB': '05/28/2018',
}


function shuffle(array): any[] {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]] // swap elements
  }
  return array
}

class MachineLearningTrainer implements IMachineLearningTrainer {

  private readonly Binance: BinanceApi

  private activateTrainingUsers: { [id: number]: User } = {}
  private activePairs: {
    [pair: string]: {
      users: number[]
      info: Symbol
      weights: PairData
    }
  } = {}

  constructor(Binance: BinanceApi) {
    this.Binance = Binance
  }

  private trainingExecute = async (): Promise<void> => {
    const selectedPairs = shuffle(Object.keys(this.activePairs)).slice(-10)
    const now = Date.now() - (1000 * 60 * 10)

    let history = {}

    /**
     * SELECT TRAINING TIME
     */
    const participatingPairs = selectedPairs.filter(pair => {
      const firstTrainDay = new Date(firstTradeDay[pair]).getTime() + (1000 * 60 * 60 * 24 * 200)
      if (firstTrainDay > now) return false
      history[pair] = Math.round(firstTrainDay + (Math.random() * (now - firstTrainDay)))
      return true
    })

    console.table(history)

    /**
     *
     */
    const prevOptimalScorePromises: Promise<void>[] = participatingPairs.map(pair => {
      const dataCollector = this.activePairs[pair].weights
      return this.Binance.getCandlesStockData(
        pair,
        '5m',
        15,
        history[pair] + (1000 * 60 * 10))
      .then((candles: StockData) => {
        const [current, , future] = candles.close.slice(-3)
        dataCollector.o = Analysis.getPrevOptimalScore(
          Analysis.getPrevOptimalSmaScore(candles),
          Analysis.getPriceChangeScore(current, future)
        )
      })
    })

    await Promise.all(prevOptimalScorePromises)

    console.table(participatingPairs.reduce((acc, pair) => {
      acc[pair] = this.activePairs[pair].weights.o
      return acc
    }, {}))

    // const techAnalysisPromises: Promise<void>[] = []
    //
    // selectedPairs.forEach(pair => {
    //   Analysis.intervalList.forEach((interval, intervalIdx) => {
    //     techAnalysisPromises.push(this.Binance.getCandlesStockData(pair, interval, 200, history[pair])
    //     .then((candles: StockData) => {
    //
    //     }))
    //   })
    // })
  }



  public startTraining = async (): Promise<void> => {

    const allPairs = await this.Binance.getPairs()
    const users = await User.find({ where: { autoTrading: true } })

    let pairWeightsPromises: Promise<void>[] = []

    users.forEach(user => {
      this.activateTrainingUsers[user.id] = user
      allPairs
      .filter(pair => user.symbols.includes(pair.baseAsset) && user.symbols.includes(pair.quoteAsset))
      .forEach(pair => {
        if (!this.activePairs[pair.symbol]) {
          pairWeightsPromises.push(PairWeightsEntityV1.findOne({ where: { pairName: pair } }).then(pairWeights => {
            this.activePairs[pair.symbol] = {
              users: [user.id],
              info: pair,
              weights: {
                a: pairWeights ? pairWeights.weights : {

                },
                o: 0.5,
                s: 0.5
              }
            }
          }))
        } else {
          this.activePairs[pair.symbol].users.push(user.id)
        }
      })
    })

    this.trainingExecute().catch(console.error)
    // setInterval(this.trainingExecute, 6000)
  }

}

export default MachineLearningTrainer