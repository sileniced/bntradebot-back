import { Symbol } from 'binance-api-node'
import IntervalAnalysis from './IntervalAnalysis'
import NewsAnalysis from './NewsAnalysis'
import { symbolToPairs } from './utils'
import { Binance } from '../index'
import newsSettings from './NewsAnalysis/settings'

export interface PairScore {
  _pairScore: number,
  base: {
    symbol: string,
    score: number
  },
  quote: {
    symbol: string,
    score: number
  }
}


export interface ISymbolAnalysis {
  _scores: {
    symbols: { [symbol: string]: number };
    pairs: { [pair: string]: PairScore };
    totalSymbols: number
  };
  symbolPie: { [symbol: string]: number };
  // analysis: { news: [string, any]; interval: any }
}

export default async (symbols: string[], pairsInfo: Symbol[] = []): Promise<ISymbolAnalysis> => {
  const startTime = Date.now()

  pairsInfo = pairsInfo.length === 0 ? await (async () => {
    const allPairs = await Binance.getPairs()
    return allPairs.filter(pair => symbols.includes(pair.baseAsset) && symbols.includes(pair.quoteAsset))
  })() : pairsInfo

  const pairs = pairsInfo.map(pair => pair.symbol)

  const pairsPerSymbol = symbols.reduce((acc, symbol) => {
    acc[symbol] = []
    pairsInfo.forEach(pair => {
      if (pair.baseAsset === symbol || pair.quoteAsset === symbol) {
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

    const score = (analysis.interval[pair]._score / newsSettings.newsDivider * (newsSettings.newsDivider - 1)) + (analysis.news[pair] / newsSettings.newsDivider)
    const ls = (score - 1 / 2)

    acc.pairs[pair] = {
      _pairScore: score,
      base: {
        symbol: baseAsset,
        score: ls > 0 ? ls * 2 : 0
      },
      quote: {
        symbol: quoteAsset,
        score: ls < 0 ? -ls * 2 : 0
      }
    }

    if (!acc.symbols[baseAsset]) acc.symbols[baseAsset] = 0
    const baseScore = acc.pairs[pair].base.score / pairsPerSymbol[baseAsset].length
    acc.symbols[baseAsset] += baseScore
    acc.totalSymbols += baseScore

    if (!acc.symbols[quoteAsset]) acc.symbols[quoteAsset] = 0
    const quoteScore = acc.pairs[pair].quote.score / pairsPerSymbol[quoteAsset].length
    acc.symbols[quoteAsset] += quoteScore
    acc.totalSymbols += quoteScore

    return acc
  }, {
    symbols: {},
    pairs: {} as {
      [pair: string]: {
        _pairScore: number,
        base: {
          symbol: string,
          score: number
        },
        quote: {
          symbol: string,
          score: number
        }
      }
    },
    totalSymbols: 0
  })

  const symbolPie = Object.entries(scores.symbols).reduce((acc, [symbol, score]: [string, number]) => {
    acc[symbol] = score / scores.totalSymbols
    return acc
  }, {} as { [symbol: string]: number })

  const took = Date.now() - startTime
  console.log(`symbol analysis took ${took}ms ${'|'.repeat(Math.round(took / 250))}`)
  return {
    symbolPie,
    _scores: scores as {
      symbols: {
        [symbol: string]: number
      },
      pairs: {
        [pair: string]: PairScore
      },
      totalSymbols: number
    },
    // analysis
  }
}