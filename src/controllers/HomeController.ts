import { Get, JsonController } from 'routing-controllers'

@JsonController()
class HomeController {

  @Get('/home')
  public async GetHome() {
    return {
      data: {
        hello: 'hello'
      }
    }
  }

}

export default HomeController