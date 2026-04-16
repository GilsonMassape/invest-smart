import {
  fetchPrices as fetchRemotePrices,
  type PriceMap,
} from '../infra/pricing/fetchPrices'
import {
  getCachedPrices,
  getMissingTickers,
  savePricesToCache,
} from '../infra/pricing/priceCache'

export type MarketPriceMap = Record<string, number>

export type FetchPricesOptions = Readonly<{
  ttlMs?: number
  forceRefresh?: boolean
}>

const CACHE_TTL_MS = 1000 * 60 * 5

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

function filterValidPrices(prices: PriceMap | MarketPriceMap): MarketPriceMap {
  const marketPrices: MarketPriceMap = {}

  for (const [ticker, price] of Object.entries(prices)) {
    const safePrice = toPositiveNumber(price)

    if (safePrice !== null) {
      marketPrices[normalizeTicker(ticker)] = safePrice
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

  return filterValidPrices(getCachedPrices(normalizedTickers, ttlMs))
}

async function fetchRemoteValidPrices(
  tickers: string[]
): Promise<MarketPriceMap> {
  if (tickers.length === 0) {
    return {}
  }

  const remotePrices = await fetchRemotePrices(tickers)
  return filterValidPrices(remotePrices)
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