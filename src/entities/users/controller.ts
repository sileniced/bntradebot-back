import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpCode,
  JsonController,
  NotFoundError,
  Param,
  Post,
  Put, UnauthorizedError
} from 'routing-controllers'

import User from './entity'

const cannotFindUserStr = 'Cannot find user'
const unauthorizedUserStr = 'You\'re not this user'

@JsonController()
export default class UserController {

  @Authorized('ROLE_ADMIN')
  @Get('/users')
  public async allUsers(): Promise<{
    users: User[],
  }> {
    const users = await User.find()
    return { users }
  }

  @Get('/users/:id')
  public async getUser(
    @Param('id') id: number,
    @CurrentUser() currentUser: User
  ): Promise<User | undefined> {
    const user = await User.findOne(id)
    if (user && user.id !== currentUser.id) throw new UnauthorizedError(unauthorizedUserStr)
    return user
  }

  @Post('/users')
  @HttpCode(201)
  public async createUser(
    @Body() user: User
  ) {
    const { password, ...rest } = user
    const entity = User.create(rest)
    await entity.setPassword(password)
    return entity.save()
  }

  @Put('/users/:id')
  public async updateUser(
    @Param('id') id: number,
    @Body() update: Partial<User>,
    @CurrentUser() currentUser: User
  ): Promise<User> {
    const user = await User.findOne(id)
    if (!user) throw new NotFoundError(cannotFindUserStr)
    if (user && user.id !== currentUser.id) throw new UnauthorizedError(unauthorizedUserStr)
    return User.merge(user, update).save()
  }

  @Delete('/users/:id')
  public async deleteUser(
    @Param('id') id: number,
    @CurrentUser() currentUser: User
  ): Promise<User> {
    const user = await User.findOne(id)
    if (!user) throw new NotFoundError(cannotFindUserStr)
    if (user && user.id !== currentUser.id) throw new UnauthorizedError(unauthorizedUserStr)
    return user.remove()
  }
}
