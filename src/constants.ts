const CryptoPanicAPI = '0e0d2c326110b4f8ba62d8a9393cd0d949a28dee'
export const CryptoPanicLink = (symbols, page) => `https://cryptopanic.com/api/v1/posts/?auth_token=${CryptoPanicAPI}&currencies=${symbols.join(',')}&page=${page}&filter=rising`
export const standardSymbols = 'BTC,ETH,BNB'