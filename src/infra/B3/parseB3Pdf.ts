import * as pdfjsLib from 'pdfjs-dist';
import type {
  TextItem,
  TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api';
import type { B3ParsedPosition } from '../../domain/import/b3Import';

type SupportedSection = 'ACOES' | 'ETF' | 'FII' | 'BDR' | 'UNIT';

type PositionedTextItem = {
  str: string;
  x: number;
  y: number;
};

type AssetBlock = {
  section: SupportedSection;
  lines: string[];
};

type NumericToken = {
  raw: string;
  value: number;
  isCurrency: boolean;
};

const SECTION_LABELS: ReadonlyArray<{
  type: SupportedSection;
  patterns: ReadonlyArray<string>;
}> = [
  { type: 'ACOES', patterns: ['Posição - Ações'] },
  { type: 'ETF', patterns: ['Posição - ETF'] },
  { type: 'FII', patterns: ['Posição - FII'] },
  { type: 'BDR', patterns: ['Posição - BDR', 'Brazilian Depositary Receipts'] },
  { type: 'UNIT', patterns: ['Posição - Units', 'Posição - UNIT'] },
];

const SECTION_END_PREFIXES: ReadonlyArray<string> = [
  'Total',
  'Posição - ',
  'Proventos recebidos',
  'Reembolsos de empréstimos de ativos',
  'Negociação',
  'Movimentações',
  'Tesouro Direto',
  'Renda fixa',
  'Fundos de investimento',
];

const IGNORABLE_LINE_PREFIXES: ReadonlyArray<string> = [
  'Relatório mensal consolidado',
  'acesse investidor.B3.com.br',
  'investidor.B3.com.br',
  'Central de Atendimento',
  'Canal Eletrônico do Investidor',
  'Instituição',
  'Conta',
  'Preço de fechamento',
  'Valor atualizado',
  'Quantidade',
  'Código de negociação',
  'Produto',
  'Escriturador',
  'Emissão',
  'Página',
  'Data de geração',
];

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_PAGES_TO_PARSE = 30;
const LINE_Y_TOLERANCE = 2;
const TICKER_REGEX = /\b([A-Z]{4}\d{1,2}|[A-Z]{5}\d{1,2}|[A-Z]{6}11)\b/;

let workerConfigured = false;

const ensurePdfWorkerConfigured = (): void => {
  if (workerConfigured) {
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  workerConfigured = true;
};

const sanitizeText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const normalizeTicker = (value: string): string =>
  value.replace(/[^A-Z0-9]/gi, '').toUpperCase();

const normalizeNumber = (value: string): number => {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number): number => Number(value.toFixed(8));

const isPositiveNumber = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isTextItem = (
  item: TextItem | TextMarkedContent,
): item is TextItem => 'str' in item && 'transform' in item;

const toPositionedItem = (
  item: TextItem | TextMarkedContent,
): PositionedTextItem | null => {
  if (!isTextItem(item)) {
    return null;
  }

  const str = sanitizeText(item.str);

  if (!str) {
    return null;
  }

  return {
    str,
    x: item.transform[4],
    y: item.transform[5],
  };
};

const groupItemsIntoLines = (
  items: ReadonlyArray<TextItem | TextMarkedContent>,
): string[] => {
  const positionedItems = items
    .map(toPositionedItem)
    .filter((item): item is PositionedTextItem => item !== null)
    .sort((left, right) => {
      const yDistance = Math.abs(right.y - left.y);

      if (yDistance > LINE_Y_TOLERANCE) {
        return right.y - left.y;
      }

      return left.x - right.x;
    });

  const groups: PositionedTextItem[][] = [];

  for (const item of positionedItems) {
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup) {
      groups.push([item]);
      continue;
    }

    const referenceY = currentGroup[0].y;
    const belongsToCurrentLine =
      Math.abs(referenceY - item.y) <= LINE_Y_TOLERANCE;

    if (belongsToCurrentLine) {
      currentGroup.push(item);
      continue;
    }

    groups.push([item]);
  }

  return groups
    .map((group) =>
      group
        .sort((left, right) => left.x - right.x)
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
};

const isIgnorableLine = (line: string): boolean => {
  if (!line) {
    return true;
  }

  if (/^\d+\/\d+$/.test(line)) {
    return true;
  }

  return IGNORABLE_LINE_PREFIXES.some((prefix) => line.startsWith(prefix));
};

const detectSectionStart = (line: string): SupportedSection | null => {
  for (const section of SECTION_LABELS) {
    if (section.patterns.some((pattern) => line.includes(pattern))) {
      return section.type;
    }
  }

  return null;
};

const isSectionEnd = (line: string): boolean =>
  SECTION_END_PREFIXES.some((prefix) => line.startsWith(prefix));

const extractTicker = (text: string): string | null => {
  const match = text.match(TICKER_REGEX);
  return match ? normalizeTicker(match[1]) : null;
};

const isTickerStartLine = (line: string): boolean => extractTicker(line) !== null;

const buildAssetBlocks = (lines: ReadonlyArray<string>): AssetBlock[] => {
  const blocks: AssetBlock[] = [];
  let activeSection: SupportedSection | null = null;
  let currentBlock: AssetBlock | null = null;

  const flushCurrentBlock = (): void => {
    if (!currentBlock || currentBlock.lines.length === 0) {
      currentBlock = null;
      return;
    }

    blocks.push(currentBlock);
    currentBlock = null;
  };

  for (const rawLine of lines) {
    const line = sanitizeText(rawLine);

    if (isIgnorableLine(line)) {
      continue;
    }

    const detectedSection = detectSectionStart(line);

    if (detectedSection) {
      flushCurrentBlock();
      activeSection = detectedSection;
      continue;
    }

    if (!activeSection) {
      continue;
    }

    if (isSectionEnd(line)) {
      flushCurrentBlock();
      activeSection = null;
      continue;
    }

    if (isTickerStartLine(line)) {
      flushCurrentBlock();
      currentBlock = {
        section: activeSection,
        lines: [line],
      };
      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }

  flushCurrentBlock();

  return blocks;
};

const extractNumericTokens = (text: string): NumericToken[] => {
  const currencyMatches = [...text.matchAll(/R\$\s*([\d.]+,\d+)\b/g)].map(
    (match) => ({
      raw: match[1],
      value: normalizeNumber(match[1]),
      isCurrency: true,
    }),
  );

  const genericMatches = [...text.matchAll(/\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b/g)]
    .map((match) => match[0])
    .map((raw) => ({
      raw,
      value: normalizeNumber(raw),
      isCurrency: raw.includes(','),
    }));

  const merged: NumericToken[] = [];
  const seen = new Set<string>();

  for (const token of [...currencyMatches, ...genericMatches]) {
    const key = `${token.raw}|${token.value}|${token.isCurrency}`;
    if (seen.has(key) || !isPositiveNumber(token.value)) {
      continue;
    }

    seen.add(key);
    merged.push(token);
  }

  return merged;
};

const extractQuantityFromLine = (line: string): number | null => {
  const beforeCurrencyMatch = line.match(
    /\b(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?\s+R\$\s*[\d.]+,\d+\b/,
  );

  if (beforeCurrencyMatch) {
    const quantity = normalizeNumber(beforeCurrencyMatch[1]);
    return isPositiveNumber(quantity) ? quantity : null;
  }

  const tokens = extractNumericTokens(line).filter(
    (token) => !token.raw.includes(',') && Number.isInteger(token.value),
  );

  const quantity = tokens.find((token) => token.value > 0);
  return quantity ? quantity.value : null;
};

const extractAvgPriceFromLine = (
  line: string,
  quantity: number | null,
): number | null => {
  const currencyTokens = [...line.matchAll(/R\$\s*([\d.]+,\d+)\b/g)].map(
    (match) => normalizeNumber(match[1]),
  );

  const validCurrencyTokens = currencyTokens.filter(isPositiveNumber);

  if (validCurrencyTokens.length > 0) {
    return validCurrencyTokens[0];
  }

  if (!quantity || quantity <= 0) {
    return null;
  }

  const genericTokens = extractNumericTokens(line)
    .map((token) => token.value)
    .filter(isPositiveNumber)
    .filter((value) => !Number.isInteger(value));

  const candidate = genericTokens.find((value) => value > 0 && value < 1_000_000);
  return candidate ?? null;
};

const extractQuantityFromBlock = (block: AssetBlock): number | null => {
  for (const line of block.lines) {
    const quantity = extractQuantityFromLine(line);

    if (quantity && quantity > 0) {
      return quantity;
    }
  }

  const blockText = sanitizeText(block.lines.join(' '));
  const numericTokens = extractNumericTokens(blockText);

  const firstIntegerLikeToken = numericTokens.find(
    (token) => !token.raw.includes(',') && Number.isInteger(token.value) && token.value > 0,
  );

  return firstIntegerLikeToken?.value ?? null;
};

const extractAvgPriceFromBlock = (
  block: AssetBlock,
  quantity: number,
): number | null => {
  for (const line of block.lines) {
    const avgPrice = extractAvgPriceFromLine(line, quantity);

    if (avgPrice && avgPrice > 0) {
      return avgPrice;
    }
  }

  const blockText = sanitizeText(block.lines.join(' '));
  const currencyValues = [...blockText.matchAll(/R\$\s*([\d.]+,\d+)\b/g)]
    .map((match) => normalizeNumber(match[1]))
    .filter(isPositiveNumber);

  if (currencyValues.length >= 2) {
    return currencyValues[0];
  }

  if (currencyValues.length === 1) {
    return currencyValues[0];
  }

  const genericDecimals = extractNumericTokens(blockText)
    .map((token) => token.value)
    .filter(isPositiveNumber)
    .filter((value) => !Number.isInteger(value));

  const candidate = genericDecimals.find((value) => value > 0 && value < 1_000_000);
  return candidate ?? null;
};

const parseAssetBlock = (block: AssetBlock): B3ParsedPosition | null => {
  const blockText = sanitizeText(block.lines.join(' '));

  const ticker = extractTicker(blockText);
  if (!ticker) {
    return null;
  }

  const quantity = extractQuantityFromBlock(block);
  if (!quantity || quantity <= 0) {
    return null;
  }

  const avgPrice = extractAvgPriceFromBlock(block, quantity);
  if (!avgPrice || avgPrice <= 0) {
    return null;
  }

  return {
    ticker,
    quantity: round(quantity),
    avgPrice: round(avgPrice),
  };
};

const mergeDuplicatedTickers = (
  items: ReadonlyArray<B3ParsedPosition>,
): B3ParsedPosition[] => {
  const merged = new Map<string, B3ParsedPosition>();

  for (const item of items) {
    const existing = merged.get(item.ticker);

    if (!existing) {
      merged.set(item.ticker, { ...item });
      continue;
    }

    const nextQuantity = round(existing.quantity + item.quantity);
    const nextAvgPrice =
      nextQuantity > 0
        ? round(
            (existing.quantity * existing.avgPrice +
              item.quantity * item.avgPrice) /
              nextQuantity,
          )
        : existing.avgPrice;

    merged.set(item.ticker, {
      ticker: item.ticker,
      quantity: nextQuantity,
      avgPrice: nextAvgPrice,
    });
  }

  return Array.from(merged.values()).sort((left, right) =>
    left.ticker.localeCompare(right.ticker),
  );
};

const yieldToBrowser = async (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });

export const parseB3Pdf = async (file: File): Promise<B3ParsedPosition[]> => {
  if (!(file instanceof File)) {
    throw new Error('Arquivo inválido para importação da B3.');
  }

  if (file.size <= 0) {
    throw new Error('O arquivo enviado está vazio.');
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('O arquivo da B3 excede o limite suportado para importação.');
  }

  ensurePdfWorkerConfigured();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const totalPages = Math.min(pdf.numPages, MAX_PAGES_TO_PARSE);
  const allLines: string[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = groupItemsIntoLines(textContent.items);

    allLines.push(...lines);

    if (pageNumber % 2 === 0) {
      await yieldToBrowser();
    }
  }

  const blocks = buildAssetBlocks(allLines);
  const parsedItems = blocks
    .map(parseAssetBlock)
    .filter((item): item is B3ParsedPosition => item !== null);

  return mergeDuplicatedTickers(parsedItems);
};