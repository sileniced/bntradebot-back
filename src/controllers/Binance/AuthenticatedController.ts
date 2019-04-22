import { JsonController } from 'routing-controllers'

@JsonController()
class AuthenticatedController {

  // @Authorized()
  // @Get('/authenticated/analysis/')
  // public async GetAnalysis(
  //   @CurrentUser() user: User
  // ) {
  //   return new TradeBot(user).run()
  // }
  //
  // @Get('/authenticated/analysis/:symbolsParam')
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


export default AuthenticatedController