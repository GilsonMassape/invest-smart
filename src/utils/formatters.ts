export const formatCurrency = (value: unknown): string => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 'R$ 0,00';
  }

  return `R$ ${numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatCurrencyShort = (value: unknown): string => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 'R$ 0';
  }

  return `R$ ${numericValue.toLocaleString('pt-BR')}`;
};

export const formatPercentage = (
  value: unknown,
  fractionDigits = 2,
): string => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fractionDigits === 1 ? '0.0%' : '0.00%';
  }

  return `${numericValue.toFixed(fractionDigits)}%`;
};