import { Authorized, JsonController, Get, CurrentUser } from 'routing-controllers'
import User from '../entities/User'
import TradeBotEntity from '../entities/TradeBotEntity'
import { Raw } from 'typeorm'

@JsonController()
class ProfileController {

  @Authorized()
  @Get('/profile')
  public async getProfile(
    @CurrentUser() user: User
  ) {
    const trades = await TradeBotEntity.find({
      where: {
        user,
        tradeTime: Raw(alias => `${alias} > NOW() - INTERVAL '1 DAY'`)
      }
    })

    return trades.map(trade => ({
      ...trade,
      pricesPairs: trade.pricesPairs,
      balanceSymbols: trade.balanceSymbols,
      analysisTechPairs: trade.analysisTechPairs,
      analysisMarket: trade.analysisMarket,
      symbolPie: trade.symbolPie,
      droppedPairs: trade.droppedPairs,
      tradePairs: trade.tradePairs,
      balancePostTradeSymbols: trade.balancePostTradeSymbols,
      prevOptimalScorePairs: trade.prevOptimalScorePair
    }))
  }
}

export default ProfileController