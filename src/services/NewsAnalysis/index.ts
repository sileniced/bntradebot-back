import * as request from 'superagent'
import { CryptoPanicAPI } from '../../constants'

const endSymbols = ['BNB', 'BTC', 'USDT', 'ETH', 'XRP']

interface CryptoPanicPost {
  kind: string;
  domain: string;
  created_at: string;
  votes: { important: number; toxic: number; negative: number; saved: number; lol: number; positive: number; disliked: number; liked: number };
  source: { path: null; domain: string; title: string; region: string };
  id: number;
  title: string;
  published_at: string;
  slug: string;
  url: string;
  currencies: { code: string; title: string; slug: string; url: string }[]
}

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

  const fetchResult = await Promise.all([1, 2, 3, 4, 5].map(page => request.get(`https://cryptopanic.com/api/v1/posts/?auth_token=${CryptoPanicAPI}&currencies=${symbols}&filter=hot&page=${page}`)))

  fetchResult.map(result => result.body.results.map(({votes, currencies, title, created_at}: CryptoPanicPost) => {
    const analysis = {
      age: Date.now() - Date.parse(created_at),
      votes: {
        bull: votes.positive * 1.2 + votes.liked + votes.lol * 0.8,
        bear: votes.negative * 1.2 + votes.disliked + votes.toxic * 2,
        important: votes.important
      }
    }

    return analysis
  }))
}