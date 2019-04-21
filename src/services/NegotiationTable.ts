import { DemandInfo, ProviderInfo } from './TradeBot'

interface AvgPrices {
  [pair: string]: number
}

class NegotiationTable {

  private readonly avgPrices: AvgPrices

  private readonly providers: ProviderInfo[]

  private providerWallet: {
    [providerSymbol: string]: number
  }

  private demands: DemandInfo[]

  constructor(avgPrices: AvgPrices, providers: ProviderInfo[]) {
    this.avgPrices = avgPrices
    this.providers = providers
    this.providerWallet = providers.reduce((acc, provider) => {
      acc[provider.symbol] = provider.spendableBtc
      return acc
    }, {})
  }

}

export default NegotiationTable