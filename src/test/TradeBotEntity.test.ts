import TradeBotEntity, { DroppedPairEntity } from '../entities/TradeBotEntity'
import User from '../entities/User'

const entity = new TradeBotEntity()
const symbols = ['USDT', 'BTC', 'ETH', 'BNB']
const pairs = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ETHBTC', 'BNBBTC', 'BNBETH']
const markets = ['USDT', 'BTC']

test('symbols pairs markets', () => {
  entity.symbols = symbols
  entity.pairs = pairs
  entity.markets = markets
  expect(entity.symbols).toEqual(symbols)
  expect(entity.pairs).toEqual(pairs)
  expect(entity.markets).toEqual(markets)
})

const balance = { 'USDT': 500, 'BTC': 0.1, 'ETH': 2.5, 'BNB': 25 }
const symbolPie = { 'USDT': 0, 'BTC': 0.5, 'ETH': 0.3, 'BNB': 0.2 }
const balancePostTrades = { 'USDT': 501, 'BTC': 0.11, 'ETH': 2.51, 'BNB': 25.1 }

test('symbol values', () => {
  entity.balanceSymbols = balance
  entity.symbolPie = symbolPie
  entity.balancePostTradeSymbols = balancePostTrades
  expect(entity.balanceSymbols).toEqual(balance)
  expect(entity.symbolPie).toEqual(symbolPie)
  expect(entity.balancePostTradeSymbols).toEqual(balancePostTrades)
})

const prices = { 'BTCUSDT': 5000, 'ETHUSDT': 200, 'BNBUSDT': 20, 'ETHBTC': 0.04, 'BNBBTC': 0.004, 'BNBETH': 0.1 }
const analysisTechPair = { 'BTCUSDT': 0.8, 'ETHUSDT': 0.7, 'BNBUSDT': 0.6, 'ETHBTC': 0.4, 'BNBBTC': 0.3, 'BNBETH': 0.4 }

test('pair values', () => {
  entity.pricesPairs = prices
  entity.analysisTechPairs = analysisTechPair
  expect(entity.pricesPairs).toEqual(prices)
  expect(entity.analysisTechPairs).toEqual(analysisTechPair)
})

const analysisMarket = { 'USDT': 0, 'BTC': 0.7 }

test('market values', () => {
  entity.analysisMarket = analysisMarket
  expect(entity.analysisMarket).toEqual(analysisMarket)
})

const droppedPairs: DroppedPairEntity[] = [{
  score: 0.74,
  pair: 'ETHBTC',
  dropCode: 1
}, {
  score: 0.87,
  pair: 'OEBLAE',
  dropCode: 1
}]

test('dropped pairs values', () => {
  entity.droppedPairs = droppedPairs
  expect(entity.droppedPairs).toEqual([{
    proof: "0.74000000",
    pair: 'ETHBTC',
    dropCode: 1
  }, {
    proof: "0.87000000",
    pair: 'OEBLAE',
    dropCode: 1
  }])
})



const user = {
  id: 1,
  email: 'test@test.nl',
  firstName: 'test',
  lastName: 'bla'
}

entity.user = user as User
entity.tradeTime = new Date()
entity.dollarDiffPostTrade = -0.01