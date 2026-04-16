export type PriceValue = number | null

export type PriceMap = Record<string, PriceValue>

type BrapiQuoteResult = Readonly<{
  symbol?: string
  regularMarketPrice?: number
  close?: number
  previousClose?: number
}>

type BrapiResponse = Readonly<{
  results?: BrapiQuoteResult[]
}>

const BRAPI_BASE_URL = 'https://brapi.dev/api/quote'
const REQUEST_TIMEOUT_MS = 8000
const MAX_TICKERS_PER_REQUEST = 20

function toSafeNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function uniqueTickers(tickers: readonly string[]): string[] {
  return Array.from(
    new Set(
      tickers
        .map(normalizeTicker)
        .filter((ticker) => ticker.length > 0)
    )
  )
}

function buildEmptyPriceMap(tickers: readonly string[]): PriceMap {
  return uniqueTickers(tickers).reduce<PriceMap>((accumulator, ticker) => {
    accumulator[ticker] = null
    return accumulator
  }, {})
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    return [Array.from(items)]
  }

  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function resolveBrapiToken(): string | null {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const token = env?.VITE_BRAPI_TOKEN

  return typeof token === 'string' && token.trim().length > 0
    ? token.trim()
    : null
}

function buildBrapiUrl(tickers: readonly string[]): string {
  const query = new URLSearchParams({
    fundamental: 'false',
    dividends: 'false',
  })

  const token = resolveBrapiToken()

  if (token) {
    query.set('token', token)
  }

  return `${BRAPI_BASE_URL}/${tickers.join(',')}?${query.toString()}`
}

function extractQuotePrice(result: BrapiQuoteResult): number | null {
  return (
    toSafeNumber(result.regularMarketPrice) ??
    toSafeNumber(result.close) ??
    toSafeNumber(result.previousClose)
  )
}

function parseBrapiResponse(
  requestedTickers: readonly string[],
  payload: unknown
): PriceMap {
  const requestedMap = buildEmptyPriceMap(requestedTickers)

  if (!payload || typeof payload !== 'object') {
    return requestedMap
  }

  const response = payload as BrapiResponse
  const results = Array.isArray(response.results) ? response.results : []

  for (const result of results) {
    const symbol =
      typeof result.symbol === 'string'
        ? normalizeTicker(result.symbol)
        : null

    if (!symbol || !(symbol in requestedMap)) {
      continue
    }

    requestedMap[symbol] = extractQuotePrice(result)
  }

  return requestedMap
}

function createAbortSignal(timeoutMs: number): {
  signal: AbortSignal
  clear: () => void
} {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  return {
    signal: controller.signal,
    clear: () => globalThis.clearTimeout(timeoutId),
  }
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number
): Promise<unknown> {
  const { signal, clear } = createAbortSignal(timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    })

    if (!response.ok) {
      throw new Error(`Price request failed with status ${response.status}`)
    }

    return await response.json()
  } finally {
    clear()
  }
}

async function fetchBrapiBatch(tickers: readonly string[]): Promise<PriceMap> {
  if (tickers.length === 0) {
    return {}
  }

  const url = buildBrapiUrl(tickers)
  const payload = await fetchJsonWithTimeout(url, REQUEST_TIMEOUT_MS)

  return parseBrapiResponse(tickers, payload)
}

function mergePriceMaps(priceMaps: readonly PriceMap[]): PriceMap {
  return priceMaps.reduce<PriceMap>((accumulator, current) => {
    for (const [ticker, price] of Object.entries(current)) {
      accumulator[ticker] = price
    }

    return accumulator
  }, {})
}

export async function fetchPrices(
  tickers: readonly string[]
): Promise<PriceMap> {
  const normalizedTickers = uniqueTickers(tickers)

  if (normalizedTickers.length === 0) {
    return {}
  }

  const batches = chunkArray(normalizedTickers, MAX_TICKERS_PER_REQUEST)

  try {
    const responses = await Promise.all(
      batches.map((batch) => fetchBrapiBatch(batch))
    )

    return mergePriceMaps(responses)
  } catch (error) {
    console.error('❌ erro ao buscar preços em infra/pricing/fetchPrices', error)
    return buildEmptyPriceMap(normalizedTickers)
  }
}