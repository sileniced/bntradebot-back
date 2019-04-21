import { Authorized, CurrentUser, Get, JsonController, Param } from 'routing-controllers'
import SymbolAnalysis from '../../services/SymbolAnalysis'
import User from '../../entities/User'
import TradeBotNew from '../../services/TradeBotNew'

@JsonController()
class AuthenticatedController {

  @Authorized()
  @Get('/authenticated/analysis/')
  public async GetAnalysis(
    @CurrentUser() user: User
  ) {
    return new TradeBotNew(user).run()
  }

  @Get('/authenticated/analysis/:symbolsParam')
  public async GetSymbolsAnalysis(
    @Param('symbolsParam') symbolsParam: string
  ) {
    const symbols = ['USDT', ...symbolsParam.toUpperCase().split(',')]

    return {
      data: {
        analysis: await SymbolAnalysis(symbols)
      }
    }
  }


}


export default AuthenticatedController