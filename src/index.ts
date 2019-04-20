import 'reflect-metadata'
import { Action, useKoaServer } from 'routing-controllers'
import { Server } from 'http'
import * as Koa from 'koa'
import setupDb from './db'
import { verify } from './jwt'
// import HomeController from './controllers/HomeController'
import LoginController from './logins/LoginController'
import UserController from './controllers/UserController'
import AuthenticatedController from './controllers/Binance/AuthenticatedController'

import User from './entities/User'
import PublicController from './controllers/Binance/PublicController'
import BinanceApi from './services/Binance'
// import * as IO from 'socket.io'
// import * as socketIoJwtAuth from 'socketio-jwt-auth'
// import { secret } from './jwt'

const app = new Koa()
const server = new Server(app.callback())
// export const io = IO(server)
export const Binance = new BinanceApi()

const port = process.env.PORT || 4000

useKoaServer(app, {
  cors: true,
  controllers: [
    // HomeController,
    LoginController,
    UserController,
    PublicController,
    AuthenticatedController
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
        const user = await User.findOne(id)
        if (!user) return undefined
        if (!Binance.checkAuthenticatedApi(user.id)) {
          Binance.setAuthenticatedApi(user.id, {
            apiKey: user.binanceKey,
            apiSecret: user.binanceSecret
          })
          console.log(`new Auth user: ${user.fullName()}`)
        }
        return user
      }
    }
    return undefined
  }
})

// io.use(socketIoJwtAuth.authenticate({ secret }, async (payload, done) => {
//   const user = await User.findOne(payload.id)
//   if (user) done(null, user)
//   else done(null, false, `Invalid JWT user ID`)
// }))
//
// io.on('connect', socket => {
//   const name = socket.request.user.firstName
//   console.log(`User ${name} just connected`)
//
//   socket.on('disconnect', () => {
//     console.log(`User ${name} just disconnected`)
//   })
// })

setupDb().then(() => {
  server.listen(port, () => {
    console.log(`Listening on port ${port}`)
    Binance.getTime().then(time => {
      Binance.startAutoTradeBots()
      console!.log(`Binance time diff: ${time - Date.now()}ms`)
    })
  })
})
.catch((err) => console!.error(err))

