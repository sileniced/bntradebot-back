export const calcWeight = (score, weight, optimalScore) => weight + (
  (
    (
      weight * (
        (optimalScore > 0.5 && score > 0.5) || (optimalScore < 0.5 && score < 0.5)
          ? 2 - Math.abs(score - optimalScore)
          : 1 - Math.abs(optimalScore - score)
      )
    ) - weight
  ) * (
    (
      optimalScore > 0.5
        ? (optimalScore - 0.5)
        : (0.5 - optimalScore)
    ) * 2
  )
)

export interface MachineLearningData {
  name: string,
  prevData: {
    w: number
    s: number
  }
}

export const addMachineLearningWeights = (
  prevOptimalScore: number,
  data: MachineLearningData[],
  log: Boolean = false
): [string, number][] => {

  let total = 0
  const newWeights = data.map(row => {
    const newWeight = calcWeight(
      row.prevData.s,
      row.prevData.w,
      prevOptimalScore
    )

    total += newWeight
    return [row.name, newWeight]

  })

  const artifact: [string, number][] = newWeights.map(([name, weight]) => [name, weight / total])

  log && Math.random() > 0.1 && console.table(data.map((period, idx) => ({
    name: period.name,
    prevOptimalScore,
    score: period.prevData.s,
    weight: period.prevData.w,
    newWeight: artifact[idx][1],
    diff: artifact[idx][1] - period.prevData.w
  })))

  return artifact
}

export const addNAIVEWeight = arr => {
  const total = Array(arr.length).fill(arr.length).reduce((acc, num, idx) => acc + (num - idx), 0)
  return arr.map((pattern, idx) => [...pattern, ((arr.length - idx) / total)])
}

export const addEVENWeight = (arr, own: number[] = []) => arr.map((pattern, idx) => [...pattern, own[idx] || 1 / arr.length])