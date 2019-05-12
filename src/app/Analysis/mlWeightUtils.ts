export const numShort = num => Math.round(num * 100000)
export const numBig = num => num / 100000

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
    prevOptimalScore > 0.5
      ? (prevOptimalScore - 0.5) / 2
      : (0.5 - prevOptimalScore) / 2
  )
)

export const addCrossMlWeights = (
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
      numBig(period.prevData.w),
      prevOptimalScore
    )

    total += newWeight
    return [period.name, newWeight]
  })

  return newWeights.map(([name, weight]) => [name, weight / total])
}

export const addNAIVEWeight = arr => {
  const total = Array(arr.length).fill(arr.length).reduce((acc, num, idx) => acc + (num - idx), 0)
  return arr.map((pattern, idx) => [...pattern, ((arr.length - idx) / total)])
}

export const addEVENWeight = (arr, own: number[] = []) => arr.map((pattern, idx) => [...pattern, own[idx] || 1 / arr.length])