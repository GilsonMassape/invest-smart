import { describe, expect, it } from 'vitest'
import { getScoreWeight } from '../engine/score/getScoreWeight'

const getScoreWeightSafely = getScoreWeight as unknown as (
  score: number,
  currentAllocationPct?: number
) => number

describe('score engine', () => {
  it('aplica pesos nas faixas corretas', () => {
    expect(getScoreWeightSafely(90)).toBeCloseTo(1.43, 10)
    expect(getScoreWeightSafely(80)).toBeCloseTo(1.19, 10)
    expect(getScoreWeightSafely(72)).toBeCloseTo(1.09, 10)
    expect(getScoreWeightSafely(65)).toBeCloseTo(0.98, 10)
    expect(getScoreWeightSafely(50)).toBeCloseTo(0.74, 10)
  })

  it('penaliza concentração excessiva', () => {
    const diversifiedWeight = getScoreWeightSafely(90, 10)
    const concentratedWeight = getScoreWeightSafely(90, 35)

    expect(diversifiedWeight).toBeGreaterThan(concentratedWeight)
    expect(concentratedWeight).toBeGreaterThan(0)
  })
})