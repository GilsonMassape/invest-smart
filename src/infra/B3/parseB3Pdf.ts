import type { B3ParsedPosition } from '../../domain/import/b3Import'

type PdfTextItem = {
  str?: string
}

type PdfTextContent = {
  items: PdfTextItem[]
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
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

function isValidTicker(value: string): boolean {
  return /^[A-Z]{4}\d{1,2}$/.test(value) || /^[A-Z]{5}\d{1,2}$/.test(value)
}

function deduplicatePositions(
  positions: B3ParsedPosition[],
): B3ParsedPosition[] {
  const merged = new Map<string, { quantity: number; totalCost: number }>()

  for (const position of positions) {
    const ticker = position.ticker.trim().toUpperCase()

    if (!ticker || position.quantity <= 0 || position.avgPrice < 0) {
      continue
    }

    const current = merged.get(ticker) ?? { quantity: 0, totalCost: 0 }
    const totalCost =
      current.totalCost + position.quantity * position.avgPrice
    const quantity = current.quantity + position.quantity

    merged.set(ticker, { quantity, totalCost })
  }

  return Array.from(merged.entries())
    .map(([ticker, data]) => ({
      ticker,
      quantity: data.quantity,
      avgPrice: data.quantity > 0 ? data.totalCost / data.quantity : 0,
    }))
    .filter((position) => position.quantity > 0)
}

function extractPositionsFromLine(line: string): B3ParsedPosition[] {
  const normalizedLine = normalizeText(line)

  if (!normalizedLine) {
    return []
  }

  const tokens = normalizedLine.split(' ')
  const results: B3ParsedPosition[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]?.toUpperCase() ?? ''

    if (!isValidTicker(token)) {
      continue
    }

    let quantity = 0
    let avgPrice = 0

    for (let forwardIndex = index + 1; forwardIndex < tokens.length; forwardIndex += 1) {
      const currentToken = tokens[forwardIndex]

      if (!quantity) {
        const maybeQuantity = parseBrazilianNumber(currentToken)

        if (maybeQuantity > 0 && Number.isInteger(maybeQuantity)) {
          quantity = maybeQuantity
          continue
        }
      }

      if (quantity > 0) {
        const maybePrice = parseBrazilianNumber(currentToken)

        if (maybePrice > 0) {
          avgPrice = maybePrice
          break
        }
      }
    }

    if (quantity > 0 && avgPrice > 0) {
      results.push({
        ticker: token,
        quantity,
        avgPrice,
      })
    }
  }

  return results
}

function extractPositionsFromText(text: string): B3ParsedPosition[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

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

  let fullText = ''

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = (await page.getTextContent()) as PdfTextContent

    const pageText = content.items
      .map((item) => item.str ?? '')
      .join(' ')

    fullText += `${pageText}\n`
  }

  return extractPositionsFromText(fullText)
}