export const symbolToPairs = (symbolScores, pairs) => Object.entries(symbolScores).reduce((acc, [symbol, symbolScore]: [string, number]) => {
  Object.keys(acc).forEach(pair => {
    const idx = pair.indexOf(symbol)
    if (idx !== -1) {
      acc[pair] += ((idx === 0) ? symbolScore : -symbolScore) / 2
    }
  })
  return acc
}, pairs.reduce((acc, pair) => {
  acc[pair] = 0.5
  return acc
}, {}))

export const parseDropCode = pair => {
  switch (pair.dropCode) {
    case 1:
      return ['score=0', pair.score.toFixed(8)]
    case 2:
      return ['coll<minBase', `${pair.collectorAmount && pair.collectorAmount.toFixed(8)}<${pair.minBase}`]
    case 3:
      return ['prov<minQuot', `${pair.providerFunds && pair.providerFunds.toFixed(8)}<${pair.minQuote}`]
    case 4:
      return ['prov<minBase', `${pair.providerFunds && pair.providerFunds.toFixed(8)}<${pair.minBase}`]
    case 5:
      return ['coll<minQuote', `${pair.collectorAmount && pair.collectorAmount.toFixed(8)}<${pair.minQuote}`]
    case 6:
      return ['funds dry', `collect: ${pair.collectorAmountBtc && pair.collectorAmountBtc.toFixed(8)}`]
    case 7:
      return ['coll done', `provide: ${pair.providerFundsBtc && pair.providerFundsBtc.toFixed(8)}`]
    case 8:
      return ['coll base<minBase', `${pair.baseAmount && pair.baseAmount.toFixed(8)}<${pair.minBase}`]
    case 9:
      return ['prov quot<minQuot', `${pair.quoteAmount && pair.quoteAmount.toFixed(8)}<${pair.minQuote}`]
    case 10:
      return ['coll quot<minQuot', `${pair.quoteAmount && pair.quoteAmount.toFixed(8)}<${pair.minQuote}`]
    case 11:
      return ['prov base<minBase', `${pair.baseAmount && pair.baseAmount.toFixed(8)}<${pair.minBase}`]
    case 12:
      return ['funds dry & coll done', '']
    default:
      return ['unknown', '']
  }

}

