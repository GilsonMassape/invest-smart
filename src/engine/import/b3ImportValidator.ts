import type { NormalizedB3Position } from './b3ImportNormalizer';

export type B3ImportValidationIssueCode =
  | 'EMPTY_TICKER'
  | 'INVALID_QUANTITY'
  | 'INVALID_AVG_PRICE';

export type B3ImportValidationIssue = {
  code: B3ImportValidationIssueCode;
  ticker: string;
};

export type B3ImportValidationResult = {
  valid: NormalizedB3Position[];
  issues: B3ImportValidationIssue[];
};

const hasTicker = (ticker: string): boolean => ticker.trim().length > 0;

const isPositiveNumber = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export const validateB3ImportPositions = (
  positions: readonly NormalizedB3Position[],
): B3ImportValidationResult => {
  const valid: NormalizedB3Position[] = [];
  const issues: B3ImportValidationIssue[] = [];

  for (const position of positions) {
    if (!hasTicker(position.ticker)) {
      issues.push({
        code: 'EMPTY_TICKER',
        ticker: position.ticker,
      });
      continue;
    }

    if (!isPositiveNumber(position.quantity)) {
      issues.push({
        code: 'INVALID_QUANTITY',
        ticker: position.ticker,
      });
      continue;
    }

    if (!isPositiveNumber(position.avgPrice)) {
      issues.push({
        code: 'INVALID_AVG_PRICE',
        ticker: position.ticker,
      });
      continue;
    }

    valid.push(position);
  }

  return {
    valid,
    issues,
  };
};