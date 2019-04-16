import { Get, JsonController, Param } from 'routing-controllers'
// import IntervalAnalysis from '../../services/IntervalAnalysis'
import NewsAnalysis from '../../services/NewsAnalysis'

@JsonController()
class PublicController {

  @Get('/public/analysis/:symbol')
  public async GetAnalysis(
    @Param('symbol') symbol: string
  ) {
    const symbols = symbol.toUpperCase().split(',')
    // const intervalAnalysisArray = await Promise.all(symbols.map(IntervalAnalysis))
    // const intervalAnalysis = intervalAnalysisArray.reduce((acc, symbolAnalysis) => ({ ...acc, ...symbolAnalysis }), {})

    // const newsAnalysis = NewsAnalysis(symbols)
    // await NewsAnalysis(symbols)

    // return {
    //   _scores: symbols.reduce((acc, symbol) => {
    //     const ls = intervalAnalysis[symbol]._score - 0.5
    //     acc[symbol] = {
    //       score: intervalAnalysis[symbol]._score,
    //       long: ls > 0 ? ls * 2 : 0,
    //       short: ls < 0 ? -ls * 2 : 0
    //     }
    //     return acc
    //   }, {}),
    //   analysis: intervalAnalysis
    // }

    return await NewsAnalysis(symbols)
  }
}

export default PublicController