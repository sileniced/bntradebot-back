import StockData from 'technicalindicators/declarations/StockData'

const PriceChangeAnalysis = ({ close }: StockData) => {

  const last = close.slice(-2)
  const change = (last[1] - last[0]) / last[0]

  if (change > 0) {
    const quote = Math.sqrt(change)
    return quote > 0.5 ? 1 : 0.5 + quote
  }

  const quote = Math.sqrt(-change)
  return quote > 0.5 ? 0 : 0.5 - quote


}

export default PriceChangeAnalysis