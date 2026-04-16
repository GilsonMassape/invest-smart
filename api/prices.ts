type PriceValue = number | null
type PriceMap = Record<string, PriceValue>

type BrapiQuoteResult = Readonly<{
  symbol?: string
  regularMarketPrice?: number | string | null
  close?: number | string | null
  previousClose?: number | string | null
}> &
  Record<string, unknown>

type BrapiResponse = Readonly<{
  results?: BrapiQuoteResult[]
  error?: boolean
  message?: string
}> &
  Record<string, unknown>

type ApiRequest = {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

const BRAPI_BASE_URL = 'https://brapi.dev/api/quote'
const REQUEST_TIMEOUT_MS = 8000
const MAX_TICKERS_PER_REQUEST = 1

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

function buildEmptyPriceMap(tickers: readonly string[]): PriceMap {
  return uniqueTickers(tickers).reduce<PriceMap>((accumulator, ticker) => {
    accumulator[ticker] = null
    return accumulator
  }, {})
}

function toSafeNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function extractQuotePrice(result: BrapiQuoteResult): number | null {
  const resolved =
    toSafeNumber(result.regularMarketPrice) ??
    toSafeNumber(result.close) ??
    toSafeNumber(result.previousClose)

  return typeof resolved === 'number' && resolved > 0 ? resolved : null
}

function resolveBrapiToken(): string | null {
  const candidates = [
    process.env.BRAPI_TOKEN,
    process.env.VITE_BRAPI_TOKEN,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return null
}

function buildBrapiUrl(tickers: readonly string[], token: string): string {
  const query = new URLSearchParams({
    fundamental: 'false',
    dividends: 'false',
    token,
  })

  return `${BRAPI_BASE_URL}/${tickers.join(',')}?${query.toString()}`
}

function extractTickersFromQuery(
  query: ApiRequest['query']
): string[] {
  if (!query) {
    return []
  }

  const raw = query.tickers

  if (Array.isArray(raw)) {
    return uniqueTickers(
      raw.flatMap((value) => value.split(','))
    )
  }

  if (typeof raw === 'string') {
    return uniqueTickers(raw.split(','))
  }

  return []
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

function parseBrapiResponse(
  requestedTickers: readonly string[],
  payload: unknown
): PriceMap {
  const requestedMap = buildEmptyPriceMap(requestedTickers)

  if (!isObjectRecord(payload)) {
    return requestedMap
  }

  const response = payload as BrapiResponse

  if (response.error === true) {
    throw new Error(
      extractResponseMessage(response) ?? 'Erro retornado pela BRAPI.'
    )
  }

  const results = Array.isArray(response.results) ? response.results : []

  for (const result of results) {
    if (!isObjectRecord(result)) {
      continue
    }

    const symbol =
      typeof result.symbol === 'string'
        ? normalizeTicker(result.symbol)
        : null

    if (!symbol || !(symbol in requestedMap)) {
      continue
    }

    requestedMap[symbol] = extractQuotePrice(result as BrapiQuoteResult)
  }

  return requestedMap
}

async function fetchBrapiBatch(
  tickers: readonly string[],
  token: string
): Promise<PriceMap> {
  if (tickers.length === 0) {
    return {}
  }

  const url = buildBrapiUrl(tickers, token)
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

async function fetchAllPrices(
  tickers: readonly string[],
  token: string
): Promise<PriceMap> {
  const normalizedTickers = uniqueTickers(tickers)

  if (normalizedTickers.length === 0) {
    return {}
  }

  const batches = chunkArray(normalizedTickers, MAX_TICKERS_PER_REQUEST)
  const responses = await Promise.all(
    batches.map((batch) => fetchBrapiBatch(batch, token))
  )

  return mergePriceMaps(responses)
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: true,
      message: 'Method not allowed.',
    })
  }

  const tickers = extractTickersFromQuery(req.query)

  if (tickers.length === 0) {
    return res.status(400).json({
      error: true,
      message: 'Informe ao menos um ticker em ?tickers=ITUB4,WEGE3',
    })
  }

  const token = resolveBrapiToken()

  if (!token) {
    return res.status(500).json({
      error: true,
      message: 'BRAPI_TOKEN não configurado no servidor.',
    })
  }

  try {
    const prices = await fetchAllPrices(tickers, token)

    return res.status(200).json(prices)
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Falha ao consultar preços.'

    return res.status(502).json({
      error: true,
      message,
    })
  }
}