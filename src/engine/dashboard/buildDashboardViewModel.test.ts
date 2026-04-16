import { describe, expect, it } from 'vitest'
import type { Asset, Decision, PortfolioPosition } from '../../domain/types'
import type { PatrimonyHistory } from '../../domain/history'
import {
  buildDashboardAggregation,
  buildDashboardAssetCatalogMap,
  buildDashboardViewModel,
} from './buildDashboardViewModel'

const TEST_ASSETS: Asset[] = [
  {
    ticker: 'itub4',
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

const TEST_PORTFOLIO: PortfolioPosition[] = [
  {
    ticker: 'ITUB4',
    quantity: 10,
    avgPrice: 30,
    currentPrice: 35,
  },
  {
    ticker: 'HGLG11',
    quantity: 2,
    avgPrice: 150,
    currentPrice: 160,
  },
]

const TEST_DECISIONS: Decision[] = [
  {
    ticker: 'WEGE3',
    action: 'COMPRAR_FORTE',
    confidence: 'ALTA',
    reason: 'Melhor assimetria do ranking.',
  },
  {
    ticker: 'ITUB4',
    action: 'REDUZIR',
    confidence: 'MÉDIA',
    reason: 'Concentração elevada.',
  },
  {
    ticker: 'HASH11',
    action: 'EVITAR',
    confidence: 'BAIXA',
    reason: 'Baixa atratividade no cenário atual.',
  },
]

const TEST_HISTORY: PatrimonyHistory = [
  {
    timestamp: 1700000000000,
    total: 600,
  },
  {
    timestamp: 1700086400000,
    total: 670,
  },
]

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDistributionPointArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const candidate = item as {
        value?: unknown
        type?: unknown
        ticker?: unknown
        name?: unknown
        label?: unknown
      }

      const hasIdentity =
        isString(candidate.type) ||
        isString(candidate.ticker) ||
        isString(candidate.name) ||
        isString(candidate.label)

      return hasIdentity && isNumeric(candidate.value)
    })
  )
}

function isMetricPointArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const candidate = item as {
        name?: unknown
        value?: unknown
        benchmarkValue?: unknown
      }

      const benchmarkIsValid =
        typeof candidate.benchmarkValue === 'undefined' ||
        isNumeric(candidate.benchmarkValue)

      return (
        isString(candidate.name) &&
        isNumeric(candidate.value) &&
        benchmarkIsValid
      )
    })
  )
}

describe('buildDashboardAssetCatalogMap', () => {
  it('cria mapa com tickers normalizados em caixa alta', () => {
    const catalog = buildDashboardAssetCatalogMap(TEST_ASSETS)

    expect(catalog).toBeInstanceOf(Map)
    expect(catalog.get('ITUB4')).toEqual(TEST_ASSETS[0])
    expect(catalog.get('WEGE3')).toEqual(TEST_ASSETS[1])
    expect(catalog.get('HGLG11')).toEqual(TEST_ASSETS[2])
  })

  it('retorna mapa vazio quando não há ativos', () => {
    const catalog = buildDashboardAssetCatalogMap([])

    expect(catalog).toBeInstanceOf(Map)
    expect(catalog.size).toBe(0)
  })
})

