import * as request from 'superagent'
import { CryptoPanicAPI } from '../../constants'
import settings from './settings'
import { Response } from 'superagent'

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

const weighVotes = votes => Object.entries(settings.votes.moods).reduce((moodAcc, [mood, keyWeights]) => {
  moodAcc[mood] = Object.entries(keyWeights).reduce((acc, [key, weight]) => {
    acc[key] = votes[key] * weight
    acc._score += acc[key]
    moodAcc._count += acc[key]
    moodAcc._unWeightedScore += mood === 'bullish' ? acc[key] : 0
    return acc
  }, { _score: 0 })
  moodAcc._score = moodAcc._count > 0 ? moodAcc._unWeightedScore / moodAcc._count : 1 / 2
  return moodAcc
}, {
  _score: 0,
  _postWeight: Object.entries(settings.votes.weights).reduce((acc, [key, weight]) => acc * Math.pow(weight, votes[key]), 1),
  _unWeightedScore: 0,
  _count: 0
})

const pageList = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]

export default async pairs => {

  const symbols = await pairs.reduce((acc, pair) => {
    for (let i = 0; i < endSymbols.length; i++)
      if (pair.endsWith(endSymbols[i])) {
        const start = pair.slice(0, pair.length - endSymbols[i].length)
        if (!acc.includes(start)) acc.push(start)
        if (!acc.includes(endSymbols[i])) acc.push(endSymbols[i])
        return acc
      }
  }, [])

  const fetchLink = `https://cryptopanic.com/api/v1/posts/?auth_token=${CryptoPanicAPI}&currencies=${symbols.join(',')}`

  const fetchResult: CryptoPanicPost[][] = await Promise.all(pageList.map(pages => {
    const newsFetcher = async () => {
      const fetchResult: Response[] = await Promise.all(pages.map(page => request.get(`${fetchLink}&page=${page}&filter=rising`)))
      return fetchResult.reduce((acc: [], result: Response) => [...acc, ...result.body.results], [])
    }
    return new Promise(resolve => setTimeout(() => resolve(newsFetcher()), pages[0] === 1 ? 0 : 1000))
  }))

  const posts = fetchResult.reduce((acc: [], pageListResult: CryptoPanicPost[]) => [...acc, ...pageListResult], [])

  const values = posts.reduce((acc, { votes, currencies, title, created_at }: CryptoPanicPost) => {
    const age = Date.now() - Date.parse(created_at)
    acc.ages.push(age)

    currencies.forEach(({ code }) => {
      if (!symbols.includes(code)) return acc

      const weightedVotes = weighVotes(votes)

      if (!acc.symbols[code]) {
        acc.symbols[code] = []
        acc.postWeights[code] = 0
      }
      acc.postWeights[code] += weightedVotes._postWeight
      acc.symbols[code].push({
        _weightedVotes: weightedVotes,
        votes,
        title,
        age
      })
    })

    return acc
  }, {
    ages: [] as number[],
    postWeights: {},
    symbols: {}
  })

  const oldestPost = Math.max(...values.ages)

  const analysis = Object.entries(values.symbols).reduce((acc, [symbol, valueList]: any) => {
    valueList.forEach(value => {
      acc[symbol] += value._weightedVotes._score * (/*(value.age / oldestPost) * */(value._weightedVotes._postWeight / values.postWeights[symbol])) // todo: bug
    })
    return acc
  }, symbols.reduce((acc, symbol) => {
    acc[symbol] = 0
    return acc
  }, {}))

  return {
    analysis,
    values
  }
}