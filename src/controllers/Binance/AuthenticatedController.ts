import { Authorized, CurrentUser, Get, JsonController, Param } from 'routing-controllers'
import SymbolAnalysis from '../../services/SymbolAnalysis'
import User from '../../entities/User'
import { standardSymbols } from '../../constants'
import { Binance } from '../../index'
import { Bid, OrderBook } from 'binance-api-node'

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

    const standardBookNames = ['BTC', 'USDT']

    const balanceFilteredBooks = balances.filter(({ asset }) => !standardBookNames.includes(asset))
    const balanceBooksUnnamed = await Promise.all([...balanceFilteredBooks.map(({ asset }) => Binance.getBook(`${asset}BTC`)), Binance.getBook(standardBookNames.join(''))])

    const balanceBookBtc: {
      [symbol: string]: OrderBook
    } = balanceBooksUnnamed.reduce((acc, book, idx) => {
      acc[balanceFilteredBooks[idx] ? balanceFilteredBooks[idx].asset : standardBookNames[1]] = book
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

    const symbolsFilteredBooks = symbols.filter(symbol => !standardBookNames.includes(symbol) && !balanceFilteredBooks.filter(balance => balance.asset === symbol).length)
    const symbolBooksUnnamed = await Promise.all(symbolsFilteredBooks.map(symbol => Binance.getBook(`${symbol}BTC`)))

    const symbolBooksBtc: {
      [symbol: string]: OrderBook
    } = {
      ...balanceBookBtc,
      ...symbolBooksUnnamed.reduce((acc, book, idx) => {
        acc[symbolsFilteredBooks[idx]] = book
        return acc
      }, {})
    }

    const symbolAnalysis = await symbolAnalysisPromise

    function getSymbolAmount(balance: number, book: Bid[]) {
      let page = 0
      let amount = 0
      while (balance > 0) {
        const quantity = parseFloat(book[page].quantity) * parseFloat(book[page].price)
        if (quantity >= balance) {
          amount += parseFloat(book[page].quantity) * balance / quantity
          balance = 0
        } else {
          amount += parseFloat(book[page].quantity)
          balance -= quantity
        }
        page++
      }
      return amount
    }

    const { percentDifferences, btcAmount, btcDifference, symbolAmount } = Object.entries(symbolAnalysis.symbolPie).reduce((acc, [symbol, percentage]: [string, number]) => {
      acc.percentDifferences[symbol] = !balancesDenormalized[symbol] ? percentage : percentage - balancesDenormalized[symbol]
      acc.btcAmount[symbol] = percentage * totalBtcValue
      acc.btcDifference[acc.percentDifferences[symbol] < 0 ? 'sell' : 'buy'][symbol] = Math.abs(acc.percentDifferences[symbol] * totalBtcValue)
      acc.symbolAmount[acc.percentDifferences[symbol] < 0 ? 'sell' : 'buy'][symbol] = symbol === 'BTC' ? Math.abs(acc.percentDifferences[symbol] * totalBtcValue) : getSymbolAmount(acc.btcAmount[symbol], symbolBooksBtc[symbol].asks)
      return acc
    }, {
      symbolAmount: {
        sell: {},
        buy: {}
      },
      btcDifference: {
        sell: {},
        buy: {}
      },
      btcAmount: {},
      percentDifferences: {}
    })


    /*

    todo: Here make a list of all the coins that need to sell
    todo: They need to make as much pairs with the buy list
    todo: find the shortest route



     */







    return {
      data: {
        symbolAmount,
        btcDifference,
        percentDifferences,
        btcAmount,
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