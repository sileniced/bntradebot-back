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
  providerFundsBtc?: number,
  collectorAmountBtc?: number
  baseAmount?: number
  quoteAmount?: number
}

export interface Provider {
  providerSymbol: string,
  totalSpendable: number,
  totalSpendableBtc: number,
  spendable: number,
  spendableBtc: number,
}

export interface Collector {
  collectorSymbol: string,
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
      this.providerFundsBtc[provider.providerSymbol] = provider.spendableBtc
      this.providerFunds[provider.providerSymbol] = provider.spendable
      this.providerTotalFundsBtc[provider.providerSymbol] = provider.totalSpendableBtc
      this.providerTotalFunds[provider.providerSymbol] = provider.totalSpendable
    })

    collectors.forEach(demand => {
      this.collectorAmountBtc[demand.collectorSymbol] = demand.demandBtc
      this.collectorAmount[demand.collectorSymbol] = demand.demand
    })
  }

  public run() {
    this.pairs.forEach(pair => {
      pair.providerFundsBtc = this.providerFundsBtc[pair.provider.providerSymbol]
      if (pair.providerFundsBtc > 0) {
        pair.collectorAmountBtc = this.collectorAmountBtc[pair.collector.collectorSymbol]
        if (pair.collectorAmountBtc > 0) {
          if (pair.providerFundsBtc > pair.collectorAmountBtc) {
            if (pair.side === 'BUY') {
              pair.baseAmount = parseStepSize(this.collectorAmount[pair.collector.collectorSymbol], pair.stepSize) // collector
              pair.quoteAmount = pair.baseAmount * pair.price // provider
              if (pair.baseAmount > pair.minBase) {
                if (pair.quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: pair.baseAmount.toString(),
                    type: 'MARKET'
                  }, pair.collectorAmountBtc)
                  this.providerFundsBtc[pair.provider.providerSymbol] -= pair.collectorAmountBtc
                  this.providerFunds[pair.provider.providerSymbol] -= pair.quoteAmount
                  this.collectorAmountBtc[pair.collector.collectorSymbol] = 0
                  this.collectorAmount[pair.collector.collectorSymbol] = 0
                } else this.dropPair(pair, 'provider quote.amount < minQuote')
              } else this.dropPair(pair, 'collector base.amount < minBase')
            } else {
              pair.quoteAmount = this.collectorAmount[pair.collector.collectorSymbol] // collector
              pair.baseAmount = parseStepSize(pair.quoteAmount / pair.price, pair.stepSize) // provider
              if (pair.baseAmount > pair.minBase) {
                if (pair.quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: pair.baseAmount.toString(),
                    type: 'MARKET'
                  }, pair.collectorAmountBtc)
                  this.providerFundsBtc[pair.provider.providerSymbol] -= pair.collectorAmountBtc
                  this.providerFunds[pair.provider.providerSymbol] -= pair.baseAmount
                  this.collectorAmountBtc[pair.collector.collectorSymbol] = 0
                  this.collectorAmount[pair.collector.collectorSymbol] = 0
                } else this.dropPair(pair, 'collector quote.amount < minQuote')
              } else this.dropPair(pair, 'provider base.amount < minBase')
            }
          } else if (pair.providerFundsBtc < pair.collectorAmountBtc) {
            if (pair.side === 'BUY') {
              pair.quoteAmount = this.providerFunds[pair.provider.providerSymbol] // provider
              pair.baseAmount = parseStepSize(pair.quoteAmount / pair.price, pair.stepSize) // collector
              if (pair.baseAmount > pair.minBase) {
                if (pair.quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: pair.baseAmount.toString(),
                    type: 'MARKET'
                  }, pair.providerFundsBtc)
                  this.collectorAmountBtc[pair.collector.collectorSymbol] -= pair.providerFundsBtc
                  this.collectorAmount[pair.collector.collectorSymbol] -= pair.quoteAmount
                  this.providerFundsBtc[pair.provider.providerSymbol] = 0
                  this.providerFunds[pair.provider.providerSymbol] = 0
                } else this.dropPair(pair, 'provider quote.amount < minQuote')
              } else this.dropPair(pair, 'collector base.amount < minBase')
            } else {
              pair.baseAmount = parseStepSize(this.providerFunds[pair.provider.providerSymbol], pair.stepSize) // provider
              pair.quoteAmount = pair.baseAmount * pair.price // collector
              if (pair.baseAmount > pair.minBase) {
                if (pair.quoteAmount > pair.minQuote) {
                  this.addToFinalPairs({
                    symbol: pair.pair,
                    side: pair.side,
                    quantity: pair.baseAmount.toString(),
                    type: 'MARKET'
                  }, pair.providerFundsBtc)
                  this.collectorAmountBtc[pair.collector.collectorSymbol] -= pair.providerFundsBtc
                  this.collectorAmount[pair.collector.collectorSymbol] -= pair.baseAmount
                  this.providerFundsBtc[pair.provider.providerSymbol] = 0
                  this.providerFunds[pair.provider.providerSymbol] = 0
                } else this.dropPair(pair, 'collector quote.amount < minQuote')
              } else this.dropPair(pair, 'provider base.amount < minBase')
            }
          }
        } else this.dropPair(pair, 'collector amount satisfied')
      } else this.dropPair(pair, 'providerFunds dry')
    }, [] as NewOrder[])
  }

}

export default NegotiationTable