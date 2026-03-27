import { removeExactDuplicates } from './b3ImportDeduplicator';
import { normalizeB3Positions } from './b3ImportNormalizer';
import { parseB3File, type B3ParsedPosition } from './b3Parser';
import {
  validateB3ImportPositions,
  type B3ImportValidationIssue,
} from './b3ImportValidator';

export type B3ImportParseResult = {
  positions: B3ParsedPosition[];
  issues: B3ImportValidationIssue[];
};

export const parseB3ImportFile = (content: string): B3ImportParseResult => {
  const parsed = parseB3File(content);
  const deduplicated = removeExactDuplicates(parsed);
  const normalized = normalizeB3Positions(deduplicated);
  const validated = validateB3ImportPositions(normalized);

  return {
    positions: validated.valid.map((position) => ({
      ticker: position.ticker,
      quantity: position.quantity,
      avgPrice: position.avgPrice,
    })),
    issues: validated.issues,
  };
};