import { CandidatePair, DroppedPair, FinalPair } from './TradeBot'

export interface ParticipantPair extends CandidatePair {
  collectorScore: number,
  minBase: number,
  minQuote: number,
  stepSize: number,
  price: number,
  providerFundsBtc?: number,
  collectorAmountBtc?: number,
  baseAmount?: number,
  quoteAmount?: number
}

export interface Provider {
  providerSymbol: string,
  totalSpendable: number,
  totalSpendableBtc: number,
  spendable: number,
  spendableBtc: number,
  logger: string,
}

export interface Collector {
  collectorSymbol: string,
  demandBtc: number,
  demand: number,
  logger: string
}

export interface NegotiationTableInput {
  dropPair: (candidatePair: DroppedPair) => boolean
  addToFinalPairs: (pair: FinalPair) => void
}

function parseStepSize(qty: number, stepSize: number) {
  return Math.floor(qty / stepSize) / (1 / stepSize)
}

interface INegotiationTable {
  providerFundsBtc: { [providerSymbol: string]: number }
  providerFunds: { [providerSymbol: string]: number }
  collectorAmountBtc: { [collectorSymbol: string]: number }
  collectorAmount: { [collectorSymbol: string]: number }
}

class NegotiationTable implements INegotiationTable {

  private candidatePairs: ParticipantPair[] = []

  private readonly dropPair: (pair: DroppedPair) => boolean
  private readonly addToFinalPairs: (pair: FinalPair) => void

  public providerFundsBtc: { [providerSymbol: string]: number } = {}
  public providerFunds: { [providerSymbol: string]: number } = {}
  private providerTotalFundsBtc: { [providerSymbol: string]: number } = {}
  private providerTotalFunds: { [providerSymbol: string]: number } = {}

  public collectorAmountBtc: { [collectorSymbol: string]: number } = {}
  public collectorAmount: { [collectorSymbol: string]: number } = {}

  constructor({ dropPair, addToFinalPairs }: NegotiationTableInput) {
    this.dropPair = dropPair
    this.addToFinalPairs = addToFinalPairs
  }

  public addProvider = (provider: Provider): void => {
    this.providerFundsBtc[provider.providerSymbol] = provider.spendableBtc
    this.providerFunds[provider.providerSymbol] = provider.spendable
    this.providerTotalFundsBtc[provider.providerSymbol] = provider.totalSpendableBtc
    this.providerTotalFunds[provider.providerSymbol] = provider.totalSpendable
  }

  public addCollector = (demand: Collector): void => {
    this.collectorAmountBtc[demand.collectorSymbol] = demand.demandBtc
    this.collectorAmount[demand.collectorSymbol] = demand.demand
  }

  public addCandidatePair = (pair: ParticipantPair) => {
    this.candidatePairs.push(pair)
  }

  public run() {
    this.candidatePairs.sort((a, b) => b.collectorScore - a.collectorScore)
    for (let i = 0, len = this.candidatePairs.length; i < len; i++) {
      const pair = this.candidatePairs[i]

      pair.providerFundsBtc = this.providerFundsBtc[pair.provider]
      pair.collectorAmountBtc = this.collectorAmountBtc[pair.collector]
      
      if (pair.providerFundsBtc <= 0) {
        this.dropPair({ ...pair, dropCode: 6 } as DroppedPair)
        continue
      }
      
      if (pair.collectorAmountBtc <= 0) {
        this.dropPair({ ...pair, dropCode: 7 } as DroppedPair)
        continue
      }

      if (pair.providerFundsBtc > pair.collectorAmountBtc) {

        if (pair.side === 'BUY') {

          // collector
          pair.baseAmount = parseStepSize(this.collectorAmount[pair.collector], pair.stepSize)
          if (pair.baseAmount < pair.minBase) {
            this.dropPair({ ...pair, dropCode: 8 } as DroppedPair)
            continue
          }

          // provider
          pair.quoteAmount = pair.baseAmount * pair.price
          if (pair.quoteAmount < pair.minQuote) {
            this.dropPair({ ...pair, dropCode: 9 } as DroppedPair)
            continue
          }

          this.providerFunds[pair.provider] -= pair.quoteAmount

        } else {

          // collector
          pair.quoteAmount = this.collectorAmount[pair.collector]
          if (pair.quoteAmount < pair.minQuote) {
            this.dropPair({ ...pair, dropCode: 10 } as DroppedPair)
            continue
          }

          // provider
          pair.baseAmount = parseStepSize(pair.quoteAmount / pair.price, pair.stepSize)
          if (pair.baseAmount < pair.minBase) {
            this.dropPair({ ...pair, dropCode: 11 } as DroppedPair)
            continue
          }

          this.providerFunds[pair.provider] -= pair.baseAmount
        }

        this.providerFundsBtc[pair.provider] -= pair.collectorAmountBtc
        this.collectorAmountBtc[pair.collector] = 0
        this.collectorAmount[pair.collector] = 0

      } else if (pair.providerFundsBtc < pair.collectorAmountBtc) {

        if (pair.side === 'BUY') {

          // provider
          pair.quoteAmount = this.providerFunds[pair.provider]
          if (pair.quoteAmount < pair.minQuote) {
            this.dropPair({ ...pair, dropCode: 9 } as DroppedPair)
            continue
          }

          // collector
          pair.baseAmount = parseStepSize(pair.quoteAmount / pair.price, pair.stepSize)
          if (pair.baseAmount < pair.minBase) {
            this.dropPair({ ...pair, dropCode: 8 } as DroppedPair)
            continue
          }

          this.collectorAmount[pair.collector] -= pair.baseAmount

        } else {

          // provider
          pair.baseAmount = parseStepSize(this.providerFunds[pair.provider], pair.stepSize)
          if (pair.baseAmount < pair.minBase) {
            this.dropPair({ ...pair, dropCode: 11 } as DroppedPair)
            continue
          }

          // collector
          pair.quoteAmount = pair.baseAmount * pair.price
          if (pair.quoteAmount < pair.minQuote) {
            this.dropPair({ ...pair, dropCode: 10 } as DroppedPair)
            continue
          }

          this.collectorAmount[pair.collector] -= pair.quoteAmount

        }

        this.collectorAmountBtc[pair.collector] -= pair.providerFundsBtc
        this.providerFundsBtc[pair.provider] = 0
        this.providerFunds[pair.provider] = 0

      } else {
        this.dropPair({ ...pair, dropCode: 12 } as DroppedPair)
        continue
      }

      this.addToFinalPairs(pair as FinalPair)
    }
  }
}

export default NegotiationTable