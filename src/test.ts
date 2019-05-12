import { addMachineLearningWeights } from './app/Analysis/mlWeightUtils'

console.table(addMachineLearningWeights(0.6, [
  {
    name: 'number1',
    prevData: {
      w: 0.166667,
      s: 1
    }
  },
  {
    name: 'number2',
    prevData: {
      w: 0.166667,
      s: 0.8
    }
  },
  {
    name: 'number3',
    prevData: {
      w: 0.166667,
      s: 0.6
    }
  },
  {
    name: 'number4',
    prevData: {
      w: 0.166667,
      s: 0.4
    }
  },
  {
    name: 'number5',
    prevData: {
      w: 0.166667,
      s: 0.2
    }
  },
  {
    name: 'number6',
    prevData: {
      w: 0.166667,
      s: 0
    }
  },
]))