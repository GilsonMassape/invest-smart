export type MarketPriceMap = Record<string, number>

export type FetchPricesOptions = Readonly<{
  ttlMs?: number
  forceRefresh?: boolean
}>

type ApiPriceValue =
  | number
  | null
  | {
      price?: number | null
      currentPrice?: number | null
      close?: number | null
      last?: number | null
      value?: number | null
      regularMarketPrice?: number | null
      c?: number | null
    }

type ApiPriceMap = Record<string, ApiPriceValue>

const CACHE_TTL_MS = 1000 * 60 * 5
const API_PRICES_ENDPOINT = '/api/prices'

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

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readNestedPrice(value: Record<string, unknown>): number | null {
  const candidates = [
    value.price,
    value.currentPrice,
    value.close,
    value.last,
    value.value,
    value.regularMarketPrice,
    value.c,
  ]

  for (const candidate of candidates) {
    const safeNumber = toPositiveNumber(candidate)

    if (safeNumber !== null) {
      return safeNumber
    }
  }

  return null
}

function filterValidPrices(
  prices: ApiPriceMap | MarketPriceMap | Record<string, unknown>
): MarketPriceMap {
  const marketPrices: MarketPriceMap = {}

  for (const [ticker, value] of Object.entries(prices)) {
    const directPrice = toPositiveNumber(value)

    if (directPrice !== null) {
      marketPrices[normalizeTicker(ticker)] = directPrice
      continue
    }

    if (value && typeof value === 'object') {
      const nestedPrice = readNestedPrice(value as Record<string, unknown>)

      if (nestedPrice !== null) {
        marketPrices[normalizeTicker(ticker)] = nestedPrice
      }
    }
  }

  return marketPrices
}

function mergePriceMaps(
  primary: MarketPriceMap,
  secondary: MarketPriceMap
): MarketPriceMap {
  return {
    ...secondary,
    ...primary,
  }
}

function buildStorageKey(ticker: string): string {
  return `invest-smart.price-cache.${normalizeTicker(ticker)}`
}

function getNow(): number {
  return Date.now()
}

function loadCachedPrice(
  ticker: string,
  ttlMs: number
): number | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(ticker))

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as {
      value?: unknown
      updatedAt?: unknown
    }

    const value = toPositiveNumber(parsed.value)
    const updatedAt = Number(parsed.updatedAt)

    if (value === null || !Number.isFinite(updatedAt) || updatedAt <= 0) {
      return null
    }

    if (getNow() - updatedAt > ttlMs) {
      return null
    }

    return value
  } catch {
    return null
  }
}

function getCachedPrices(
  tickers: readonly string[],
  ttlMs: number
): MarketPriceMap {
  const cachedPrices: MarketPriceMap = {}

  for (const ticker of tickers) {
    const cachedPrice = loadCachedPrice(ticker, ttlMs)

    if (cachedPrice !== null) {
      cachedPrices[normalizeTicker(ticker)] = cachedPrice
    }
  }

  return cachedPrices
}

function getMissingTickers(
  tickers: readonly string[],
  ttlMs: number
): string[] {
  return tickers.filter((ticker) => loadCachedPrice(ticker, ttlMs) === null)
}

function savePricesToCache(prices: MarketPriceMap): void {
  if (typeof window === 'undefined') {
    return
  }

  const updatedAt = getNow()

  for (const [ticker, value] of Object.entries(prices)) {
    const safePrice = toPositiveNumber(value)

    if (safePrice === null) {
      continue
    }

    try {
      window.localStorage.setItem(
        buildStorageKey(ticker),
        JSON.stringify({
          value: safePrice,
          updatedAt,
        })
      )
    } catch {
      // noop
    }
  }
}

function resolveTickersToFetch(params: {
  normalizedTickers: string[]
  ttlMs: number
  forceRefresh: boolean
}): string[] {
  const { normalizedTickers, ttlMs, forceRefresh } = params

  if (forceRefresh) {
    return normalizedTickers
  }

  return getMissingTickers(normalizedTickers, ttlMs).map(normalizeTicker)
}

function loadCachedPrices(
  normalizedTickers: string[],
  ttlMs: number,
  forceRefresh: boolean
): MarketPriceMap {
  if (forceRefresh) {
    return {}
  }

  return getCachedPrices(normalizedTickers, ttlMs)
}

function buildApiUrl(tickers: readonly string[]): string {
  const query = new URLSearchParams({
    tickers: tickers.join(','),
  })

  return `${API_PRICES_ENDPOINT}?${query.toString()}`
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        message?: unknown
        error?: unknown
      }

      if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
        return payload.message.trim()
      }

      if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
        return payload.error.trim()
      }

      return ''
    }

    return (await response.text()).trim()
  } catch {
    return ''
  }
}

async function fetchRemoteValidPrices(
  tickers: string[]
): Promise<MarketPriceMap> {
  if (tickers.length === 0) {
    return {}
  }

  const response = await fetch(buildApiUrl(tickers), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const details = await readErrorMessage(response)

    throw new Error(
      `Price request failed with status ${response.status}${
        details ? `: ${details}` : ''
      }`
    )
  }

  const payload = (await response.json()) as ApiPriceMap
  return filterValidPrices(payload)
}

export async function fetchPrices(
  tickers: string[],
  options: FetchPricesOptions = {}
): Promise<MarketPriceMap> {
  const normalizedTickers = uniqueTickers(tickers)

  if (normalizedTickers.length === 0) {
    return {}
  }

  const ttlMs = options.ttlMs ?? CACHE_TTL_MS
  const forceRefresh = options.forceRefresh ?? false

  const cachedPrices = loadCachedPrices(
    normalizedTickers,
    ttlMs,
    forceRefresh
  )

  const tickersToFetch = resolveTickersToFetch({
    normalizedTickers,
    ttlMs,
    forceRefresh,
  })

  if (tickersToFetch.length === 0) {
    return cachedPrices
  }

  try {
    const remotePrices = await fetchRemoteValidPrices(tickersToFetch)

    if (Object.keys(remotePrices).length > 0) {
      savePricesToCache(remotePrices)
    }

    return mergePriceMaps(remotePrices, cachedPrices)
  } catch (error) {
    console.error('❌ erro ao buscar preços em services/priceService', error)
    return cachedPrices
  }
}