describe('buildDashboardAggregation', () => {
  it('agrega patrimônio, investido e distribuições da carteira', () => {
    const catalog = buildDashboardAssetCatalogMap(TEST_ASSETS)
    const aggregation = buildDashboardAggregation(TEST_PORTFOLIO, catalog)

    expect(isNumeric((aggregation as { totalInvested?: unknown }).totalInvested)).toBe(
      true
    )
    expect(
      isNumeric((aggregation as { totalPatrimony?: unknown }).totalPatrimony)
    ).toBe(true)

    expect((aggregation as { totalInvested: number }).totalInvested).toBe(600)
    expect((aggregation as { totalPatrimony: number }).totalPatrimony).toBe(670)

    expect(
      isDistributionPointArray(
        (aggregation as { distributionByType?: unknown }).distributionByType
      )
    ).toBe(true)

    expect(
      isDistributionPointArray(
        (aggregation as { distributionByAsset?: unknown }).distributionByAsset
      )
    ).toBe(true)

    expect(
      isDistributionPointArray(
        (aggregation as { concentrationData?: unknown }).concentrationData
      )
    ).toBe(true)

    expect(
      (aggregation as { distributionByType: unknown[] }).distributionByType.length
    ).toBeGreaterThan(0)

    expect(
      (aggregation as { distributionByAsset: unknown[] }).distributionByAsset.length
    ).toBeGreaterThan(0)

    expect(
      (aggregation as { concentrationData: unknown[] }).concentrationData.length
    ).toBeGreaterThan(0)
  })

  it('retorna agregação zerada para carteira vazia', () => {
    const catalog = buildDashboardAssetCatalogMap(TEST_ASSETS)
    const aggregation = buildDashboardAggregation([], catalog)

    expect((aggregation as { totalInvested: number }).totalInvested).toBe(0)
    expect((aggregation as { totalPatrimony: number }).totalPatrimony).toBe(0)
    expect((aggregation as { distributionByType: unknown[] }).distributionByType).toEqual([])
    expect((aggregation as { distributionByAsset: unknown[] }).distributionByAsset).toEqual([])
    expect((aggregation as { concentrationData: unknown[] }).concentrationData).toEqual([])
  })
})

describe('buildDashboardViewModel', () => {
  it('monta o view model completo com métricas, evolução e insights', () => {
    const catalog = buildDashboardAssetCatalogMap(TEST_ASSETS)
    const aggregation = buildDashboardAggregation(TEST_PORTFOLIO, catalog)

    const dashboard = buildDashboardViewModel({
      monthlyContribution: 2000,
      rankedCount: 3,
      decision: TEST_DECISIONS,
      patrimonyHistory: TEST_HISTORY,
      aggregation,
    })

    expect((dashboard as { totalPatrimony: number }).totalPatrimony).toBe(670)
    expect((dashboard as { monthlyContribution: number }).monthlyContribution).toBe(
      2000
    )
    expect((dashboard as { rankedCount: number }).rankedCount).toBe(3)

    expect(
      isDistributionPointArray(
        (dashboard as { distributionByType?: unknown }).distributionByType
      )
    ).toBe(true)

    expect(
      isDistributionPointArray(
        (dashboard as { distributionByAsset?: unknown }).distributionByAsset
      )
    ).toBe(true)

    expect(
      isDistributionPointArray(
        (dashboard as { concentrationData?: unknown }).concentrationData
      )
    ).toBe(true)

    expect(
      isMetricPointArray(
        (dashboard as { performanceData?: unknown }).performanceData
      )
    ).toBe(true)

    expect(
      isMetricPointArray(
        (dashboard as { evolutionData?: unknown }).evolutionData
      )
    ).toBe(true)

    expect(Array.isArray((dashboard as { insights?: unknown }).insights)).toBe(true)
  })

  it('mantém estrutura válida mesmo sem histórico e sem decisões', () => {
    const catalog = buildDashboardAssetCatalogMap(TEST_ASSETS)
    const aggregation = buildDashboardAggregation(TEST_PORTFOLIO, catalog)

    const dashboard = buildDashboardViewModel({
      monthlyContribution: 0,
      rankedCount: 0,
      decision: [],
      patrimonyHistory: [],
      aggregation,
    })

    expect((dashboard as { totalPatrimony: number }).totalPatrimony).toBe(670)
    expect((dashboard as { monthlyContribution: number }).monthlyContribution).toBe(
      0
    )
    expect((dashboard as { rankedCount: number }).rankedCount).toBe(0)

    expect(
      isMetricPointArray(
        (dashboard as { performanceData?: unknown }).performanceData
      )
    ).toBe(true)

    expect(
      isMetricPointArray(
        (dashboard as { evolutionData?: unknown }).evolutionData
      )
    ).toBe(true)

    expect(Array.isArray((dashboard as { insights?: unknown }).insights)).toBe(true)
  })
})