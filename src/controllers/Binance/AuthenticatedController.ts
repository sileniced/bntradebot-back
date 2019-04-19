import { Authorized, CurrentUser, Get, JsonController, Param } from 'routing-controllers'
import SymbolAnalysis from '../../services/SymbolAnalysis'
import User from '../../entities/User'
import { standardSymbols } from '../../constants'
import { Binance } from '../../index'
import { Bid } from 'binance-api-node'

@JsonController()
class AuthenticatedController {

  @Authorized()
  @Get('/authenticated/analysis/')
  public async GetAnalysis(
    @CurrentUser() user: User
  ) {
    const symbols = ['USDT', ...standardSymbols.toUpperCase().split(',')]
    const allPairs = await Binance.getPairs()
    const pairsInfo = allPairs.filter(pair => symbols.includes(pair.baseAsset) && symbols.includes(pair.quoteAsset))

    const symbolAnalysisPromise = SymbolAnalysis(symbols, pairsInfo)

    if (!Binance.checkAuthenticatedApi(user.id)) {
      Binance.setAuthenticatedApi(user.id, {
        apiKey: user.binanceKey,
        apiSecret: user.binanceSecret
      })
      console.log(`new Auth user: ${user.fullName()}`)
    }

    const allBalances = await Binance.getAccountBalances(user.id)
    const balances = allBalances.filter(balance =>
      parseFloat(balance.free) > 0 &&
      allPairs.filter(pair =>
        balance.asset === pair.baseAsset || balance.asset === pair.quoteAsset
      ).length > 0
    )
    const balanceBooksUnnamed = await Promise.all(balances.map(pair => Binance.getBook(pair.asset !== 'USDT' ? `${pair.asset}BTC` : 'BTCUSDT')))
    const symbolsFilteredBooks = symbols.filter(symbol => balances.filter(balance => balance.asset === symbol).length > 0)
    const symbolBooksUnnamedPromises = Promise.all(symbolsFilteredBooks.map(symbol => Binance.getBook(symbol !== 'USDT' ? `${symbol}BTC` : 'BTCUSDT')))

    const balanceBookBtc = balanceBooksUnnamed.reduce((acc, book, idx) => {
      acc[balances[idx].asset] = book
      return acc
    }, {})

    function getBtcValue(balance: number, book: Bid[]) {
      let page = 0
      let btc = 0
      while (balance > 0) {
        const quantity = parseFloat(book[page].quantity)
        if (quantity >= balance) {
          btc += parseFloat(book[page].price) * balance
          balance = 0
        } else {
          btc += parseFloat(book[page].price) * quantity
          balance -= quantity
        }
        page++
      }
      return btc
    }

    const balancesBtc = balances.map(balance => ({
      ...balance,
      free: parseFloat(balance.free),
      btcValue: balance.asset !== 'BTC' ? getBtcValue(parseFloat(balance.free), balanceBookBtc[balance.asset].bids) : parseFloat(balance.free)
    }))

    const totalBtcValue = balancesBtc.reduce((acc, balance) => acc + balance.btcValue, 0)

    const balancesPercentages = balancesBtc.map(balance => ({
      ...balance,
      percentage: balance.btcValue / totalBtcValue
    }))

    const balancesDenormalized = balancesPercentages.reduce((acc, balance) => {
      acc[balance.asset] = balance.percentage
      return acc
    }, {})

    const symbolAnalysis = await symbolAnalysisPromise

    const { differences, symbolPieBtc, btcDifference } = Object.entries(symbolAnalysis.symbolPie).reduce((acc, [symbol, percentage]: [string, number]) => {
      acc.differences[symbol] = !balancesDenormalized[symbol] ? percentage : percentage - balancesDenormalized[symbol]
      acc.symbolPieBtc[symbol] = percentage * totalBtcValue
      acc.btcDifference[acc.differences[symbol] < 0 ? 'sell' : 'buy'][symbol] = acc.differences[symbol] * totalBtcValue
      return acc
    }, {
      differences: {},
      symbolPieBtc: {},
      btcDifference: {
        sell: {},
        buy: {}
      }
    })

    const symbolBooksUnnamed = await symbolBooksUnnamedPromises
    const symbolBooksBtc = {
      ...balanceBookBtc,
      ...symbolBooksUnnamed.reduce((acc, book, idx) => {
        acc[symbolsFilteredBooks[idx]] = book
        return acc
      }, {})
    }



    return {
      data: {
        differences,
        symbolPieBtc,
        btcDifference,
        symbolBooksBtc,
        balances: balancesPercentages,
        analysis: symbolAnalysis
      }
    }
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