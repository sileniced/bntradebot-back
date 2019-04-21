import { standardSymbols } from '../constants'
import { Binance } from '../index'
import SymbolAnalysis from './SymbolAnalysis'
import {
  // Bid,
  NewOrder,
  // OrderBook,
  OrderSide,
  Symbol,
  SymbolLotSizeFilter,
  SymbolMinNotionalFilter,
  Order,
} from 'binance-api-node'
import IntervalAnalysis from './IntervalAnalysis'
import newsSettings from './NewsAnalysis/settings'
import SavedOrder from '../entities/SavedOrder'
import NegotiationTable from './NegotiationTable'


export interface DemandInfo {
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

export interface ProviderInfo {
  symbol: string,
  totalSpendable: number,
  totalSpendableBtc: number,
  // spendableImmu: number,
  // spendableBtcImmu: number,
  spendable: number,
  spendableBtc: number,
  // total: number,
  // weighted: number
  involvedLength: number,
  involvedWith: string[],
  involvedDemands: DemandInfo[]
  // involvedIn: OrderData[],
}

export interface Negotiation {
  pair: string,
  side: string,
  price: number,
  qtyBase: number,
  qtyQuote: number
}

export interface Candidate {
  [pair: string]: {
    _pairScore: number,
    pairInfo: Symbol,
    buy: number,
    sell: number
  }
}

export interface TradeBot {
  data: {
    time: number,
    ordersResult: SavedOrder[] | Partial<Order>[],
    negotiationOrders: Negotiation[],
    balance: {
      btc: number,
      usd: number,
    },
    candidateAnalysis: Candidate,
    finalOrders: NewOrder[],
    participatingPairs: string[],
    pieChart: ({})[]
  }
}

export default async (user): Promise<TradeBot> => {
  const start = Date.now()
  const avgPriceBtcUsdtPromise = Binance.getAvgPrice('BTCUSDT')

  const symbols = ['USDT', ...standardSymbols.toUpperCase().split(',')]
  const allPairs = await Binance.getPairs()
  const pairsInfo = allPairs.filter(pair => symbols.includes(pair.baseAsset) && symbols.includes(pair.quoteAsset))

  const symbolAnalysisPromise = SymbolAnalysis(symbols, pairsInfo)


  const balancesUnfiltered = await Binance.getAccountBalances(user.id)
  const balances = balancesUnfiltered.filter(balance =>
    parseFloat(balance.free) > 0 &&
    allPairs.filter(pair =>
      balance.asset === pair.baseAsset || balance.asset === pair.quoteAsset
    ).length > 0
  )

  const avgPricesBtcNames: string[] = balances.map(balance => balance.asset).filter(symbol => symbol !== 'BTC' && symbol !== 'USDT')
  const avgPricesBtcUnnamed = await Promise.all(avgPricesBtcNames.map(symbol => Binance.getAvgPrice(`${symbol}BTC`)))
  const avgPricesBtc = avgPricesBtcNames.reduce((acc, pair, idx) => {
    acc[pair] = avgPricesBtcUnnamed[idx]
    return acc
  }, {})
  const avgPriceBtcUsdt = await avgPriceBtcUsdtPromise
  avgPricesBtc['BTC'] = 1
  avgPricesBtc['USDT'] = 1 / avgPriceBtcUsdt

  // const standardBookNames = ['BTC', 'USDT']
  // const balanceFilteredBooks = balances.filter(({ asset }) => !standardBookNames.includes(asset))
  // const balanceBooksUnnamed = await Promise.all([...balanceFilteredBooks.map(({ asset }) => Binance.getBook(`${asset}BTC`)), Binance.getBook(standardBookNames.join(''))])
  //
  // const balanceBookBtc: {
  //   [symbol: string]: OrderBook
  // } = balanceBooksUnnamed.reduce((acc, book, idx) => {
  //   acc[balanceFilteredBooks[idx] ? balanceFilteredBooks[idx].asset : standardBookNames[1]] = book
  //   return acc
  // }, {})
  //
  // function getBtcValue(balance: number, book: Bid[]) {
  //   let page = 0
  //   let btc = 0
  //   while (balance > 0) {
  //     const quantity = parseFloat(book[page].quantity)
  //     if (quantity >= balance) {
  //       btc += parseFloat(book[page].price) * balance
  //       balance = 0
  //     } else {
  //       btc += parseFloat(book[page].price) * quantity
  //       balance -= quantity
  //     }
  //     page++
  //   }
  //   return btc
  // }

  const balancesBtc = balances.map(balance => ({
    ...balance,
    free: parseFloat(balance.free),
    // btcValue: balance.asset === 'BTC'
    //   ? parseFloat(balance.free)
    //   : getBtcValue(parseFloat(balance.free), balanceBookBtc[balance.asset].bids)
    btcValue: parseFloat(balance.free) * avgPricesBtc[balance.asset]
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

  const balancesNormalizedBtc = balancesPercentages.reduce((acc, balance: BalancesBtc) => {
    acc[balance.asset] = balance
    return acc
  }, {} as { [symbol: string]: BalancesBtc })

  const balancesNormalized = balancesPercentages.reduce((acc, balance) => {
    acc[balance.asset] = balance.percentage
    return acc
  }, {})

  const avgPricesBtcRestNames = symbols.filter(symbol => !['BTC', 'USDT'].includes(symbol) && !avgPricesBtcNames.filter(balance => balance === symbol).length)
  const avgPricesBtcRestUnnamed = await Promise.all(avgPricesBtcRestNames.map(symbol => Binance.getAvgPrice(`${symbol}BTC`)))
  avgPricesBtcRestNames.forEach((symbol, idx) => {
    avgPricesBtc[symbol] = avgPricesBtcRestUnnamed[idx]
  })

  // const symbolsFilteredBooks = symbols.filter(symbol => !standardBookNames.includes(symbol) && !balanceFilteredBooks.filter(balance => balance.asset === symbol).length)
  // const symbolBooksUnnamed = await Promise.all(symbolsFilteredBooks.map(symbol => Binance.getBook(`${symbol}BTC`)))
  //
  // const symbolBooksBtc: {
  //   [symbol: string]: OrderBook
  // } = {
  //   ...balanceBookBtc,
  //   ...symbolBooksUnnamed.reduce((acc, book, idx) => {
  //     acc[symbolsFilteredBooks[idx]] = book
  //     return acc
  //   }, {})
  // }

  const symbolAnalysis = await symbolAnalysisPromise

  // function getSymbolAmount(balance: number, book: Bid[]) {
  //   let page = 0
  //   let amount = 0
  //   while (balance > 0) {
  //     const quantity = parseFloat(book[page].quantity) * parseFloat(book[page].price)
  //     if (quantity >= balance) {
  //       amount += parseFloat(book[page].quantity) * balance / quantity
  //       balance = 0
  //     } else {
  //       amount += parseFloat(book[page].quantity)
  //       balance -= quantity
  //     }
  //     page++
  //   }
  //   return amount
  // }

  const {
    percentDifferences,
    // btcAmount,
    btcDifference,
    symbolAmount,
    marketArr
  } = Object.entries(symbolAnalysis.symbolPie).reduce((acc, [symbol, percentage]: [string, number]) => {
    acc.percentDifferences[symbol] = !balancesNormalized[symbol] ? percentage : percentage - balancesNormalized[symbol]
    const bs = acc.percentDifferences[symbol] < 0 ? 'sell' : 'buy'
    // acc.btcAmount[symbol] = percentage * totalBtcValue
    acc.btcDifference[bs][symbol] = Math.abs(acc.percentDifferences[symbol] * totalBtcValue)
    acc.symbolAmount[bs][symbol] = symbol === 'BTC'
      ? Math.abs(acc.percentDifferences[symbol] * totalBtcValue)
      : acc.btcDifference[bs][symbol] / avgPricesBtc[symbol]
    acc.marketArr[bs].push(symbol)
    return acc
  }, {
    marketArr: { sell: [] as string[], buy: [] as string[] },
    symbolAmount: { sell: {}, buy: {} },
    btcDifference: { sell: {}, buy: {} },
    // btcAmount: {},
    percentDifferences: {}
  })

  const candidatePairs = marketArr.sell.reduce((acc, sellSymbol) => {
    marketArr.buy.forEach(buySymbol => {
      pairsInfo.forEach(pair => {
        if ((pair.quoteAsset === sellSymbol && pair.baseAsset === buySymbol) || (pair.baseAsset === sellSymbol && pair.quoteAsset === buySymbol)) {
          acc.push(pair.symbol)
        }
      })
    })
    return acc
  }, [] as string[])

  /*
  todo: are all symbols represented? what about double transactions
   */

  const candidateAnalysisWithoutNews = await Promise.all(candidatePairs.map(pair => IntervalAnalysis(pair)))

  const candidateAnalysis = candidateAnalysisWithoutNews.reduce((acc, pairScore) => {
    Object.entries(pairScore).forEach(([pair, { _score }]: [string, { _score: number }]) => {
      const score = (_score / newsSettings.newsDivider * (newsSettings.newsDivider - 1)) + (symbolAnalysis.analysis.news[pair] / newsSettings.newsDivider)
      const ls = (score - 1 / 2)
      acc[pair] = {
        _pairScore: score,
        pairInfo: pairsInfo.filter(pairInfo => pairInfo.symbol === pair)[0],
        buy: ls > 0 ? ls * 2 : 0,
        sell: ls < 0 ? -ls * 2 : 0
      }
    })
    return acc
  }, {} as Candidate)

  interface OrderData {
    // prototype: NewOrder,
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

  const participatingPairs = Object.entries(candidateAnalysis).filter(([, { buy, sell, pairInfo }]) => !(((buy > 0 && sell === 0) && (!symbolAmount.buy[pairInfo.baseAsset] || !symbolAmount.sell[pairInfo.quoteAsset])) || ((sell > 0 && buy === 0) && (!symbolAmount.buy[pairInfo.quoteAsset] || !symbolAmount.sell[pairInfo.baseAsset]))))

  const avgPricesOrdersNames = participatingPairs.map(([, { pairInfo: { symbol } }]) => symbol)
  const avgPricesOrdersUnnamedPromises = Promise.all(avgPricesOrdersNames.map(pair => Binance.getAvgPrice(pair)))
  // const orderBooksNames = participatingPairs.map(([, { pairInfo: { symbol } }]) => symbol)
  // const orderBooksUnnamedPromise = Promise.all(orderBooksNames.map(pair => Binance.getBook(pair)))

  const orderPairs = participatingPairs.map(([, { buy, sell, pairInfo }]): OrderData => {

    const bool = buy > 0 && sell === 0
    // const bqBuy = bool ? 'baseAsset' : 'quoteAsset'
    // const bqSell = bool ? 'quoteAsset' : 'baseAsset'
    const bqBase = bool ? 'buy' : 'sell'
    const bqQuote = bool ? 'sell' : 'buy'

    // const participating = participatingPairs.filter(([, { pairInfo: pairInfo2 }]) => pairInfo[bqBuy] === pairInfo2.baseAsset || pairInfo[bqBuy] === pairInfo2.quoteAsset)

    return {
      // prototype: {
      //   symbol: pairInfo.symbol,
      //   side: buy > 0 && sell === 0 ? 'BUY' : 'SELL',
      //   type: 'MARKET',
      //   quantity: symbolAmount[bqBase][pairInfo.baseAsset]
      // },
      // extra: {
      //   'what_you_want': pairInfo[bqBuy],
      //   'how_much_you_want_of_it': symbolAmount.buy[pairInfo[bqBuy]],
      //   'how_much_is_this_in_btc': btcDifference.buy[pairInfo[bqBuy]],
      //   'how_much_you_can_pay_for_it': symbolAmount.sell[pairInfo[bqSell]],
      //   'how_much_is_that_in_btc': btcDifference.sell[pairInfo[bqSell]],
      //   'what_is_the_size_of_the_transaction': btcDifference.buy[pairInfo[bqBuy]],
      //   'can_you_pay_for_it?': btcDifference.sell[pairInfo[bqSell]] - btcDifference.buy[pairInfo[bqBuy]] > 0,
      //   [btcDifference.sell[pairInfo[bqSell]] - btcDifference.buy[pairInfo[bqBuy]] > 0 ? 'how_much_you_have_left' : 'how_much_you_need']: Math.abs(btcDifference.sell[pairInfo[bqSell]] - btcDifference.buy[pairInfo[bqBuy]]),
      //   'how_many_symbols_are_paying_for_it': participating.length
      // },
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
        symbol: order.pairInfo[bqSell],
        totalSpendable: balancesNormalizedBtc[order.pairInfo[bqSell]].free,
        totalSpendableBtc: balancesNormalizedBtc[order.pairInfo[bqSell]].btcValue,
        spendable: symbolAmount.sell[order.pairInfo[bqSell]],
        spendableBtc: btcDifference.sell[order.pairInfo[bqSell]],
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
    // if (!acc.buy[order.pairInfo[bqBuy]]) {
    //   const involved = orderPairs.filter(orderPair => order.pairInfo[bqBuy] === orderPair.pairInfo.quoteAsset || order.pairInfo[bqBuy] === orderPair.pairInfo.baseAsset)
    //   acc.buy[order.pairInfo[bqBuy]] = {
    //     total: 0,
    //     weighted: 0,
    //     involvedLength: involved.length,
    //     involvedWith: involved.map(involvedOrder => involvedOrder.side === 'BUY' ? involvedOrder.pairInfo[bqSell] : involvedOrder.pairInfo[bqBuy])
    //     // involvedIn: involved
    //   }
    // }


    return acc
  }, {
    sell: {} as {
      [symbol: string]: ProviderInfo
    }
    // buy: {} as {
    //   [symbol: string]: {
    //     total: number,
    //     weighted: number
    //     involvedLength: number,
    //     involvedWith: string[],
    //     // involvedIn: OrderData[],
    //   }
    // }
  })

  const avgPricesOrdersUnnamed = await avgPricesOrdersUnnamedPromises
  const avgPricesOrders = avgPricesOrdersNames.reduce((acc, pair, idx) => {
    acc[pair] = avgPricesOrdersUnnamed[idx]
    return acc
  }, {})

  // const orderBooksUnnamed = await orderBooksUnnamedPromise
  // const orderBooks = orderBooksNames.reduce((acc, pair, idx) => {
  //   acc[pair] = orderBooksUnnamed[idx]
  //   return acc
  // }, {})

  // function getNotionalAmount(pair, side, balance): number {
  //   // todo: BUGGY BUGGY BUGGY BUGGY BUGGY BUGGY
  //   // todo: I need to find out if it's either 'asks' or 'bids' at the 'BUY' side
  //   const book = orderBooks[pair][side === 'BUY' ? 'asks' : 'bids']
  //   let page = 0
  //   let amount = 0
  //   if (side === 'BUY') {
  //
  //     while (balance > 0) {
  //       const quantity = parseFloat(book[page].quantity)
  //       if (quantity >= balance) {
  //         amount += parseFloat(book[page].price) * balance
  //         balance = 0
  //       } else {
  //         amount += parseFloat(book[page].price) * quantity
  //         balance -= quantity
  //       }
  //       page++
  //     }
  //
  //   } else {
  //
  //     while (balance > 0) {
  //       const quantity = parseFloat(book[page].quantity) * parseFloat(book[page].price)
  //       if (quantity >= balance) {
  //         amount += parseFloat(book[page].quantity) * balance / quantity
  //         balance = 0
  //       } else {
  //         amount += parseFloat(book[page].quantity)
  //         balance -= quantity
  //       }
  //       page++
  //     }
  //
  //   }
  //
  //   console.error('CRITICAL BUG, why arent you going after it')
  //   console.log('pair, side, balance, amount, page = ', pair, side, balance, amount, page)
  //   return amount
  // }

  function getFinalOrders() {
    let providersMutable: ProviderInfo[] = Object.entries(ordersTotal.sell).map(([, providerInfo]): ProviderInfo => providerInfo)

    providersMutable.sort((a, b) => b.spendableBtc - a.spendableBtc).forEach(provider => {
      provider.involvedDemands.sort((a, b) => b.demandBtc - a.demandBtc)
    })

    let finalOrders: NewOrder[] = []
    let negotiationOrders: Negotiation[] = []

    function parseQuantity(qty: number, stepSize: string) {
      const size = parseFloat(stepSize)
      return (Math.floor(qty / size) / (1 / size))
    }

    providersMutable.forEach((provider, providerIdx, providerSrc) => {

      function generateOrder(provider: ProviderInfo, demand: DemandInfo, providerIdx: number): void {
        if (demand.demandBtc < provider.spendableBtc) {

          const quantity = demand.side === 'BUY'
            ? parseQuantity(demand.demandSym, demand.lotSize.stepSize)
            : parseQuantity(provider.spendable * (demand.demandBtc / provider.spendableBtc), demand.lotSize.stepSize)

          const notionalAmount = quantity * avgPricesOrders[demand.pair]

          negotiationOrders.push({
            pair: demand.pair,
            side: demand.side,
            price: avgPricesOrders[demand.pair],
            qtyBase: quantity,
            qtyQuote: notionalAmount
          })

          if (
            (quantity >= parseFloat(demand.lotSize.minQty))
            && (notionalAmount >= parseFloat(demand.minNotional.minNotional))
            && (demand.side === 'BUY' ? notionalAmount < provider.totalSpendable : demand.demandSym < provider.totalSpendable)
          ) {
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

          const notionalAmount = quantity * avgPricesOrders[demand.pair]

          negotiationOrders.push({
            pair: demand.pair,
            side: demand.side,
            price: avgPricesOrders[demand.pair],
            qtyBase: quantity,
            qtyQuote: notionalAmount
          })

          if ((quantity >= parseFloat(demand.lotSize.minQty))
            && (notionalAmount >= parseFloat(demand.minNotional.minNotional))
            && (demand.side === 'BUY' ? notionalAmount < provider.totalSpendable : demand.demandSym < provider.totalSpendable)
          ) {
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
    return { finalOrders, negotiationOrders }
  }

  const { finalOrders, negotiationOrders } = getFinalOrders()
  const { final, negotiations } = NegotiationTable(avgPricesOrders, )

  const ordersResult = await Promise.all(finalOrders.map(newOrder => Binance.newOrder(user, newOrder)))



  return {
    data: {
      time: Date.now() - start,
      ordersResult,
      finalOrders,
      // orderBooks,
      // orderPairs: orderPairs.map(order => ({
      //   pair: order.pair,
      //   side: order.side,
      //   qty: order.side === 'BUY' ? order.baseSymbolAmount : order.quotSymbolAmount
      // })),
      negotiationOrders,
      participatingPairs: participatingPairs.map(([pair]) => pair),
      candidateAnalysis,
      balance: {
        btc: totalBtcValue,
        usd: totalBtcValue * avgPriceBtcUsdt
      },
      // newSymbolAnalysisWithNews,
      // newSymbolAnalysis,

      // markets,
      // symbolAmount,
      // btcDifference,

      // btcAmount,
      pieChart: [balancesNormalized, symbolAnalysis.symbolPie, percentDifferences]
      // balances: balancesPercentages,
      // analysis: symbolAnalysis
    }
  }
}