import setupDb from './db'
import BinanceApi from './app/Binance'
import MLTrainer from './app/Analysis/MachineLearning/MLTrainer'

export const BinanceML = new BinanceApi()

const trainer = new MLTrainer(BinanceML)

setupDb().then(() => {
  BinanceML.getTime().then(time => {
    trainer.startTraining().catch(console.error)
    console!.log(`Binance time diff: ${time - Date.now()}ms`)
  })
})
.catch((err) => console!.error(err))