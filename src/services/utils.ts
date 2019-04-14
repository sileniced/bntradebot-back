export const addNAÏVEWeight = arr => {
  const total = Array(arr.length).fill(arr.length).reduce((acc, num, idx) => acc + (num - idx), 0)
  return arr.map((pattern, idx) => [...pattern, ((arr.length - idx) / total)])
}

export const addEVENWeight = (arr, own: number[] = []) => arr.map((pattern, idx) => [...pattern, own[idx] || 1 / arr.length])
export const addScores = scores => Object.values(scores).reduce((acc, { _score }) => acc + _score, 0)