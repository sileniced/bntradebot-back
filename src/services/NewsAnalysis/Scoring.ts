import settings from './settings'

export interface PostAnalysisResult {
  _score: number,
  _postWeight: number,
  _totalMoodVotes: number,
  _totalVotes: number,
  bullish: { _total: number },
  bearish: { _total: number }
}

export default votes => Object.entries(settings.votes.moods).reduce((postAcc, [mood, keyWeights]) => {

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

  postAcc._score = (postAcc.bullish._total / postAcc._totalMoodVotes) - (postAcc.bearish._total / postAcc._totalMoodVotes)
  return postAcc
}, {
  _score: 0,
  _postWeight: 0,
  _totalMoodVotes: 0,
  _totalVotes: 0,
  bullish: { _total: 0 },
  bearish: { _total: 0 }
} as PostAnalysisResult)