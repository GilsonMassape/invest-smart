import type { B3ParsedPosition } from '../../domain/import/b3Import'

type PdfTextItem = {
  str?: string
}

type PdfTextContent = {
  items: PdfTextItem[]
}

type CandidateRow = {
  ticker: string
  quantity: number
  avgPrice: number
}

const SECTION_HINTS = [
  'posição',
  'posicao',
  'custódia',
  'custodia',
  'quantidade',
  'preço médio',
  'preco medio',
  'preço médio de compra',
  'preco medio de compra',
]

const IGNORED_LINE_HINTS = [
  'movimentação',
  'movimentacao',
  'negociação',
  'negociacao',
  'data',
  'cpf',
  'cnpj',
  'canal eletrônico',
  'canal eletronico',
  'instituição',
  'instituicao',
  'agência',
  'agencia',
  'conta',
  'código',
  'codigo',
  'resumo',
  'observação',
  'observacao',
  'valor total',
  'total geral',
]

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeSearchText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function parseBrazilianNumber(value: string): number {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundQuantity(value: number): number {
  return Number(value.toFixed(8))
}

function roundPrice(value: number): number {
  return Number(value.toFixed(8))
}

function isValidTicker(value: string): boolean {
  return /^[A-Z]{4}\d{1,2}$/.test(value) || /^[A-Z]{5}\d{1,2}$/.test(value)
}

function isLikelySectionLine(value: string): boolean {
  const normalized = normalizeSearchText(value)
  return SECTION_HINTS.some((hint) => normalized.includes(hint))
}

function isIgnoredLine(value: string): boolean {
  const normalized = normalizeSearchText(value)
  return IGNORED_LINE_HINTS.some((hint) => normalized.includes(hint))
}

function isLikelyQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value)
}

function isLikelyAvgPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 1_000_000
}

function tokenizeLine(line: string): string[] {
  return normalizeText(line).split(' ').filter(Boolean)
}

function extractTickerIndexes(tokens: readonly string[]): number[] {
  const indexes: number[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = normalizeTicker(tokens[index] ?? '')

    if (isValidTicker(token)) {
      indexes.push(index)
    }
  }

  return indexes
}

function extractNumericCandidates(
  tokens: readonly string[],
  startIndex: number,
  maxDistance: number,
): number[] {
  const results: number[] = []

  for (
    let index = startIndex;
    index < tokens.length && index < startIndex + maxDistance;
    index += 1
  ) {
    const token = tokens[index] ?? ''
    const parsed = parseBrazilianNumber(token)

    if (parsed > 0) {
      results.push(parsed)
    }
  }

  return results
}

function buildCandidateRowFromTokens(
  tokens: readonly string[],
  tickerIndex: number,
): CandidateRow | null {
  const ticker = normalizeTicker(tokens[tickerIndex] ?? '')
  const nextTickerIndex = extractTickerIndexes(tokens).find((index) => index > tickerIndex)
  const sliceEnd = typeof nextTickerIndex === 'number' ? nextTickerIndex : tokens.length
  const relevantTokens = tokens.slice(tickerIndex + 1, sliceEnd)

  if (relevantTokens.length === 0) {
    return null
  }

  const numericCandidates = extractNumericCandidates(relevantTokens, 0, 12)

  let quantity = 0
  let avgPrice = 0

  for (const candidate of numericCandidates) {
    if (!quantity && isLikelyQuantity(candidate)) {
      quantity = candidate
      continue
    }

    if (quantity > 0 && isLikelyAvgPrice(candidate)) {
      avgPrice = candidate
      break
    }
  }

  if (!isLikelyQuantity(quantity) || !isLikelyAvgPrice(avgPrice)) {
    return null
  }

  return {
    ticker,
    quantity: roundQuantity(quantity),
    avgPrice: roundPrice(avgPrice),
  }
}

function extractPositionsFromLine(line: string): B3ParsedPosition[] {
  const normalizedLine = normalizeText(line)

  if (!normalizedLine || isIgnoredLine(normalizedLine)) {
    return []
  }

  const tokens = tokenizeLine(normalizedLine)
  const tickerIndexes = extractTickerIndexes(tokens)

  if (tickerIndexes.length === 0) {
    return []
  }

  const results: B3ParsedPosition[] = []

  for (const tickerIndex of tickerIndexes) {
    const candidate = buildCandidateRowFromTokens(tokens, tickerIndex)

    if (!candidate) {
      continue
    }

    results.push(candidate)
  }

  return results
}

function deduplicatePositions(
  positions: B3ParsedPosition[],
): B3ParsedPosition[] {
  const merged = new Map<string, { quantity: number; totalCost: number }>()

  for (const position of positions) {
    const ticker = normalizeTicker(position.ticker)

    if (!ticker || position.quantity <= 0 || position.avgPrice <= 0) {
      continue
    }

    const current = merged.get(ticker) ?? { quantity: 0, totalCost: 0 }
    const quantity = roundQuantity(current.quantity + position.quantity)
    const totalCost = current.totalCost + position.quantity * position.avgPrice

    merged.set(ticker, { quantity, totalCost })
  }

  return Array.from(merged.entries())
    .map(([ticker, data]) => ({
      ticker,
      quantity: roundQuantity(data.quantity),
      avgPrice:
        data.quantity > 0 ? roundPrice(data.totalCost / data.quantity) : 0,
    }))
    .filter((position) => position.quantity > 0 && position.avgPrice > 0)
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
}

function splitRelevantLines(text: string): string[] {
  const rawLines = text
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)

  const relevantLines: string[] = []
  let inRelevantSection = false

  for (const line of rawLines) {
    if (isLikelySectionLine(line)) {
      inRelevantSection = true
      continue
    }

    if (!inRelevantSection) {
      continue
    }

    relevantLines.push(line)
  }

  return relevantLines.length > 0 ? relevantLines : rawLines
}

function extractPositionsFromText(text: string): B3ParsedPosition[] {
  const lines = splitRelevantLines(text)
  const extracted = lines.flatMap(extractPositionsFromLine)
  return deduplicatePositions(extracted)
}

export async function parseB3Pdf(file: File): Promise<B3ParsedPosition[]> {
  const pdfjs = await import('pdfjs-dist')

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()

  const arrayBuffer = await file.arrayBuffer()

  const pdf = await pdfjs.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise

  const pagesText: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = (await page.getTextContent()) as PdfTextContent

    const pageText = content.items
      .map((item) => normalizeText(item.str ?? ''))
      .filter(Boolean)
      .join('\n')

    pagesText.push(pageText)
  }

  return extractPositionsFromText(pagesText.join('\n'))
}