import * as request from 'superagent'
import Scoring from './Scoring'
import { CryptoPanicLink } from '../../constants'
import { Response } from 'superagent'

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

export interface NewsAnalysisResult {
  _scores: {
    [symbol: string]: number
  }
}

export default async (symbols: string[]): Promise<NewsAnalysisResult> => {

  const linkPage: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const fetchResponses: CryptoPanicPost[][] | void = await Promise.all(linkPage.map((page: number) => {
    return new Promise(resolve => setTimeout(() => {
      resolve(request.get(CryptoPanicLink(symbols, page))
      .then((response: Response):CryptoPanicPost[] => response.body.results)
      .catch((error) => {
        console.error(error)
        return error
      }))
    }, Math.floor((page - 1) / 5) * 1000))
  }))

  const posts: CryptoPanicPost[] = fetchResponses.reduce((acc, response: CryptoPanicPost[]) => [...acc, ...response], [])

  const values = posts.reduce((acc, { votes, currencies, /* title, */published_at }: CryptoPanicPost) => {

    currencies.forEach(({ code: symbol }) => {
      if (!symbols.includes(symbol)) return acc

      const age = Date.now() - Date.parse(published_at)
      const weightedVotes = Scoring(votes)

      if (!acc.symbols[symbol]) {
        acc.symbols[symbol] = []
        acc._totalPostWeight[symbol] = 0
        acc._totalVotes[symbol] = 0
        acc._totalAges[symbol] = 0
      }

      acc._totalPostWeight[symbol] += weightedVotes._postWeight
      acc._totalVotes[symbol] += weightedVotes._totalVotes
      acc._totalAges[symbol] += age

      acc.symbols[symbol].push({
        // title,
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
    // values
  }
}