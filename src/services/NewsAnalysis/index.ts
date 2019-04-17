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

const weighVotes = votes => Object.entries(settings.votes.moods).reduce((postAcc, [mood, keyWeights]) => {

  postAcc[mood] = Object.entries(keyWeights).reduce((acc, [key, weight]) => {
    acc[key] = votes[key] * weight
    acc._total += acc[key]
    postAcc._totalMoodVotes += acc[key]
    postAcc._totalVotes += acc[key]
    return acc
  }, postAcc[mood])

  postAcc._postWeight = Object.entries(settings.votes.weights).reduce((acc, [key, weight]) => {
    postAcc._totalVotes += votes[key] * weight
    return acc * Math.pow(weight, votes[key])
  }, 1)

  postAcc._score = postAcc._totalMoodVotes > 0 ? ((1 / 2) * (postAcc.bullish._total - postAcc.bearish._total + postAcc._totalMoodVotes)) / postAcc._totalMoodVotes : 1 / 2

  return postAcc
}, {
  _score: 0.5,
  _postWeight: 0,
  _totalMoodVotes: 0,
  _totalVotes: 0,
  bullish: { _total: 0 },
  bearish: { _total: 0 }
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
      const fetchResult: Response[] = await Promise.all(pages.map(page => request.get(`${fetchLink}&page=${page}`)))
      return fetchResult.reduce((acc: [], result: Response) => [...acc, ...result.body.results], [])
    }
    return new Promise(resolve => setTimeout(() => resolve(newsFetcher()), pages[0] === 1 ? 0 : 1000))
  }))


  const posts = fetchResult.reduce((acc: [], pageListResult: CryptoPanicPost[]) => [...acc, ...pageListResult], [])


  const values = posts.reduce((acc, { votes, currencies, title, published_at }: CryptoPanicPost) => {
    const age = Date.now() - Date.parse(published_at)
    const weightedVotes = weighVotes(votes)

    currencies.forEach(({ code }) => {
      if (!symbols.includes(code)) return acc

      if (!acc.symbols[code]) {
        acc.symbols[code] = []
        acc._totalPostWeight[code] = 0
        acc._totalVotes[code] = 0
        acc._totalAges[code] = 0
      }

      acc._totalPostWeight[code] += weightedVotes._postWeight
      acc._totalVotes[code] += weightedVotes._totalVotes
      acc._totalAges[code] += age

      acc.symbols[code].push({
        title,
        _weightedVotes: weightedVotes,
        age,
      })
    })

    return acc
  }, {
    _totalPostWeight: {},
    _totalVotes: {},
    _totalAges: {},
    symbols: {}
  })


  const analysis = Object.entries(values.symbols).reduce((acc, [symbol, valueList]: any) => {
    valueList.forEach(value => {

      const score = {
        post: value._weightedVotes._score * value._weightedVotes._postWeight / values._totalPostWeight[symbol],
        vote: value._weightedVotes._score * value._weightedVotes._totalVotes / values._totalVotes[symbol],
        ages: value._weightedVotes._score * (values._totalAges[symbol] - value.age) / values._totalAges[symbol]
      }

      acc[symbol] += (score.post + score.vote + score.ages) / values.symbols[symbol].length
    })
    return acc
  }, Object.keys(values.symbols).reduce((acc, symbol) => {
    acc[symbol] = 0 // todo: bug
    return acc
  }, {}))


  return {
    fetchLink,
    analysis,
    values
  }
}