import type { B3ParsedPosition } from '../../domain/import/b3Import'

type PdfTextItem = {
  str?: string
  transform?: number[]
  width?: number
  height?: number
}

type PdfTextContent = {
  items: PdfTextItem[]
}

type CandidateRow = {
  ticker: string
  quantity: number
  avgPrice: number
}

type PositionedToken = {
  text: string
  x: number
  y: number
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

const STOP_SECTION_HINTS = [
  'resumo dos investimentos',
  'evolução patrimonial',
  'evolucao patrimonial',
  'movimentação',
  'movimentacao',
  'negociação',
  'negociacao',
  'proventos',
  'lançamentos',
  'lancamentos',
  'extrato',
]

const IGNORED_LINE_HINTS = [
  'movimentação',
  'movimentacao',
  'negociação',
  'negociacao',
  'canal eletrônico',
  'canal eletronico',
  'instituição',
  'instituicao',
  'agência',
  'agencia',
  'conta',
  'cpf',
  'cnpj',
  'código',
  'codigo',
  'resumo',
  'observação',
  'observacao',
  'valor total',
  'total geral',
  'página',
  'pagina',
  'ouvidoria',
  'sac',
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

function isStopSectionLine(value: string): boolean {
  const normalized = normalizeSearchText(value)
  return STOP_SECTION_HINTS.some((hint) => normalized.includes(hint))
}

function isIgnoredLine(value: string): boolean {
  const normalized = normalizeSearchText(value)
  return IGNORED_LINE_HINTS.some((hint) => normalized.includes(hint))
}

function isLikelyQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value) && value < 100_000_000
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

  let quantity = 0
  let avgPrice = 0

  for (const token of relevantTokens) {
    const candidate = parseBrazilianNumber(token)

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

    if (candidate) {
      results.push(candidate)
    }
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
      avgPrice: data.quantity > 0 ? roundPrice(data.totalCost / data.quantity) : 0,
    }))
    .filter((position) => position.quantity > 0 && position.avgPrice > 0)
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
}

function splitRelevantLines(lines: string[]): string[] {
  const normalizedLines = lines.map((line) => normalizeText(line)).filter(Boolean)

  const relevantLines: string[] = []
  let inRelevantSection = false

  for (const line of normalizedLines) {
    if (isLikelySectionLine(line)) {
      inRelevantSection = true
      continue
    }

    if (inRelevantSection && isStopSectionLine(line)) {
      break
    }

    if (!inRelevantSection) {
      continue
    }

    relevantLines.push(line)
  }

  return relevantLines.length > 0 ? relevantLines : normalizedLines
}

function extractPositionsFromLines(lines: string[]): B3ParsedPosition[] {
  const relevantLines = splitRelevantLines(lines)
  const extracted = relevantLines.flatMap(extractPositionsFromLine)
  return deduplicatePositions(extracted)
}

function toPositionedToken(item: PdfTextItem): PositionedToken | null {
  const text = normalizeText(item.str ?? '')

  if (!text) {
    return null
  }

  const transform = Array.isArray(item.transform) ? item.transform : []
  const x = typeof transform[4] === 'number' ? transform[4] : 0
  const y = typeof transform[5] === 'number' ? transform[5] : 0

  return { text, x, y }
}

function buildLinesFromPageItems(items: PdfTextItem[]): string[] {
  const positionedTokens = items
    .map(toPositionedToken)
    .filter((item): item is PositionedToken => item !== null)

  if (positionedTokens.length === 0) {
    return []
  }

  const sortedTokens = positionedTokens.sort((a, b) => {
    const yDiff = b.y - a.y

    if (Math.abs(yDiff) > 2) {
      return yDiff
    }

    return a.x - b.x
  })

  const rows: Array<{ y: number; tokens: PositionedToken[] }> = []

  for (const token of sortedTokens) {
    const existingRow = rows.find((row) => Math.abs(row.y - token.y) <= 2)

    if (existingRow) {
      existingRow.tokens.push(token)
      continue
    }

    rows.push({
      y: token.y,
      tokens: [token],
    })
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.tokens
        .sort((a, b) => a.x - b.x)
        .map((token) => token.text)
        .join(' ')
    )
    .map((line) => normalizeText(line))
    .filter(Boolean)
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

  const allLines: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = (await page.getTextContent()) as PdfTextContent
    const pageLines = buildLinesFromPageItems(content.items)

    allLines.push(...pageLines)
  }

  return extractPositionsFromLines(allLines)
}