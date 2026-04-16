import { describe, expect, it } from 'vitest'
import type {
  Asset,
  PortfolioPosition,
  Preferences,
  RankedAsset,
} from '../../domain/types'
import { buildRanking } from './buildRanking'

const TEST_ASSETS: Asset[] = [
  {
    ticker: 'ITUB4',
    name: 'Itaú Unibanco',
    type: 'AÇÃO',
    sector: 'Banks',
    price: 35,
    quality: 92,
    growth: 78,
    resilience: 90,
    governance: 88,
  },
  {
    ticker: 'WEGE3',
    name: 'WEG',
    type: 'AÇÃO',
    sector: 'Industrial',
    price: 52,
    quality: 96,
    growth: 92,
    resilience: 86,
    governance: 94,
  },
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística',
    type: 'FII',
    sector: 'Real Estate',
    price: 160,
    dividendYield: 8.6,
    quality: 90,
    growth: 75,
    resilience: 85,
    governance: 89,
  },
]

const DEFAULT_PREFERENCES: Preferences = {
  riskProfile: 'EQUILIBRADO',
  macroScenario: 'NEUTRO',
  preferredTypes: ['AÇÃO', 'FII', 'ETF', 'BDR'],
  blockedTickers: [],
}

function findByTicker(
  ranking: readonly RankedAsset[],
  ticker: string
): RankedAsset | undefined {
  return ranking.find((item: RankedAsset) => item.ticker === ticker)
}

describe('buildRanking', () => {
  it('retorna array vazio quando não há ativos', () => {
    expect(buildRanking([], [], DEFAULT_PREFERENCES)).toEqual([])
  })

  it('retorna um item ranqueado para cada ativo com estrutura válida', () => {
    const ranking = buildRanking(TEST_ASSETS, [], DEFAULT_PREFERENCES)

    expect(ranking).toHaveLength(TEST_ASSETS.length)

    ranking.forEach((item: RankedAsset) => {
      expect(typeof item.ticker).toBe('string')
      expect(typeof item.name).toBe('string')
      expect(typeof item.type).toBe('string')
      expect(typeof item.sector).toBe('string')
      expect(Number.isFinite(item.price)).toBe(true)

      expect(Number.isFinite(item.score.baseScore)).toBe(true)
      expect(Number.isFinite(item.score.preferenceBonus)).toBe(true)
      expect(Number.isFinite(item.score.macroAdjustment)).toBe(true)
      expect(Number.isFinite(item.score.concentrationPenalty)).toBe(true)
      expect(Number.isFinite(item.score.finalScore)).toBe(true)
      expect(Number.isFinite(item.score.weight)).toBe(true)

      expect(Number.isFinite(item.percentile)).toBe(true)
      expect(item.percentile).toBeGreaterThanOrEqual(0)
      expect(item.percentile).toBeLessThanOrEqual(100)

      expect(Number.isFinite(item.currentAllocationPct)).toBe(true)
      expect(item.currentAllocationPct).toBeGreaterThanOrEqual(0)
      expect(item.currentAllocationPct).toBeLessThanOrEqual(100)

      expect(Number.isFinite(item.ownedQuantity)).toBe(true)
      expect(Number.isFinite(item.currentMarketValue)).toBe(true)
      expect(Number.isFinite(item.safeCurrentValue)).toBe(true)
    })
  })

  it('projeta quantidade, valor atual e alocação com base nas posições da carteira', () => {
    const positions: PortfolioPosition[] = [
      {
        ticker: 'ITUB4',
        quantity: 10,
        avgPrice: 30,
        currentPrice: null,
      },
      {
        ticker: 'HGLG11',
        quantity: 2,
        avgPrice: 150,
        currentPrice: null,
      },
    ]

    const ranking = buildRanking(TEST_ASSETS, positions, DEFAULT_PREFERENCES)

    const itub = findByTicker(ranking, 'ITUB4')
    const hglg = findByTicker(ranking, 'HGLG11')
    const wege = findByTicker(ranking, 'WEGE3')

    expect(itub).toBeDefined()
    expect(hglg).toBeDefined()
    expect(wege).toBeDefined()

    expect(itub?.ownedQuantity).toBe(10)
    expect(itub?.currentMarketValue).toBe(350)
    expect(itub?.safeCurrentValue).toBe(350)
    expect(itub?.currentAllocationPct).toBeGreaterThan(0)

    expect(hglg?.ownedQuantity).toBe(2)
    expect(hglg?.currentMarketValue).toBe(320)
    expect(hglg?.safeCurrentValue).toBe(320)
    expect(hglg?.currentAllocationPct).toBeGreaterThan(0)

    expect(wege?.ownedQuantity).toBe(0)
    expect(wege?.currentMarketValue).toBe(0)
    expect(wege?.safeCurrentValue).toBe(0)
    expect(wege?.currentAllocationPct).toBe(0)
  })

  it('aceita preferências completas sem quebrar o cálculo', () => {
    const preferences: Preferences = {
      riskProfile: 'ARROJADO',
      macroScenario: 'CRESCIMENTO',
      preferredTypes: ['AÇÃO'],
      blockedTickers: ['HGLG11'],
    }

    const positions: PortfolioPosition[] = [
      {
        ticker: 'WEGE3',
        quantity: 5,
        avgPrice: 40,
        currentPrice: null,
      },
    ]

    const ranking = buildRanking(TEST_ASSETS, positions, preferences)

    expect(Array.isArray(ranking)).toBe(true)
    expect(ranking.length).toBeGreaterThan(0)

    ranking.forEach((item: RankedAsset) => {
      expect(Number.isFinite(item.score.finalScore)).toBe(true)
      expect(Number.isFinite(item.percentile)).toBe(true)
    })
  })
})