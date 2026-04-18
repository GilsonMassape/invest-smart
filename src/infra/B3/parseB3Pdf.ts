import type { B3ParsedPosition } from '../../domain/import/b3Import'

type PdfTextItem = {
  str?: string
}

type PdfTextContent = {
  items: PdfTextItem[]
}

const ALLOWED_SECTION_MARKERS = [
  'Posição - Ações',
  'Posição - BDR - Brazilian Depositary Receipts',
  'Posição - ETF - Exchange Traded Fund',
  'Posição - FII - Fundo de Investimento Imobiliário',
  'Posição - Fundos de Investimentos',
]

const STOP_SECTION_MARKERS = [
  'Posição - CDB - Certificado de Depósito Bancário',
  'Posição - LCA - Letra de Crédito do Agronegócio',
  'Posição - Tesouro Direto',
  'Proventos recebidos',
  'Reembolsos de empréstimos de ativos',
  'Negociação',
]

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
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

function findNextMarkerIndex(
  text: string,
  startIndex: number,
  markers: readonly string[],
): number {
  let nextIndex = -1

  for (const marker of markers) {
    const found = text.indexOf(marker, startIndex)

    if (found === -1) {
      continue
    }

    if (nextIndex === -1 || found < nextIndex) {
      nextIndex = found
    }
  }

  return nextIndex
}

function extractAllowedSections(text: string): string[] {
  const sections: string[] = []

  for (const marker of ALLOWED_SECTION_MARKERS) {
    let searchIndex = 0

    while (searchIndex < text.length) {
      const start = text.indexOf(marker, searchIndex)

      if (start === -1) {
        break
      }

      const contentStart = start + marker.length
      const nextAllowed = findNextMarkerIndex(
        text,
        contentStart,
        ALLOWED_SECTION_MARKERS
      )
      const nextStop = findNextMarkerIndex(
        text,
        contentStart,
        STOP_SECTION_MARKERS
      )

      const candidates = [nextAllowed, nextStop].filter(
        (value) => value >= 0
      )
      const end =
        candidates.length > 0 ? Math.min(...candidates) : text.length

      const section = text.slice(contentStart, end).trim()

      if (section.length > 0) {
        sections.push(section)
      }

      searchIndex = end
    }
  }

  return sections
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
    const nextQuantity = roundQuantity(current.quantity + position.quantity)
    const nextTotalCost = current.totalCost + position.quantity * position.avgPrice

    merged.set(ticker, {
      quantity: nextQuantity,
      totalCost: nextTotalCost,
    })
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

function extractPositionsFromSection(section: string): B3ParsedPosition[] {
  const positions: B3ParsedPosition[] = []

  const rowRegex =
    /\b([A-Z]{4,5}\d{1,2})\b[\s\S]{0,220}?XP INVESTIMENTOS[\s\S]{0,40}?CCTVM S\/A[\s\S]{0,20}?(\d{1,3}(?:\.\d{3})*|\d+)\s+R\$\s*([\d.]+,\d{2})/g

  let match: RegExpExecArray | null = null

  while ((match = rowRegex.exec(section)) !== null) {
    const ticker = normalizeTicker(match[1] ?? '')
    const quantity = parseBrazilianNumber(match[2] ?? '')
    const avgPrice = parseBrazilianNumber(match[3] ?? '')

    if (!isValidTicker(ticker)) {
      continue
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      continue
    }

    if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
      continue
    }

    positions.push({
      ticker,
      quantity: roundQuantity(quantity),
      avgPrice: roundPrice(avgPrice),
    })
  }

  return positions
}

function extractPositionsFromText(text: string): B3ParsedPosition[] {
  const sections = extractAllowedSections(text)
  const extracted = sections.flatMap(extractPositionsFromSection)
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
      .join(' ')

    pagesText.push(pageText)
  }

  const fullText = pagesText.join('\n')
  return extractPositionsFromText(fullText)
}