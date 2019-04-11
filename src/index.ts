import 'reflect-metadata'
import { Action, useKoaServer } from 'routing-controllers'
import { Server } from 'http'
import * as Koa from 'koa'
import * as IO from 'socket.io'
import * as socketIoJwtAuth from 'socketio-jwt-auth'

import setupDb from './db'
import { verify } from './jwt'
import { secret } from './jwt'

import User from './entities/users/entity'

import LoginController from './logins/controller'

const app = new Koa()
const server = new Server(app.callback())
export const io = IO(server)

const port = process.env.PORT || 4000

useKoaServer(app, {
  cors: true,
  controllers: [
    LoginController,
  ],
  authorizationChecker: (action: Action) => {
    const header: string = action.request.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      const [, token] = header.split(' ')
      return !!(token && verify(token))
    }
    return false
  },
  currentUserChecker: async (action: Action) => {
    const header: string = action.request.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      const [, token] = header.split(' ')
      if (token) {
        const id = verify(token).data.id
        return await User.findOne(id)
      }
    }
    return undefined
  }
})

io.use(socketIoJwtAuth.authenticate({ secret }, async (payload, done) => {
  const user = await User.findOne(payload.id)
  if (user) done(null, user)
  else done(null, false, `Invalid JWT user ID`)
}))

io.on('connect', socket => {
  const name = socket.request.user.firstName
  console.log(`User ${name} just connected`)

  socket.on('disconnect', () => {
    console.log(`User ${name} just disconnected`)
  })
})

setupDb()
.then(() => {
  server.listen(port, () => console!.log(`Listening on port ${port}`))
})
.catch((err) => console!.error(err))
