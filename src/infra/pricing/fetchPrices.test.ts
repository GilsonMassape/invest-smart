import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockQuote = {
  symbol?: string
  regularMarketPrice?: number
  close?: number
  previousClose?: number
}

type MockResponsePayload = {
  results?: MockQuote[]
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

function createJsonResponse(
  payload: MockResponsePayload,
  options?: {
    ok?: boolean
    status?: number
  }
): Response {
  const ok = options?.ok ?? true
  const status = options?.status ?? (ok ? 200 : 500)

  return {
    ok,
    status,
    json: async () => payload,
  } as Response
}

function extractRequestedTickersFromUrl(rawUrl: string): string[] {
  const url = new URL(rawUrl)
  const quotePrefix = '/api/quote/'
  const path = url.pathname
  const tickersChunk = path.startsWith(quotePrefix)
    ? path.slice(quotePrefix.length)
    : ''

  return tickersChunk
    .split(',')
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean)
}

describe('infra/pricing/fetchPrices', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
    })
  })

  it('retorna vazio quando não há tickers válidos', async () => {
    const { fetchPrices } = await import('./fetchPrices')

    const result = await fetchPrices(['', '   '])

    expect(result).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normaliza, remove duplicados e busca preços válidos', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        results: [
          { symbol: 'ITUB4', regularMarketPrice: 35.12 },
          { symbol: 'WEGE3', regularMarketPrice: 52.44 },
        ],
      })
    )

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices([' itub4 ', 'ITUB4', 'wege3'])

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(extractRequestedTickersFromUrl(calledUrl)).toEqual(['ITUB4', 'WEGE3'])

    expect(result).toEqual({
      ITUB4: 35.12,
      WEGE3: 52.44,
    })
  })

  it('usa close como fallback quando regularMarketPrice não existe', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        results: [{ symbol: 'ITUB4', close: 34.77 }],
      })
    )

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices(['ITUB4'])

    expect(result).toEqual({
      ITUB4: 34.77,
    })
  })

  it('usa previousClose como último fallback de preço', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        results: [{ symbol: 'ITUB4', previousClose: 33.91 }],
      })
    )

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices(['ITUB4'])

    expect(result).toEqual({
      ITUB4: 33.91,
    })
  })

  it('retorna null para ticker solicitado sem preço válido no payload', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        results: [{ symbol: 'ITUB4' }],
      })
    )

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices(['ITUB4', 'WEGE3'])

    expect(result).toEqual({
      ITUB4: null,
      WEGE3: null,
    })
  })

  it('ignora símbolos não solicitados no retorno da API', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        results: [
          { symbol: 'ITUB4', regularMarketPrice: 35.12 },
          { symbol: 'ABCD1', regularMarketPrice: 99.99 },
        ],
      })
    )

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices(['ITUB4'])

    expect(result).toEqual({
      ITUB4: 35.12,
    })
  })

  it('divide a busca em lotes de até 20 tickers', async () => {
    const tickers = Array.from({ length: 21 }, (_, index) => `TKR${index + 1}`)

    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          results: tickers.slice(0, 20).map((ticker, index) => ({
            symbol: ticker,
            regularMarketPrice: index + 1,
          })),
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          results: [{ symbol: 'TKR21', regularMarketPrice: 21 }],
        })
      )

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices(tickers)

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    const secondUrl = String(fetchMock.mock.calls[1]?.[0] ?? '')

    expect(extractRequestedTickersFromUrl(firstUrl)).toHaveLength(20)
    expect(extractRequestedTickersFromUrl(secondUrl)).toEqual(['TKR21'])

    expect(result.TKR1).toBe(1)
    expect(result.TKR20).toBe(20)
    expect(result.TKR21).toBe(21)
  })

  it('retorna mapa vazio com nulls quando a resposta HTTP falha', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({}, { ok: false, status: 500 })
    )

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices(['ITUB4', 'WEGE3'])

    expect(result).toEqual({
      ITUB4: null,
      WEGE3: null,
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('retorna mapa vazio com nulls quando fetch lança erro', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'))

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { fetchPrices } = await import('./fetchPrices')
    const result = await fetchPrices(['ITUB4'])

    expect(result).toEqual({
      ITUB4: null,
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})