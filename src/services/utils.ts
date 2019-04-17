export const addNAÏVEWeight = arr => {
  const total = Array(arr.length).fill(arr.length).reduce((acc, num, idx) => acc + (num - idx), 0)
  return arr.map((pattern, idx) => [...pattern, ((arr.length - idx) / total)])
}

export const addEVENWeight = (arr, own: number[] = []) => arr.map((pattern, idx) => [...pattern, own[idx] || 1 / arr.length])
export const addScores = scores => Object.values(scores).reduce((acc, { _score }) => acc + _score, 0)

export const symbolToPairs = (symbolScores, pairs) => Object.entries(symbolScores).reduce((acc, [symbol, symbolScore]: [string, number]) => {
  Object.keys(acc).forEach(pair => {
    const idx = pair.indexOf(symbol)
    if (idx !== -1) {
      acc[pair] += ((idx === 0) ? symbolScore : -symbolScore) / 2
    }
  })
  return acc
}, pairs.reduce((acc, pair) => {
  acc[pair] = 0.5
  return acc
}, {}))