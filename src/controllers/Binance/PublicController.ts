import { JsonController } from 'routing-controllers'

@JsonController()
class PublicController {

  // @Get('/public/analysis/')
  // public async GetAnalysis() {
  //   const symbols = ['USDT', ...standardSymbols.toUpperCase().split(',')]
  //
  //   return {
  //     data: {
  //       analysis: await SymbolAnalysis(symbols)
  //     }
  //   }
  // }
  //
  // @Get('/public/analysis/:symbolsParam')
  // public async GetSymbolsAnalysis(
  //   @Param('symbolsParam') symbolsParam: string
  // ) {
  //   const symbols = ['USDT', ...symbolsParam.toUpperCase().split(',')]
  //
  //   return {
  //     data: {
  //       analysis: await SymbolAnalysis(symbols)
  //     }
  //   }
  // }



}


export default PublicController