import type { PriceMap, PriceValue } from './fetchPrices'

type CachedPriceEntry = Readonly<{
  value: PriceValue
  updatedAt: number
}>

type PriceCacheRecord = Record<string, CachedPriceEntry>

const STORAGE_KEY = 'invest-smart.pricing.cache.v1'
const CACHE_TTL_MS = 1000 * 60 * 5

const memoryCache = new Map<string, CachedPriceEntry>()

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function toSafeTimestamp(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizePriceValue(value: unknown): PriceValue {
  if (value === null) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isFreshEntry(
  entry: CachedPriceEntry,
  now: number,
  ttlMs: number
): boolean {
  return now - entry.updatedAt <= ttlMs
}

function isValidCacheEntry(value: unknown): value is CachedPriceEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CachedPriceEntry>

  return (
    (candidate.value === null ||
      (typeof candidate.value === 'number' && Number.isFinite(candidate.value))) &&
    typeof candidate.updatedAt === 'number' &&
    Number.isFinite(candidate.updatedAt) &&
    candidate.updatedAt > 0
  )
}

function buildStorageRecordFromMemory(): PriceCacheRecord {
  const record: PriceCacheRecord = {}

  for (const [ticker, entry] of memoryCache.entries()) {
    record[ticker] = entry
  }

  return record
}

function saveStorageRecord(record: PriceCacheRecord): void {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // noop
  }
}

function loadStorageRecord(): PriceCacheRecord {
  if (!isBrowser()) {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const record: PriceCacheRecord = {}

    for (const [rawTicker, rawEntry] of Object.entries(parsed)) {
      const ticker = normalizeTicker(rawTicker)

      if (!ticker || !isValidCacheEntry(rawEntry)) {
        continue
      }

      record[ticker] = {
        value: normalizePriceValue(rawEntry.value),
        updatedAt: rawEntry.updatedAt,
      }
    }

    return record
  } catch {
    return {}
  }
}

function hydrateMemoryCache(): void {
  if (memoryCache.size > 0) {
    return
  }

  const storageRecord = loadStorageRecord()

  for (const [ticker, entry] of Object.entries(storageRecord)) {
    memoryCache.set(ticker, entry)
  }
}

function persistMemoryCache(): void {
  saveStorageRecord(buildStorageRecordFromMemory())
}

function deleteExpiredEntries(
  now: number = Date.now(),
  ttlMs: number = CACHE_TTL_MS
): void {
  hydrateMemoryCache()

  let hasChanges = false

  for (const [ticker, entry] of memoryCache.entries()) {
    if (!isFreshEntry(entry, now, ttlMs)) {
      memoryCache.delete(ticker)
      hasChanges = true
    }
  }

  if (hasChanges) {
    persistMemoryCache()
  }
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

export function getCachedPrices(
  tickers: readonly string[],
  ttlMs: number = CACHE_TTL_MS
): PriceMap {
  const now = Date.now()

  hydrateMemoryCache()
  deleteExpiredEntries(now, ttlMs)

  const result: PriceMap = {}

  for (const ticker of uniqueTickers(tickers)) {
    const entry = memoryCache.get(ticker)
    result[ticker] = entry ? entry.value : null
  }

  return result
}

export function getMissingTickers(
  tickers: readonly string[],
  ttlMs: number = CACHE_TTL_MS
): string[] {
  const now = Date.now()

  hydrateMemoryCache()
  deleteExpiredEntries(now, ttlMs)

  const missing = new Set<string>()

  for (const ticker of uniqueTickers(tickers)) {
    const entry = memoryCache.get(ticker)

    if (!entry || !isFreshEntry(entry, now, ttlMs)) {
      missing.add(ticker)
    }
  }

  return Array.from(missing)
}

export function savePricesToCache(
  prices: PriceMap,
  updatedAt: number = Date.now()
): void {
  hydrateMemoryCache()

  const safeUpdatedAt = toSafeTimestamp(updatedAt) ?? Date.now()

  for (const [rawTicker, rawValue] of Object.entries(prices)) {
    const ticker = normalizeTicker(rawTicker)

    if (!ticker) {
      continue
    }

    memoryCache.set(ticker, {
      value: normalizePriceValue(rawValue),
      updatedAt: safeUpdatedAt,
    })
  }

  persistMemoryCache()
}

export function clearPriceCache(): void {
  memoryCache.clear()

  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

export function getPriceCacheSnapshot(): PriceCacheRecord {
  hydrateMemoryCache()
  deleteExpiredEntries()

  return buildStorageRecordFromMemory()
}