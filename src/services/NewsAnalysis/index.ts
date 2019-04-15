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

  const fetchResult = await Promise.all([1, 2, 3, 4, 5].map(page => request.get(`https://cryptopanic.com/api/v1/posts/?auth_token=${CryptoPanicAPI}&currencies=${symbols}&filter=hot&page=${page}`))
  )

  const example: CryptoPanicPost = {
    'kind': 'news',
    'domain': 'investinblockchain.com',
    'votes': {
      'negative': 0,
      'positive': 6,
      'important': 0,
      'liked': 7,
      'disliked': 1,
      'lol': 9,
      'toxic': 0,
      'saved': 0
    },
    'source': {
      'title': 'Invest in Blockchain',
      'region': 'en',
      'domain': 'investinblockchain.com',
      'path': null
    },
    'title': 'Vitalik: “Craig Wright Absolutely Should Have A Voice. But So Do All Of Us Laughing At His Stupidity.”',
    'published_at': '2019-04-15T09:25:12Z',
    'slug': 'Vitalik-Craig-Wright-Absolutely-Should-Have-A-Voice-But-So-Do-All-Of-Us-Laughing-At-His-Stupidity',
    'currencies': [
      {
        'code': 'ETH',
        'title': 'Ethereum',
        'slug': 'ethereum',
        'url': 'https://cryptopanic.com/news/ethereum/'
      }
    ],
    'id': 5131638,
    'url': 'https://cryptopanic.com/news/5131638/Vitalik-Craig-Wright-Absolutely-Should-Have-A-Voice-But-So-Do-All-Of-Us-Laughing-At-His-Stupidity',
    'created_at': '2019-04-15T09:25:12Z'
  }

  fetchResult.map(result => result.body.results.map(({votes, currencies, title, created_at}: CryptoPanicPost) => {
    const age = Date.now() - Date.parse(created_at)
    const votes = {
      bull: votes.positive * 1.2 + votes.liked + votes.lol * 0.8,
      bear: votes.negative * 1.2 + votes.disliked + votes.toxic * 2,
      important: votes.important
    }
  }))
}