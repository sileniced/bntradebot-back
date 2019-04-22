import { NewOrder, OrderSide } from 'binance-api-node'

export interface ParticipatingPair {
  pair: string,
  price: number,
  side: OrderSide,
  provider: Provider,
  collector: Collector,
  collectorScore: number,
  stepSize: number,
  minBase: number,
  minQuote: number,
}

export interface Provider {
  symbol: string,
  totalSpendable: number,
  totalSpendableBtc: number,
  spendable: number,
  spendableBtc: number,
}

export interface Collector {
  symbol: string,
  demandBtc: number,
  demand: number,
}

export interface NegotiationTableInput {
  participatingPairs: ParticipatingPair[],
  providers: Provider[],
  collectors: Collector[],
  dropPair: (candidatePair: ParticipatingPair, reason: string) => boolean
  addToFinalPairs: (order: NewOrder, btcValue: number) => void
}

function parseStepSize(qty: number, stepSize: number) {
  return Math.floor(qty / stepSize) / (1 / stepSize)
}

class NegotiationTable {

  private readonly pairs: ParticipatingPair[] = []
  private readonly dropPair: (pair: ParticipatingPair, reason: string) => boolean
  private readonly addToFinalPairs: (order: NewOrder, btcValue: number) => void

  private providerFundsBtc: { [providerSymbol: string]: number } = {}
  private providerFunds: { [providerSymbol: string]: number } = {}
  private providerTotalFundsBtc: { [providerSymbol: string]: number } = {}
  private providerTotalFunds: { [providerSymbol: string]: number } = {}

  private collectorAmountBtc: { [collectorSymbol: string]: number } = {}
  private collectorAmount: { [collectorSymbol: string]: number } = {}

  constructor({ participatingPairs, providers, collectors, dropPair, addToFinalPairs }: NegotiationTableInput) {
    this.pairs = participatingPairs
    this.dropPair = dropPair
    this.addToFinalPairs = addToFinalPairs

    providers.forEach(provider => {
      this.providerFundsBtc[provider.symbol] = provider.spendableBtc
      this.providerFunds[provider.symbol] = provider.spendable
      this.providerTotalFundsBtc[provider.symbol] = provider.totalSpendableBtc
      this.providerTotalFunds[provider.symbol] = provider.totalSpendable
    })

    collectors.forEach(demand => {
      this.collectorAmountBtc[demand.symbol] = demand.demandBtc
      this.collectorAmount[demand.symbol] = demand.demand
    })
  }

  public run() {
    return this.pairs.reduce((finalPairs, pair) => {
      const providerFundsBtc = this.providerFundsBtc[pair.provider.symbol]
      if (providerFundsBtc > 0) {
        const collectorAmountBtc = this.collectorAmountBtc[pair.collector.symbol]
        if (collectorAmountBtc > 0) {
          if (providerFundsBtc > collectorAmountBtc) {
            if (pair.side === 'BUY') {
              const baseAmount = parseStepSize(this.collectorAmount[pair.collector.symbol], pair.stepSize) // collector
              const quoteAmount = baseAmount * pair.price // provider
              if (baseAmount > pair.minBase) {
                if (quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: baseAmount.toString(),
                    type: 'MARKET'
                  }, collectorAmountBtc)
                  this.providerFundsBtc[pair.provider.symbol] -= collectorAmountBtc
                  this.providerFunds[pair.provider.symbol] -= quoteAmount
                  this.collectorAmountBtc[pair.collector.symbol] = 0
                  this.collectorAmount[pair.collector.symbol] = 0
                } else this.dropPair(pair, 'provider quote.amount < minQuote')
              } else this.dropPair(pair, 'collector base.amount < minBase')
            } else {
              const quoteAmount = this.collectorAmount[pair.collector.symbol] // collector
              const baseAmount = parseStepSize(quoteAmount / pair.price, pair.stepSize) // provider
              if (baseAmount > pair.minBase) {
                if (quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: baseAmount.toString(),
                    type: 'MARKET'
                  }, collectorAmountBtc)
                  this.providerFundsBtc[pair.provider.symbol] -= collectorAmountBtc
                  this.providerFunds[pair.provider.symbol] -= baseAmount
                  this.collectorAmountBtc[pair.collector.symbol] = 0
                  this.collectorAmount[pair.collector.symbol] = 0
                } else this.dropPair(pair, 'collector quote.amount < minQuote')
              } else this.dropPair(pair, 'provider base.amount < minBase')
            }
          } else if (providerFundsBtc < collectorAmountBtc) {
            if (pair.side === 'BUY') {
              const quoteAmount = this.providerFunds[pair.provider.symbol] // provider
              const baseAmount = parseStepSize(quoteAmount / pair.price, pair.stepSize) // collector
              if (baseAmount > pair.minBase) {
                if (quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: baseAmount.toString(),
                    type: 'MARKET'
                  }, providerFundsBtc)
                  this.collectorAmountBtc[pair.collector.symbol] -= providerFundsBtc
                  this.collectorAmount[pair.collector.symbol] -= quoteAmount
                  this.providerFundsBtc[pair.provider.symbol] = 0
                  this.providerFunds[pair.provider.symbol] = 0
                } else this.dropPair(pair, 'provider quote.amount < minQuote')
              } else this.dropPair(pair, 'collector base.amount < minBase')
            } else {
              const baseAmount = parseStepSize(this.providerFunds[pair.provider.symbol], pair.stepSize) // provider
              const quoteAmount = baseAmount * pair.price // collector
              if (baseAmount > pair.minBase) {
                if (quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: baseAmount.toString(),
                    type: 'MARKET'
                  }, providerFundsBtc)
                  this.collectorAmountBtc[pair.collector.symbol] -= providerFundsBtc
                  this.collectorAmount[pair.collector.symbol] -= baseAmount
                  this.providerFundsBtc[pair.provider.symbol] = 0
                  this.providerFunds[pair.provider.symbol] = 0
                } else this.dropPair(pair, 'collector quote.amount < minQuote')
              } else this.dropPair(pair, 'provider base.amount < minBase')
            }
          }
        } else this.dropPair(pair, 'collector amount satisfied')
      } else this.dropPair(pair, 'providerFunds dry')
      return finalPairs
    }, [] as NewOrder[])
  }

}

export default NegotiationTable