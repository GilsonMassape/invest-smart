import * as pdfjsLib from 'pdfjs-dist';
import type {
  TextItem,
  TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api';
import type { B3ParsedPosition } from '../../domain/import/b3Import';

type SupportedSection = 'ACOES' | 'ETF' | 'FII' | 'BDR';

type PositionedTextItem = {
  str: string;
  x: number;
  y: number;
};

type AssetBlock = {
  section: SupportedSection;
  lines: string[];
};

const SECTION_LABELS: ReadonlyArray<{
  type: SupportedSection;
  patterns: ReadonlyArray<string>;
}> = [
  { type: 'ACOES', patterns: ['Posição - Ações'] },
  { type: 'ETF', patterns: ['Posição - ETF'] },
  { type: 'FII', patterns: ['Posição - FII'] },
  { type: 'BDR', patterns: ['Posição - BDR - Brazilian Depositary Receipts'] },
];

const SECTION_END_PREFIXES: ReadonlyArray<string> = [
  'Total',
  'Posição - ',
  'Proventos recebidos',
  'Reembolsos de empréstimos de ativos',
  'Negociação',
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
];

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_PAGES_TO_PARSE = 30;

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

const normalizeNumber = (value: string): number => {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

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

      if (yDistance > 2) {
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
    const belongsToCurrentLine = Math.abs(referenceY - item.y) <= 2;

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

const extractTickerFromStart = (line: string): string | null => {
  const match = line.match(/^([A-Z]{4}\d{1,2}|[A-Z]{5}\d{1,2}|[A-Z]{6}11)\b/);
  return match?.[1] ?? null;
};

const isTickerStartLine = (line: string): boolean =>
  extractTickerFromStart(line) !== null;

const buildAssetBlocks = (lines: ReadonlyArray<string>): AssetBlock[] => {
  const blocks: AssetBlock[] = [];
  let activeSection: SupportedSection | null = null;
  let currentBlock: AssetBlock | null = null;

  const flushCurrentBlock = () => {
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

const extractTickerFromBlock = (blockText: string): string | null => {
  const match = blockText.match(
    /\b([A-Z]{4}\d{1,2}|[A-Z]{5}\d{1,2}|[A-Z]{6}11)\b/,
  );
  return match?.[1] ?? null;
};

const extractQuantityFromBlock = (blockText: string): number | null => {
  const quantityBeforeCurrencyMatch = blockText.match(
    /\b(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?\s+R\$\s/,
  );

  if (quantityBeforeCurrencyMatch) {
    const quantity = normalizeNumber(quantityBeforeCurrencyMatch[1]);
    return quantity > 0 ? quantity : null;
  }

  const numericTokens = [...blockText.matchAll(/\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b/g)]
    .map((match) => match[0])
    .map((raw) => ({
      raw,
      value: normalizeNumber(raw),
      hasDecimalPart: raw.includes(','),
    }));

  const firstIntegerLikeToken = numericTokens.find(
    (token) => !token.hasDecimalPart && token.value > 0,
  );

  return firstIntegerLikeToken?.value ?? null;
};

const parseAssetBlock = (block: AssetBlock): B3ParsedPosition | null => {
  const blockText = sanitizeText(block.lines.join(' '));

  const ticker = extractTickerFromBlock(blockText);
  if (!ticker) {
    return null;
  }

  const quantity = extractQuantityFromBlock(blockText);
  if (!quantity || quantity <= 0) {
    return null;
  }

  return {
    ticker,
    quantity,
    avgPrice: 0,
  };
};

const mergeDuplicatedTickers = (
  items: ReadonlyArray<B3ParsedPosition>,
): B3ParsedPosition[] => {
  const merged = new Map<string, B3ParsedPosition>();

  for (const item of items) {
    const existing = merged.get(item.ticker);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    merged.set(item.ticker, { ...item });
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