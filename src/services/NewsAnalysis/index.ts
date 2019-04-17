import * as request from 'superagent'
import { Response } from 'superagent'
import Scoring from './Scoring'
import { CryptoPanicLink } from '../../constants'

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

export default async (symbols: string[]) => {

  const linkPage: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const fetchResponses: Response[] | void = await Promise.all(linkPage.map((page: number) => {
    return new Promise(resolve => setTimeout(() => {
      resolve(request.get(CryptoPanicLink(symbols, page)))
    }, Math.floor((page - 1) / 5) * 1000))
  }))

  const posts: CryptoPanicPost[] = fetchResponses.reduce((acc, response: Response) => [...acc, ...response.body.results], [])

  const values = posts.reduce((acc, { votes, currencies, title, published_at }: CryptoPanicPost) => {
    const age = Date.now() - Date.parse(published_at)
    const weightedVotes = Scoring(votes)

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


  const symbolScores = Object.entries(values.symbols).reduce((acc, [symbol, valueList]: any) => {
    valueList.forEach(value => {

      const score = {
        post: value._weightedVotes._score * value._weightedVotes._postWeight / values._totalPostWeight[symbol],
        vote: value._weightedVotes._score * value._weightedVotes._totalVotes / values._totalVotes[symbol],
        ages: value._weightedVotes._score * (values._totalAges[symbol] - value.age) / values._totalAges[symbol]
      }

      acc[symbol] += (score.post + score.vote + score.ages) / values.symbols[symbol].length
    })
    return acc
  }, symbols.reduce((acc, symbol) => {
    acc[symbol] = 0
    return acc
  }, {}))


  return {
    _scores: symbolScores,
    values
  }
}