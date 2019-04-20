import { standardSymbols } from '../constants'
import { Binance } from '../index'
import SymbolAnalysis from './SymbolAnalysis'
import {
  Bid,
  NewOrder,
  OrderBook,
  OrderSide,
  Symbol,
  SymbolLotSizeFilter,
  SymbolMinNotionalFilter
} from 'binance-api-node'
import IntervalAnalysis from './IntervalAnalysis'

export default async (user) => {
  const symbols = ['USDT', ...standardSymbols.toUpperCase().split(',')]
  const allPairs = await Binance.getPairs()
  const pairsInfo = allPairs.filter(pair => symbols.includes(pair.baseAsset) && symbols.includes(pair.quoteAsset))

  const symbolAnalysisPromise = SymbolAnalysis(symbols, pairsInfo)



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
    btcValue: balance.asset === 'BTC' ? parseFloat(balance.free) : getBtcValue(parseFloat(balance.free), balanceBookBtc[balance.asset].bids)
  }))

  const totalBtcValue = balancesBtc.reduce((acc, balance) => acc + balance.btcValue, 0)

  const balancesPercentages = balancesBtc.map(balance => ({
    ...balance,
    percentage: balance.btcValue / totalBtcValue
  }))

  interface BalancesBtc {
    free: number,
    btcValue: number,
    percentage: number,
    asset: string;
    locked: string;
  }

  const balancesDenormalizedBtc = balancesPercentages.reduce((acc, balance: BalancesBtc) => {
    acc[balance.asset] = balance
    return acc
  }, {} as { [symbol: string]: BalancesBtc })

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

  const {
    percentDifferences, btcAmount, btcDifference, symbolAmount, marketArr
  } = Object.entries(symbolAnalysis.symbolPie).reduce((acc, [symbol, percentage]: [string, number]) => {
    acc.percentDifferences[symbol] = !balancesDenormalized[symbol] ? percentage : percentage - balancesDenormalized[symbol]
    const bs = acc.percentDifferences[symbol] < 0 ? 'sell' : 'buy'
    acc.btcAmount[symbol] = percentage * totalBtcValue
    acc.btcDifference[bs][symbol] = Math.abs(acc.percentDifferences[symbol] * totalBtcValue)
    acc.symbolAmount[bs][symbol] = symbol === 'BTC'
      ? Math.abs(acc.percentDifferences[symbol] * totalBtcValue)
      : getSymbolAmount(acc.btcDifference[bs][symbol], symbolBooksBtc[symbol].asks)
    acc.marketArr[bs].push(symbol)
    return acc
  }, {
    marketArr: { sell: [] as string[], buy: [] as string[] },
    symbolAmount: { sell: {}, buy: {} },
    btcDifference: { sell: {}, buy: {} },
    btcAmount: {},
    percentDifferences: {}
  })

  const markets = marketArr.sell.reduce((acc, sellSymbol) => {
    if (!acc[sellSymbol]) acc[sellSymbol] = {}
    marketArr.buy.forEach(buySymbol => {
      pairsInfo.forEach(pair => {
        if ((pair.quoteAsset === sellSymbol && pair.baseAsset === buySymbol) || (pair.baseAsset === sellSymbol && pair.quoteAsset === buySymbol)) {
          acc[sellSymbol][buySymbol] = pair
        }
      })
    })
    return acc
  }, {})

  /*
  todo: are all symbols covered? what about double transactions
   */

  const newSymbolAnalysis = await Promise.all(Object.entries(markets).reduce((acc, [, buySymbols]) => {
    Object.entries(buySymbols).forEach(([, pair]: [string, Symbol]) => {
      acc.push(IntervalAnalysis(pair.symbol))
    })
    return acc
  }, [] as Promise<{ [pair: string]: { _score: number } }>[]))

  const newSymbolAnalysisWithNews = newSymbolAnalysis.reduce((acc, pairScore) => {
    Object.entries(pairScore).forEach(([pair, { _score }]: [string, { _score: number }]) => {
      const score = (_score / 4 * 3) + (symbolAnalysis.analysis.news[pair] / 4)
      const ls = (score - 1 / 2)
      acc[pair] = {
        _pairScore: score,
        pairInfo: pairsInfo.filter(pairInfo => pairInfo.symbol === pair)[0],
        buy: ls > 0 ? ls * 2 : 0,
        sell: ls < 0 ? -ls * 2 : 0
      }
    })
    return acc
  }, {} as {
    [pair: string]: {
      _pairScore: number,
      pairInfo: Symbol,
      buy: number,
      sell: number
    }
  })

  interface OrderData {
    prototype: NewOrder,
    extra?: any,
    pair: string,
    side: OrderSide,
    baseSymbolAmount: number,
    quotSymbolAmount: number,
    baseSymbolAmountBtc: number,
    quotSymbolAmountBtc: number,
    score: number,
    pairInfo: Symbol
  }

  const participatingPairs = Object.entries(newSymbolAnalysisWithNews).filter(([, { buy, sell, pairInfo }]) => !(((buy > 0 && sell === 0) && (!symbolAmount.buy[pairInfo.baseAsset] || !symbolAmount.sell[pairInfo.quoteAsset])) || ((sell > 0 && buy === 0) && (!symbolAmount.buy[pairInfo.quoteAsset] || !symbolAmount.sell[pairInfo.baseAsset]))))

  const orderBooksNames = participatingPairs.map(([, { pairInfo: { symbol } }]) => symbol)
  const orderBooksUnnamedPromise = Promise.all(orderBooksNames.map(pair => Binance.getBook(pair)))

  const orderPairs = participatingPairs.map(([, { buy, sell, pairInfo }]): OrderData => {

    const bool = buy > 0 && sell === 0
    const bqBuy = bool ? 'baseAsset' : 'quoteAsset'
    const bqSell = bool ? 'quoteAsset' : 'baseAsset'
    const bqBase = bool ? 'buy' : 'sell'
    const bqQuote = bool ? 'sell' : 'buy'

    const participating = participatingPairs.filter(([, { pairInfo: pairInfo2 }]) => pairInfo[bqBuy] === pairInfo2.baseAsset || pairInfo[bqBuy] === pairInfo2.quoteAsset)

    return {
      prototype: {
        symbol: pairInfo.symbol,
        side: buy > 0 && sell === 0 ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: symbolAmount[bqBase][pairInfo.baseAsset]
      },
      extra: {
        'what_you_want': pairInfo[bqBuy],
        'how_much_you_want_of_it': symbolAmount.buy[pairInfo[bqBuy]],
        'how_much_is_this_in_btc': btcDifference.buy[pairInfo[bqBuy]],
        'how_much_you_can_pay_for_it': symbolAmount.sell[pairInfo[bqSell]],
        'how_much_is_that_in_btc': btcDifference.sell[pairInfo[bqSell]],
        'what_is_the_size_of_the_transaction': btcDifference.buy[pairInfo[bqBuy]],
        'can_you_pay_for_it?': btcDifference.sell[pairInfo[bqSell]] - btcDifference.buy[pairInfo[bqBuy]] > 0,
        [btcDifference.sell[pairInfo[bqSell]] - btcDifference.buy[pairInfo[bqBuy]] > 0 ? 'how_much_you_have_left' : 'how_much_you_need']: Math.abs(btcDifference.sell[pairInfo[bqSell]] - btcDifference.buy[pairInfo[bqBuy]]),
        'how_many_symbols_are_paying_for_it': participating.length
      },
      pair: pairInfo.symbol,
      side: buy > 0 && sell === 0 ? 'BUY' : 'SELL',
      baseSymbolAmount: symbolAmount[bqBase][pairInfo.baseAsset],
      quotSymbolAmount: symbolAmount[bqQuote][pairInfo.quoteAsset],
      baseSymbolAmountBtc: btcDifference[bqBase][pairInfo.baseAsset],
      quotSymbolAmountBtc: btcDifference[bqQuote][pairInfo.quoteAsset],
      score: buy,
      pairInfo
    }
  })

  interface DemandInfo {
    symbol: string,
    pair: string,
    lotSize: SymbolLotSizeFilter,
    minNotional: SymbolMinNotionalFilter,
    side: OrderSide,
    demandSym: number,
    demandBtc: number,
    alternativeProvidersPair: string[],
    alternativeProviders: string[]
  }

  interface ProviderInfo {
    symbol?: string,
    totalSpendable: number,
    totalSpendableBtc: number,
    spendableImmu: number,
    spendableBtcImmu: number,
    spendable: number,
    spendableBtc: number,
    total: number,
    weighted: number
    involvedLength: number,
    involvedWith: string[],
    involvedDemands: DemandInfo[]
    // involvedIn: OrderData[],
  }

  const ordersTotal = orderPairs.reduce((acc, order: OrderData) => {
    const side = order.side === 'BUY'
    const bqSell = side ? 'quoteAsset' : 'baseAsset'
    const bqBuy = side ? 'baseAsset' : 'quoteAsset'
    const bqSellBtc = side ? 'quotSymbolAmountBtc' : 'baseSymbolAmountBtc'
    const bqBuyBtc = side ? 'baseSymbolAmountBtc' : 'quotSymbolAmountBtc'
    const bqBuySym = side ? 'baseSymbolAmount' : 'quotSymbolAmount'

    if (!acc.sell[order.pairInfo[bqSell]]) {
      const involved = orderPairs.filter(orderPair => order.pairInfo[bqSell] === orderPair.pairInfo.quoteAsset || order.pairInfo[bqSell] === orderPair.pairInfo.baseAsset)
      acc.sell[order.pairInfo[bqSell]] = {
        totalSpendable: balancesDenormalizedBtc[order.pairInfo[bqSell]].free,
        totalSpendableBtc: balancesDenormalizedBtc[order.pairInfo[bqSell]].btcValue,
        spendableImmu: symbolAmount.sell[order.pairInfo[bqSell]],
        spendableBtcImmu: btcDifference.sell[order.pairInfo[bqSell]],
        spendable: symbolAmount.sell[order.pairInfo[bqSell]],
        spendableBtc: btcDifference.sell[order.pairInfo[bqSell]],
        total: 0,
        weighted: 0,
        involvedLength: involved.length,
        involvedWith: involved.map(involvedOrder => involvedOrder.pairInfo[bqBuy]),
        involvedDemands: involved.map(involvedOrder => {
          const alternativeProviders = orderPairs.filter(orderPair =>
            (involvedOrder.pairInfo[bqBuy] === orderPair.pairInfo.quoteAsset && order.pairInfo[bqSell] !== orderPair.pairInfo.baseAsset)
            || (involvedOrder.pairInfo[bqBuy] === orderPair.pairInfo.baseAsset && order.pairInfo[bqSell] !== orderPair.pairInfo.quoteAsset)
          )
          return {
            symbol: involvedOrder.pairInfo[bqBuy],
            pair: involvedOrder.pair,
            lotSize: involvedOrder.pairInfo.filters.filter(filter => filter.filterType === 'LOT_SIZE')[0] as SymbolLotSizeFilter,
            minNotional: involvedOrder.pairInfo.filters.filter(filter => filter.filterType === 'MIN_NOTIONAL')[0] as SymbolMinNotionalFilter,
            side: involvedOrder.side,
            demandSym: involvedOrder[bqBuySym],
            demandBtc: involvedOrder[bqBuyBtc],
            alternativeProvidersPair: alternativeProviders.map(involvedOrder => involvedOrder.pair),
            alternativeProviders: alternativeProviders.map(involvedOrder => involvedOrder.pairInfo[bqBuy])
          }
        })
        // involvedIn: involved
      }
    }
    if (!acc.buy[order.pairInfo[bqBuy]]) {
      const involved = orderPairs.filter(orderPair => order.pairInfo[bqBuy] === orderPair.pairInfo.quoteAsset || order.pairInfo[bqBuy] === orderPair.pairInfo.baseAsset)
      acc.buy[order.pairInfo[bqBuy]] = {
        total: 0,
        weighted: 0,
        involvedLength: involved.length,
        involvedWith: involved.map(involvedOrder => involvedOrder.side === 'BUY' ? involvedOrder.pairInfo[bqSell] : involvedOrder.pairInfo[bqBuy])
        // involvedIn: involved
      }
    }

    acc.sell[order.pairInfo[bqSell]].total += order[bqSellBtc]
    acc.sell[order.pairInfo[bqSell]].weighted += order[bqSellBtc] / acc.sell[order.pairInfo[bqSell]].involvedLength
    acc.buy[order.pairInfo[bqBuy]].total += order[bqBuyBtc]
    acc.buy[order.pairInfo[bqBuy]].weighted += order[bqBuyBtc] / acc.buy[order.pairInfo[bqBuy]].involvedLength
    return acc
  }, {
    sell: {} as {
      [symbol: string]: ProviderInfo
    },
    buy: {} as {
      [symbol: string]: {
        total: number,
        weighted: number
        involvedLength: number,
        involvedWith: string[],
        // involvedIn: OrderData[],
      }
    }
  })

  const orderBooksUnnamed = await orderBooksUnnamedPromise
  const orderBooks = orderBooksNames.reduce((acc, pair, idx) => {
    acc[pair] = orderBooksUnnamed[idx]
    return acc
  }, {})

  function getNotionalAmount(pair, side, balance): number {
    const book = orderBooks[pair][side === 'BUY' ? 'bids' : 'asks']
    let page = 0
    let amount = 0
    if (side === 'BUY') {

      while (balance > 0) {
        const quantity = parseFloat(book[page].quantity)
        if (quantity >= balance) {
          amount += parseFloat(book[page].price) * balance
          balance = 0
        } else {
          amount += parseFloat(book[page].price) * quantity
          balance -= quantity
        }
        page++
      }

    } else {

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

    }

    console.log('pair, side, balance, amount, page = ', pair, side, balance, amount, page)
    return amount
  }

  function getFinalOrders() {
    let providersMutable = Object.entries(ordersTotal.sell).map(([provider, providerInfo]): ProviderInfo => ({
      symbol: provider,
      ...providerInfo
    }))

    providersMutable.sort((a, b) => b.spendableBtc - a.spendableBtc).forEach(provider => {
      provider.involvedDemands.sort((a, b) => b.demandBtc - a.demandBtc)
    })

    let finalOrders: NewOrder[] = []

    function parseQuantity(qty: number, stepSize: string) {
      const size = parseFloat(stepSize)
      console.log(`
          qty: ${qty}, stepSize: ${stepSize}
          size: ${size}
          step 1: ${qty / size}
          step 2: ${Math.floor(qty / size)}
          step 3: ${Math.floor(qty / size) * size}
          alte 3: ${Math.floor(qty / size) / (1 / size)}
        `)
      return (Math.floor(qty / size) / (1 / size))
    }

    providersMutable.forEach((provider, providerIdx, providerSrc) => {

      function generateOrder(provider: ProviderInfo, demand: DemandInfo, providerIdx: number): void {
        if (demand.demandBtc < provider.spendableBtc) {

          const quantity = demand.side === 'BUY'
            ? parseQuantity(demand.demandSym, demand.lotSize.stepSize)
            : parseQuantity(provider.spendable * (demand.demandBtc / provider.spendableBtc), demand.lotSize.stepSize)

          if (quantity >= parseFloat(demand.lotSize.minQty) && getNotionalAmount(demand.pair, demand.side, quantity) >= parseFloat(demand.minNotional.minNotional)) {
            finalOrders.push({
              symbol: demand.pair,
              side: demand.side,
              type: 'MARKET',
              quantity: quantity.toString()
            })
            providerSrc[providerIdx].spendableBtc -= demand.demandBtc
            providerSrc[providerIdx].spendable -= provider.spendable * (demand.demandBtc / provider.spendableBtc)
            providerSrc.forEach(provider => {
              provider.involvedDemands.forEach(demandCollector => {
                if (demandCollector.symbol === demand.symbol) {
                  demandCollector.demandBtc = 0
                  demandCollector.demandSym = 0
                }
              })
            })
          }
        } else {

          const quantity = demand.side === 'BUY'
            ? parseQuantity(demand.demandSym * (provider.spendableBtc / demand.demandBtc), demand.lotSize.stepSize)
            : parseQuantity(provider.spendable, demand.lotSize.stepSize)

          if (quantity >= parseFloat(demand.lotSize.minQty) && getNotionalAmount(demand.pair, demand.side, quantity) >= parseFloat(demand.minNotional.minNotional)) {
            finalOrders.push({
              symbol: demand.pair,
              side: demand.side,
              type: 'MARKET',
              quantity: quantity.toString()
            })
            providerSrc.forEach(provider => {
              provider.involvedDemands.forEach(demandCollector => {
                if (demandCollector.symbol === demand.symbol) {
                  demandCollector.demandBtc -= provider.spendableBtc
                  demandCollector.demandSym -= demand.demandSym * (provider.spendableBtc / demand.demandBtc)
                }
              })
            })
            providerSrc[providerIdx].spendableBtc = 0
            providerSrc[providerIdx].spendable = 0
          }
        }
      }


      if (provider.spendableBtc > 0) {
        provider.involvedDemands.forEach(demand => {
          if (provider.spendableBtc > 0 && demand.demandBtc > 0) {
            if (!demand.alternativeProviders.length) {
              generateOrder(provider, demand, providerIdx)
            } else {
              demand.alternativeProviders.forEach(altProviderSymbol => {
                providerSrc.forEach((altProvider, altProviderIdx) => {
                  altProvider.involvedDemands.forEach(altDemand => {
                    if (altProvider.symbol === altProviderSymbol && altDemand.symbol === demand.symbol && altProvider.spendableBtc > 0 && altDemand.demandBtc > 0) {
                      generateOrder(altProvider, altDemand, altProviderIdx)
                    }
                  })
                })
              })
              if (demand.demandBtc > 0 && provider.spendableBtc > 0) {
                generateOrder(provider, demand, providerIdx)
              }
            }
          }
        })
      }
    })
    return finalOrders
  }

  const finalOrders = getFinalOrders()

  const ordersResult = await Promise.all(finalOrders.map(newOrder => Binance.newOrder(user.id, newOrder)))

  return {
    data: {
      ordersResult,
      finalOrders,
      orderBooks,
      orderPairs,
      // newSymbolAnalysisWithNews,
      // newSymbolAnalysis,

      participatingPairs,
      // markets,
      symbolAmount,
      btcDifference,
      percentDifferences,
      btcAmount,
      pieChart: symbolAnalysis.symbolPie,
      balances: balancesPercentages,
      analysis: symbolAnalysis
    }
  }
}