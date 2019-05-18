import { Symbol } from 'binance-api-node'

export interface MarketAnalysisResult {
  quoteSymbol: string,
  score: number,
  multiplier: number
  poweredScore: number
  battleScore: number
}

export interface MarketScore {
  [quoteSymbol: string]: MarketAnalysisResult
}

export default (
  marketSymbols: string[],
  pairsPerSymbol: { [symbol: string]: Symbol[] },
  techPairScore: { [pair: string]: number }
): MarketScore => {

  const marketScore: MarketScore = {
    ['ALTS']: {
      quoteSymbol: 'ALTS',
      score: 0,
      multiplier: 0,
      poweredScore: 0,
      battleScore: 0
    }
  }

  const qen = marketSymbols.length
  for (let i = 0; i < qen; i++) {
    const quoteSymbol = marketSymbols[i]

    const [baseScore, quoteScore] = pairsPerSymbol[quoteSymbol]
    .filter(pair => pair.quoteAsset === quoteSymbol)
    .reduce((acc, pair, _, src) => {
      const quoteScore = -(techPairScore[pair.symbol] - 0.5) * 2
      return quoteScore < 0
        ? [acc[0] - quoteScore / src.length, acc[1]]
        : [acc[0], acc[1] + quoteScore / src.length]
    }, [0, 0])

    const quoteMultiplier = Math.sqrt(quoteScore)
    const baseMultiplier = Math.sqrt(baseScore)

    marketScore[quoteSymbol] = {
      quoteSymbol,
      score: quoteScore,
      multiplier: quoteMultiplier,
      poweredScore: quoteScore + quoteMultiplier,
      battleScore: quoteScore + quoteMultiplier
    }

    marketScore['ALTS'].score += baseScore / qen
    marketScore['ALTS'].multiplier += baseMultiplier / qen
    marketScore['ALTS'].poweredScore += baseScore + baseMultiplier / qen
    marketScore['ALTS'].battleScore += baseScore + baseMultiplier / qen

  }

  for (let i = 0; i < qen; i++) {
    const quoteSymbol = marketSymbols[i]
    pairsPerSymbol[quoteSymbol]
    .filter(pair => marketSymbols.includes(pair.baseAsset) && pair.quoteAsset === quoteSymbol)
    .forEach(pair => {
      const baseTechScore = (techPairScore[pair.symbol] - 0.5) * 2
      marketScore[pair.baseAsset].battleScore += baseTechScore
      marketScore[pair.quoteAsset].battleScore -= baseTechScore
    })
  }

  for (let i = 0; i < qen; i++) {
    const quoteSymbol = marketSymbols[i]
    marketScore[quoteSymbol].battleScore = marketScore[quoteSymbol].battleScore < 0 ? 0 : marketScore[quoteSymbol].battleScore
  }

  return marketScore
}