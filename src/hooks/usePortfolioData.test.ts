// @vitest-environment jsdom

import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePortfolioData } from './usePortfolioData'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

const mocks = vi.hoisted(() => ({
  fetchPrices: vi.fn(),
}))

vi.mock('../services/priceService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../services/priceService')>()

  const defaultExport =
    actual && typeof actual === 'object' && 'default' in actual
      ? (actual.default ?? {})
      : {}

  return {
    ...actual,
    getPrices: mocks.fetchPrices,
    loadPrices: mocks.fetchPrices,
    fetchPrices: mocks.fetchPrices,
    getLatestPrices: mocks.fetchPrices,
    resolvePrices: mocks.fetchPrices,
    default: {
      ...(typeof defaultExport === 'object' && defaultExport !== null
        ? defaultExport
        : {}),
      getPrices: mocks.fetchPrices,
      loadPrices: mocks.fetchPrices,
      fetchPrices: mocks.fetchPrices,
      getLatestPrices: mocks.fetchPrices,
      resolvePrices: mocks.fetchPrices,
    },
  }
})

type HookRenderResult<T> = {
  current: T
}

type TestPosition = {
  ticker: string
  quantity: number
  avgPrice: number
  currentPrice: number | null
}

type TestState = {
  positions: TestPosition[]
  preferences: {
    riskProfile: 'EQUILIBRADO'
    macroScenario: 'NEUTRO'
  }
}

