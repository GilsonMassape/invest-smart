export type PriceValue = number | null

export type PriceMap = Record<string, PriceValue>

type BrapiQuoteResult = Readonly<{
  symbol?: string
  regularMarketPrice?: number | string | null
  close?: number | string | null
  previousClose?: number | string | null
}> &
  Record<string, unknown>

type BrapiErrorPayload = Readonly<{
  error?: boolean
  message?: string
}> &
  Record<string, unknown>

type BrapiResponse = Readonly<{
  results?: BrapiQuoteResult[]
}> &
  BrapiErrorPayload

const BRAPI_BASE_URL = 'https://brapi.dev/api/quote'
const REQUEST_TIMEOUT_MS = 8000
const MAX_TICKERS_PER_REQUEST = 20

function toSafeNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isPositivePrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function normalizeTickerKey(value: string): string {
  return normalizeTicker(value).replace(/[^A-Z0-9]/g, '')
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
  const resolved =
    toSafeNumber(result.regularMarketPrice) ??
    toSafeNumber(result.close) ??
    toSafeNumber(result.previousClose)

  return isPositivePrice(resolved) ? resolved : null
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractResponseMessage(payload: unknown): string | null {
  if (!isObjectRecord(payload)) {
    return null
  }

  const message = payload.message
  return typeof message === 'string' && message.trim().length > 0
    ? message.trim()
    : null
}

function buildRequestedKeyMap(
  requestedTickers: readonly string[]
): Map<string, string> {
  const keyMap = new Map<string, string>()

  for (const ticker of requestedTickers) {
    keyMap.set(normalizeTickerKey(ticker), ticker)
  }

  return keyMap
}

function parseBrapiResponse(
  requestedTickers: readonly string[],
  payload: unknown
): PriceMap {
  const requestedMap = buildEmptyPriceMap(requestedTickers)

  if (!isObjectRecord(payload)) {
    console.error('❌ BRAPI retornou payload inválido', payload)
    return requestedMap
  }

  const response = payload as BrapiResponse

  if (response.error === true) {
    console.error(
      '❌ BRAPI retornou erro de aplicação',
      extractResponseMessage(response) ?? 'sem mensagem'
    )
    return requestedMap
  }

  const results = Array.isArray(response.results) ? response.results : []

  if (results.length === 0) {
    console.error(
      '❌ BRAPI retornou resposta sem resultados',
      extractResponseMessage(response) ?? 'sem mensagem'
    )
    return requestedMap
  }

  const requestedKeyMap = buildRequestedKeyMap(requestedTickers)
  const unresolvedTickers = new Set(requestedTickers)

  for (const result of results) {
    if (!isObjectRecord(result)) {
      continue
    }

    const price = extractQuotePrice(result as BrapiQuoteResult)
    if (price === null) {
      continue
    }

    const rawSymbol =
      typeof result.symbol === 'string' ? normalizeTicker(result.symbol) : null

    let matchedTicker: string | null = null

    if (rawSymbol) {
      if (rawSymbol in requestedMap) {
        matchedTicker = rawSymbol
      } else {
        matchedTicker = requestedKeyMap.get(normalizeTickerKey(rawSymbol)) ?? null
      }
    }

    if (!matchedTicker && unresolvedTickers.size === 1) {
      matchedTicker = Array.from(unresolvedTickers)[0] ?? null
    }

    if (!matchedTicker) {
      continue
    }

    requestedMap[matchedTicker] = price
    unresolvedTickers.delete(matchedTicker)
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

async function readErrorBody(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      const json = (await response.json()) as unknown
      return extractResponseMessage(json) ?? JSON.stringify(json)
    }

    return (await response.text()).trim()
  } catch {
    return ''
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
      const details = await readErrorBody(response)
      throw new Error(
        `Price request failed with status ${response.status}${
          details ? `: ${details}` : ''
        }`
      )
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