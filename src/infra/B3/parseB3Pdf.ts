import type { B3ParsedPosition } from '../../domain/import/b3Import'

type PdfTextItem = {
  str?: string
  transform?: number[]
}

type PdfTextContent = {
  items: PdfTextItem[]
}

type PositionedToken = {
  text: string
  x: number
  y: number
}

const ALLOWED_SECTION_HINTS = [
  'acoes',
  'bdr - brazilian depositary receipts',
  'etf - exchange traded fund',
  'fii - fundo de investimento imobiliario',
  'fundos de investimentos',
]

const STOP_SECTION_HINTS = [
  'cdb - certificado de deposito bancario',
  'lca - letra de credito do agronegocio',
  'tesouro direto',
  'proventos recebidos',
  'reembolsos de emprestimos de ativos',
  'negociacao',
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

function isExactSectionLine(value: string, hints: string[]): boolean {
  const normalized = normalizeSearchText(value)
  return hints.some((hint) => normalized === hint || normalized.startsWith(hint))
}

function isAllowedSectionLine(value: string): boolean {
  return isExactSectionLine(value, ALLOWED_SECTION_HINTS)
}

function isStopSectionLine(value: string): boolean {
  return isExactSectionLine(value, STOP_SECTION_HINTS)
}

function isTableHeaderLine(value: string): boolean {
  const normalized = normalizeSearchText(value)

  return (
    normalized.includes('produto') ||
    normalized.includes('tipo') ||
    normalized.includes('instituicao') ||
    normalized.includes('quantidade') ||
    normalized.includes('preco de fechamento') ||
    normalized.includes('valor atualizado') ||
    normalized.includes('preco unitario atualizado') ||
    normalized.includes('vencimento') ||
    normalized.includes('valor aplicado')
  )
}

function isIgnorableLine(value: string): boolean {
  const normalized = normalizeSearchText(value)

  return (
    normalized.length === 0 ||
    normalized === 'total' ||
    normalized.startsWith('r$ ') ||
    normalized.includes('extrato de posicao') ||
    normalized.includes('acesse investidor.b3.com.br') ||
    normalized.includes('a valorizacao dos ativos') ||
    normalized.includes('o investidor nao deve considerar') ||
    normalized.includes('dessa forma, a b3 esta isenta') ||
    normalized.includes('indiretamente pelo investidor') ||
    /^\d+\/\d+$/.test(normalized) ||
    isTableHeaderLine(normalized)
  )
}

function extractTicker(value: string): string | null {
  const match = value.match(/\b([A-Z]{4,5}\d{1,2})\b/)
  const ticker = match?.[1] ?? null

  if (!ticker) {
    return null
  }

  return isValidTicker(ticker) ? normalizeTicker(ticker) : null
}

function extractRowData(buffer: string): B3ParsedPosition | null {
  const ticker = extractTicker(buffer)

  if (!ticker) {
    return null
  }

  const tickerIndex = buffer.indexOf(ticker)
  const slice = tickerIndex >= 0 ? buffer.slice(tickerIndex + ticker.length) : buffer

  const match = slice.match(
    /(\d{1,3}(?:\.\d{3})*|\d+)\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/
  )

  if (!match) {
    return null
  }

  const quantity = parseBrazilianNumber(match[1] ?? '')
  const avgPrice = parseBrazilianNumber(match[2] ?? '')

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    return null
  }

  if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
    return null
  }

  return {
    ticker,
    quantity: roundQuantity(quantity),
    avgPrice: roundPrice(avgPrice),
  }
}

function deduplicatePositions(
  positions: B3ParsedPosition[]
): B3ParsedPosition[] {
  const merged = new Map<string, { quantity: number; totalCost: number }>()

  for (const position of positions) {
    const ticker = normalizeTicker(position.ticker)

    if (!ticker || position.quantity <= 0 || position.avgPrice <= 0) {
      continue
    }

    const current = merged.get(ticker) ?? { quantity: 0, totalCost: 0 }
    const quantity = current.quantity + position.quantity
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
    .sort((a, b) => a.ticker.localeCompare(b.ticker, 'pt-BR'))
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

  const sortedTokens = [...positionedTokens].sort((a, b) => {
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
    } else {
      rows.push({
        y: token.y,
        tokens: [token],
      })
    }
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

function extractPositionsFromLines(lines: string[]): B3ParsedPosition[] {
  const positions: B3ParsedPosition[] = []

  let inAllowedSection = false
  let currentBuffer = ''

  const flushBuffer = () => {
    if (!currentBuffer) {
      return
    }

    const parsed = extractRowData(currentBuffer)

    if (parsed) {
      positions.push(parsed)
    }

    currentBuffer = ''
  }

  for (const rawLine of lines) {
    const line = normalizeText(rawLine)

    if (!line) {
      continue
    }

    if (isAllowedSectionLine(line)) {
      flushBuffer()
      inAllowedSection = true
      continue
    }

    if (isStopSectionLine(line)) {
      flushBuffer()
      inAllowedSection = false
      continue
    }

    if (!inAllowedSection) {
      continue
    }

    if (isIgnorableLine(line)) {
      continue
    }

    const lineTicker = extractTicker(line)

    if (lineTicker) {
      flushBuffer()
      currentBuffer = line

      const parsed = extractRowData(currentBuffer)
      if (parsed) {
        positions.push(parsed)
        currentBuffer = ''
      }

      continue
    }

    if (currentBuffer) {
      currentBuffer = normalizeText(`${currentBuffer} ${line}`)

      const parsed = extractRowData(currentBuffer)
      if (parsed) {
        positions.push(parsed)
        currentBuffer = ''
      }
    }
  }

  flushBuffer()

  return deduplicatePositions(positions)
}

export async function parseB3Pdf(file: File): Promise<B3ParsedPosition[]> {
  const pdfjs = await import('pdfjs-dist')

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
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