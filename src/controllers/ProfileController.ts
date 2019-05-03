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
    return await TradeBotEntity.find({
      where: {
        user,
        tradeTime: Raw(alias => `${alias} > NOW() - INTERVAL '1 DAY'`)
      }
    })
  }
}

export default ProfileController