function createState(positions: TestPosition[] = []): TestState {
  return {
    positions,
    preferences: {
      riskProfile: 'EQUILIBRADO',
      macroScenario: 'NEUTRO',
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(
  assertion: () => void,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 2000
  const interval = options?.interval ?? 20
  const startedAt = Date.now()

  while (true) {
    try {
      assertion()
      return
    } catch (error) {
      if (Date.now() - startedAt >= timeout) {
        throw error
      }

      await sleep(interval)
    }
  }
}

function renderUsePortfolioData(state: TestState): {
  result: HookRenderResult<ReturnType<typeof usePortfolioData>>
  unmount: () => void
} {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const root: Root = createRoot(container)
  const result =
    {} as HookRenderResult<ReturnType<typeof usePortfolioData>>

  function TestComponent(): null {
    result.current = usePortfolioData(state)
    return null
  }

  act(() => {
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount()
      })

      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    },
  }
}

function getTickerPrice(result: ReturnType<typeof usePortfolioData>, ticker: string) {
  const portfolioItem = result.portfolio?.find((item: any) => item.ticker === ticker)

  if (typeof portfolioItem?.marketPrice === 'number') {
    return portfolioItem.marketPrice
  }

  if (typeof portfolioItem?.price === 'number') {
    return portfolioItem.price
  }

  const rankingItem = result.ranking?.find((item: any) => item.ticker === ticker)

  if (typeof rankingItem?.price === 'number') {
    return rankingItem.price
  }

  return undefined
}

describe('usePortfolioData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('retorna estado base com preços fallback quando não há posições', () => {
    mocks.fetchPrices.mockResolvedValue({})

    const state = createState()
    const rendered = renderUsePortfolioData(state)

    try {
      expect(rendered.result.current.portfolio).toEqual([])
      expect(rendered.result.current.totalInvested).toBe(0)
      expect(rendered.result.current.priceStatus).toBe('idle')
      expect(rendered.result.current.priceError).toBeNull()
      expect(rendered.result.current.lastPriceUpdateAt).toBeNull()
      expect(mocks.fetchPrices).not.toHaveBeenCalled()
    } finally {
      rendered.unmount()
    }
  })

  it('carrega preços e recalcula portfolio e ranking com preço dinâmico', async () => {
    mocks.fetchPrices.mockResolvedValue({
      ITUB4: 40,
      WEGE3: 60,
    })

    const state = createState([
      {
        ticker: 'ITUB4',
        quantity: 10,
        avgPrice: 30,
        currentPrice: null,
      },
    ])

    const rendered = renderUsePortfolioData(state)

    try {
      await waitFor(() => {
        expect(rendered.result.current.priceStatus).toBe('success')
      })

      expect(mocks.fetchPrices).toHaveBeenCalledWith(['ITUB4'])
      expect(rendered.result.current.lastPriceUpdateAt).not.toBeNull()
      expect(rendered.result.current.priceError).toBeNull()
      expect(getTickerPrice(rendered.result.current, 'ITUB4')).toBe(40)
    } finally {
      rendered.unmount()
    }
  })

  it('mantém fallback e expõe erro quando a atualização falha sem histórico prévio', async () => {
    mocks.fetchPrices.mockRejectedValue(new Error('network error'))

    const state = createState([
      {
        ticker: 'ITUB4',
        quantity: 10,
        avgPrice: 30,
        currentPrice: null,
      },
    ])

    const rendered = renderUsePortfolioData(state)

    try {
      await waitFor(() => {
        expect(rendered.result.current.priceStatus).toBe('error')
      })

      expect(rendered.result.current.priceError).toBe('network error')
      expect(getTickerPrice(rendered.result.current, 'ITUB4')).toBeGreaterThan(0)
    } finally {
      rendered.unmount()
    }
  })

  it('preserva status success quando refresh posterior falha após sucesso inicial', async () => {
    mocks.fetchPrices
      .mockResolvedValueOnce({ ITUB4: 41 })
      .mockRejectedValueOnce(new Error('temporary error'))

    const state = createState([
      {
        ticker: 'ITUB4',
        quantity: 10,
        avgPrice: 30,
        currentPrice: null,
      },
    ])

    const rendered = renderUsePortfolioData(state)

    try {
      await waitFor(() => {
        expect(rendered.result.current.priceStatus).toBe('success')
      })

      await act(async () => {
        await rendered.result.current.refreshPrices()
      })

      expect(rendered.result.current.priceStatus).toBe('success')
      expect(rendered.result.current.priceError).toBe('temporary error')
      expect(getTickerPrice(rendered.result.current, 'ITUB4')).toBe(41)
    } finally {
      rendered.unmount()
    }
  })

  it('exibe erro quando nenhum preço válido é retornado', async () => {
    mocks.fetchPrices.mockResolvedValue({ ITUB4: null })

    const state = createState([
      {
        ticker: 'ITUB4',
        quantity: 10,
        avgPrice: 30,
        currentPrice: null,
      },
    ])

    const rendered = renderUsePortfolioData(state)

    try {
      await waitFor(() => {
        expect(rendered.result.current.priceStatus).toBe('error')
      })

      expect(rendered.result.current.priceError).toBe(
        'Nenhum preço válido retornado.'
      )
    } finally {
      rendered.unmount()
    }
  })

  it('refreshPrices pode ser chamado manualmente', async () => {
    mocks.fetchPrices
      .mockResolvedValueOnce({ ITUB4: 40 })
      .mockResolvedValueOnce({ ITUB4: 42 })

    const state = createState([
      {
        ticker: 'ITUB4',
        quantity: 10,
        avgPrice: 30,
        currentPrice: null,
      },
    ])

    const rendered = renderUsePortfolioData(state)

    try {
      await waitFor(() => {
        expect(rendered.result.current.priceStatus).toBe('success')
      })

      await act(async () => {
        await rendered.result.current.refreshPrices()
      })

      expect(getTickerPrice(rendered.result.current, 'ITUB4')).toBe(42)
      expect(mocks.fetchPrices).toHaveBeenCalledTimes(2)
    } finally {
      rendered.unmount()
    }
  })

  it('gera alertas de concentração a partir do rebalance', async () => {
    mocks.fetchPrices.mockResolvedValue({ ITUB4: 40 })

    const state = createState([
      {
        ticker: 'ITUB4',
        quantity: 100,
        avgPrice: 30,
        currentPrice: null,
      },
    ])

    const rendered = renderUsePortfolioData(state)

    try {
      await waitFor(() => {
        expect(rendered.result.current.priceStatus).toBe('success')
      })

      expect(Array.isArray(rendered.result.current.alerts)).toBe(true)
      expect(
        rendered.result.current.alerts.some((item: string) =>
          /concentra/i.test(item)
        )
      ).toBe(true)
    } finally {
      rendered.unmount()
    }
  })
})