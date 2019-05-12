export const calcWeight = (prevScore, prevWeight, prevOptimalScore) => prevWeight + (
  (
    (
      prevWeight * (
        (prevOptimalScore > 0.5 && prevScore > 0.5) || (prevOptimalScore < 0.5 && prevScore < 0.5)
          ? 2 - Math.abs(prevScore - prevOptimalScore)
          : 1 - Math.abs(prevOptimalScore - prevScore)
      )
    ) - prevWeight
  ) * (
    (
      prevOptimalScore > 0.5
        ? (prevOptimalScore - 0.5)
        : (0.5 - prevOptimalScore)
    ) / 2
  )
)

export const addMachineLearningWeights = (
  prevOptimalScore: number,
  periodsArr: {
    name: string,
    prevData: {
      w: number
      s: number
    }
  }[]
) => {

  let total = 0
  const newWeights = periodsArr.map(period => {
    const newWeight = calcWeight(
      period.prevData.s,
      period.prevData.w,
      prevOptimalScore
    )

    total += newWeight
    return [period.name, newWeight]
  })

  const artifact = newWeights.map(([name, weight]) => [name, weight / total])

  Math.random() > 0.985 && console.table(periodsArr.map((period, idx) => ({
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