export type RawB3Row = Record<string, string>;

export type B3ParsedPosition = {
  ticker: string;
  quantity: number;
  avgPrice: number;
};

const POSSIBLE_SEPARATORS = [';', ',', '\t'];

const HEADER_ALIASES: Record<string, string[]> = {
  ticker: ['codigo', 'ticker', 'ativo', 'papel'],
  quantity: ['quantidade', 'qtd', 'qtde'],
  avgPrice: ['preco', 'preço', 'preco medio', 'preço médio', 'pm', 'valor medio'],
};

const normalizeKey = (key: string): string =>
  key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const detectSeparator = (line: string): string => {
  let best = ';';
  let max = 0;

  for (const sep of POSSIBLE_SEPARATORS) {
    const count = line.split(sep).length;
    if (count > max) {
      max = count;
      best = sep;
    }
  }

  return best;
};

const sanitize = (value: string): string =>
  value.replace(/"/g, '').trim();

const parseNumber = (value: string): number => {
  const cleaned = value
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const normalizeTicker = (ticker: string): string =>
  ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase();

const isValidRow = (row: RawB3Row): boolean =>
  Object.values(row).some((v) => v && v.trim() !== '');

const resolveColumnIndex = (
  header: string[],
  aliases: string[],
): number => {
  for (let i = 0; i < header.length; i++) {
    const key = normalizeKey(header[i]);

    if (aliases.some((alias) => key.includes(alias))) {
      return i;
    }
  }

  return -1;
};

export const parseB3File = (content: string): B3ParsedPosition[] => {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (lines.length === 0) return [];

  const separator = detectSeparator(lines[0]);

  const header = lines[0].split(separator).map(sanitize);

  const tickerIdx = resolveColumnIndex(header, HEADER_ALIASES.ticker);
  const qtyIdx = resolveColumnIndex(header, HEADER_ALIASES.quantity);
  const priceIdx = resolveColumnIndex(header, HEADER_ALIASES.avgPrice);

  const result: B3ParsedPosition[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = lines[i].split(separator).map(sanitize);

      const row: RawB3Row = {};

      for (let j = 0; j < header.length; j++) {
        row[header[j] || `col_${j}`] = cols[j] || '';
      }

      if (!isValidRow(row)) continue;

      const ticker =
        tickerIdx >= 0 ? normalizeTicker(cols[tickerIdx]) : '';

      const quantity =
        qtyIdx >= 0 ? parseNumber(cols[qtyIdx]) : 0;

      const avgPrice =
        priceIdx >= 0 ? parseNumber(cols[priceIdx]) : 0;

      if (!ticker || quantity <= 0 || avgPrice <= 0) continue;

      result.push({
        ticker,
        quantity,
        avgPrice,
      });
    } catch {
      continue;
    }
  }

  return result;
};