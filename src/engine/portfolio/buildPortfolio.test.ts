import { describe, expect, it } from 'vitest'
import type { Asset, PortfolioPosition } from '../../domain/types'
import {
  buildPortfolio,
  buildPortfolioAssetMap,
  calculateTotalInvested,
} from './buildPortfolio'

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

describe('buildPortfolioAssetMap', () => {
  it('cria mapa com tickers normalizados', () => {
    const assetMap = buildPortfolioAssetMap([
      {
        ...TEST_ASSETS[0],
        ticker: 'itub4',
      },
      TEST_ASSETS[1],
    ])

    expect(assetMap.get('ITUB4')).toEqual({
      ...TEST_ASSETS[0],
      ticker: 'itub4',
    })
    expect(assetMap.get('HGLG11')).toEqual(TEST_ASSETS[1])
  })

  it('retorna Map vazio quando recebe lista vazia', () => {
    const assetMap = buildPortfolioAssetMap([])

    expect(assetMap).toBeInstanceOf(Map)
    expect(assetMap.size).toBe(0)
  })
})

describe('buildPortfolio', () => {
  it('retorna vazio quando não há posições', () => {
    const assetMap = buildPortfolioAssetMap(TEST_ASSETS)

    expect(buildPortfolio([], assetMap)).toEqual([])
  })

  it('monta carteira usando preço do ativo quando o ticker existe no catálogo', () => {
    const positions: PortfolioPosition[] = [
      {
        ticker: 'ITUB4',
        quantity: 10,
        avgPrice: 30,
        currentPrice: 32,
      },
    ]

    const assetMap = buildPortfolioAssetMap(TEST_ASSETS)
    const portfolio = buildPortfolio(positions, assetMap)

    expect(portfolio).toHaveLength(1)
    expect(portfolio[0]).toMatchObject({
      ticker: 'ITUB4',
      name: 'Itaú Unibanco',
      type: 'AÇÃO',
      sector: 'Banks',
      price: 35,
      marketPrice: 35,
      marketValue: 350,
      profit: 50,
      allocationPct: 100,
    })
  })

  it('usa currentPrice da posição quando o ativo não existe no catálogo', () => {
    const positions: PortfolioPosition[] = [
      {
        ticker: 'ABCD1',
        quantity: 5,
        avgPrice: 20,
        currentPrice: 25,
      },
    ]

    const assetMap = buildPortfolioAssetMap(TEST_ASSETS)
    const portfolio = buildPortfolio(positions, assetMap)

    expect(portfolio[0]).toMatchObject({
      ticker: 'ABCD1',
      name: 'ABCD1',
      type: 'AÇÃO',
      sector: 'N/A',
      price: 25,
      marketPrice: 25,
      marketValue: 125,
      profit: 25,
      allocationPct: 100,
    })
  })

  it('usa avgPrice quando não há ativo mapeado nem currentPrice válido', () => {
    const positions: PortfolioPosition[] = [
      {
        ticker: 'ABCD1',
        quantity: 2,
        avgPrice: 40,
        currentPrice: null,
      },
    ]

    const assetMap = buildPortfolioAssetMap(TEST_ASSETS)
    const portfolio = buildPortfolio(positions, assetMap)

    expect(portfolio[0]).toMatchObject({
      price: 40,
      marketPrice: 40,
      marketValue: 80,
      profit: 0,
      allocationPct: 100,
    })
  })

  it('calcula allocationPct proporcionalmente entre múltiplos ativos', () => {
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

    const assetMap = buildPortfolioAssetMap(TEST_ASSETS)
    const portfolio = buildPortfolio(positions, assetMap)

    expect(portfolio).toHaveLength(2)
    expect(portfolio[0].marketValue).toBe(350)
    expect(portfolio[1].marketValue).toBe(320)
    expect(portfolio[0].allocationPct).toBeCloseTo(52.2388, 4)
    expect(portfolio[1].allocationPct).toBeCloseTo(47.7612, 4)
  })

  it('normaliza valores inválidos para zero', () => {
    const positions: PortfolioPosition[] = [
      {
        ticker: 'ITUB4',
        quantity: Number.NaN,
        avgPrice: Number.NaN,
        currentPrice: Number.NaN,
      },
    ]

    const assetMap = buildPortfolioAssetMap(TEST_ASSETS)
    const portfolio = buildPortfolio(positions, assetMap)

    expect(portfolio[0]).toMatchObject({
      price: 35,
      marketPrice: 35,
      marketValue: 0,
      profit: 0,
      allocationPct: 0,
    })
  })
})

describe('calculateTotalInvested', () => {
  it('retorna zero quando não há posições', () => {
    expect(calculateTotalInvested([])).toBe(0)
  })

  it('soma quantidade × preço médio de todas as posições', () => {
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

    expect(calculateTotalInvested(positions)).toBe(600)
  })

  it('ignora valores inválidos convertendo para zero', () => {
    const positions: PortfolioPosition[] = [
      {
        ticker: 'ITUB4',
        quantity: Number.NaN,
        avgPrice: 30,
        currentPrice: null,
      },
      {
        ticker: 'HGLG11',
        quantity: 2,
        avgPrice: Number.NaN,
        currentPrice: null,
      },
    ]

    expect(calculateTotalInvested(positions)).toBe(0)
  })
})