import { Get, JsonController, Param } from 'routing-controllers'
import NewsAnalysis from '../../services/NewsAnalysis'
import IntervalAnalysis from '../../services/IntervalAnalysis'
import { Binance } from '../../index'
import { symbolToPairs } from '../../services/utils'

@JsonController()
class PublicController {

  @Get('/public/analysis/:pairsParam')
  public async GetAnalysis(
    @Param('pairsParam') symbolsParam: string
  ) {
    const symbols = ['USDT', ...symbolsParam.toUpperCase().split(',')]
    const allPairs = await Binance.getPairs()

    const pairsInfo = allPairs.filter(pair => symbols.includes(pair.baseAsset) && symbols.includes(pair.quoteAsset))
    const pairs = pairsInfo.map(pair => pair.symbol)

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
        acc.symbols[symbol] += acc.pairs[pair][symbol]
        acc.totalSymbols += acc.pairs[pair][symbol]
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

    return {
      _symbolPie: symbolPie,
      _scores: scores,
      // analysis
    }

  }


}


export default PublicController