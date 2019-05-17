import setupDb from './db'
import BinanceApi from './app/Binance'
import MachineLearningTrainer from './app/Analysis/MachineLearning/MachineLearningTrainer'

export const BinanceML = new BinanceApi()

const trainer = new MachineLearningTrainer(BinanceML)

setupDb().then(() => {
  BinanceML.getTime().then(time => {
    trainer.startTraining().catch(console.error)
    console!.log(`Binance time diff: ${time - Date.now()}ms`)
  })
})
.catch((err) => console!.error(err))