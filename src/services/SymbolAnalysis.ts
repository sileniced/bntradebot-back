import { Symbol } from 'binance-api-node'
import IntervalAnalysis from './IntervalAnalysis'
import NewsAnalysis from './NewsAnalysis'
import { symbolToPairs } from './utils'
import { Binance } from '../index'

export default async (symbols: string[], pairsInfo: Symbol[] = []) => {
  const startTime = Date.now()

  pairsInfo = pairsInfo.length === 0 ? await (async () => {
    const allPairs = await Binance.getPairs()
    return allPairs.filter(pair => symbols.includes(pair.baseAsset) && symbols.includes(pair.quoteAsset))
  })() : pairsInfo

  const pairs = pairsInfo.map(pair => pair.symbol)

  const pairsPerSymbol = symbols.reduce((acc, symbol) => {
    acc[symbol] = []
    pairsInfo.forEach(pair => {
      if (pair.baseAsset === symbol || pair.quoteAsset === symbol ) {
        acc[symbol].push(pair)
      }
    })
    return acc
  }, {})

  const intervalAnalysis = await Promise.all(pairs.map(IntervalAnalysis))
  const newsSymbolAnalysis = await NewsAnalysis(symbols)

  const analysis = {
    interval: intervalAnalysis.reduce((acc, symbolAnalysis) => ({ ...acc, ...symbolAnalysis }), {}),
    news: symbolToPairs(newsSymbolAnalysis._scores, pairs)
  }

  const scores = pairsInfo.reduce((acc, { symbol: pair, baseAsset, quoteAsset }) => {

    const score = (analysis.interval[pair]._score / 4 * 3) + (analysis.news[pair] / 4)
    const ls = (score - 1 / 2)

    acc.pairs[pair] = {
      _pairScore: score,
      [baseAsset]: ls > 0 ? ls * 2 : 0,
      [quoteAsset]: ls < 0 ? -ls * 2 : 0
    }

    const addToSymbol = symbol => {
      if (!acc.symbols[symbol]) acc.symbols[symbol] = 0
      const score = acc.pairs[pair][symbol] / pairsPerSymbol[symbol].length
      acc.symbols[symbol] += score
      acc.totalSymbols += score
    }

    addToSymbol(baseAsset)
    addToSymbol(quoteAsset)

    return acc
  }, {
    symbols: {},
    pairs: {},
    totalSymbols: 0
  })

  const symbolPie = Object.entries(scores.symbols).reduce((acc, [symbol, score]: [string, number]) => {
    acc[symbol] = score / scores.totalSymbols
    return acc
  }, {})

  const took = Date.now() - startTime
  console.log(`symbol analysis took ${took}ms ${'|'.repeat(Math.round(took / 250))}`)
  return {
    symbolPie,
    _scores: scores as {
      symbols: {
        [symbol: string]: number
      },
      pairs: {
        [pair: string]: number
      },
      totalSymbols: number
    },
    analysis
  }
}