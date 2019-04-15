import * as request from 'superagent'
import { CryptoPanicAPI } from '../../constants'

const endSymbols = ['BNB', 'BTC', 'USDT', 'ETH', 'XRP']

export default async pairs => {
  
  const symbols = pairs.reduce((acc, pair) => {
    for (let i = 0; i < endSymbols.length; i++)
      if (pair.endsWith(endSymbols[i])) {
        const start = pair.slice(0, pair.length - endSymbols[i].length)
        if (!acc.includes(start)) acc.push(start)
        if (!acc.includes(endSymbols[i])) acc.push(endSymbols[i])
        return acc
      }
  }, []).join(',')

  const fetchResult = await Promise.all([request.get(`https://cryptopanic.com/api/v1/posts/?auth_token=${CryptoPanicAPI}&currencies=${symbols}&filter=hot`)])

  fetchResult[0].body.results.map(test => console.log('test = ', test))
}