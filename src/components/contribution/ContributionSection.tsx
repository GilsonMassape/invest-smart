import { useId, useMemo } from 'react';
import type { ContributionSuggestion, TagKey } from '../../domain/types';

const TAG_UI: Record<TagKey, { label: string; color: string }> = {
  strongBuy: { label: 'Forte Compra', color: '#16a34a' },
  highConfidence: { label: 'Alta confiança', color: '#2563eb' },
  underweight: { label: 'Subalocado', color: '#d97706' },
};

const EPSILON = 0.01;

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const sanitizeMoney = (value: unknown): number =>
  isFiniteNumber(value) && value >= 0 ? Number(value.toFixed(2)) : 0;

const sanitizeInteger = (value: unknown): number =>
  Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;

type Props = {
  monthlyContribution: number;
  contribution: ContributionSuggestion[];
  onContributionChange: (value: number) => void;
};

type SanitizedContributionItem = Omit<ContributionSuggestion, 'tags' | 'rationale'> & {
  suggestedAmount: number;
  suggestedShares: number;
  tags: TagKey[];
  rationale: string;
};

type DistributionStatus =
  | { kind: 'empty'; message: string; tone: 'neutral' }
  | { kind: 'complete'; message: string; tone: 'success' }
  | { kind: 'residual'; message: string; tone: 'warning' }
  | { kind: 'inconsistent'; message: string; tone: 'danger' };

const getStatusColor = (tone: DistributionStatus['tone']) => {
  switch (tone) {
    case 'success':
      return '#166534';
    case 'warning':
      return '#b45309';
    case 'danger':
      return '#b91c1c';
    default:
      return '#6b7280';
  }
};

const getStatusBackground = (tone: DistributionStatus['tone']) => {
  switch (tone) {
    case 'success':
      return '#f0fdf4';
    case 'warning':
      return '#fffbeb';
    case 'danger':
      return '#fef2f2';
    default:
      return '#f3f4f6';
  }
};

const sanitizeContributionItem = (
  item: ContributionSuggestion | null | undefined
): SanitizedContributionItem | null => {
  if (!item?.ticker) {
    return null;
  }

  const suggestedAmount = sanitizeMoney(item.suggestedAmount);
  const suggestedShares = sanitizeInteger(item.suggestedShares);

  if (suggestedAmount <= 0 || suggestedShares <= 0) {
    return null;
  }

  return {
    ...item,
    suggestedAmount,
    suggestedShares,
    tags: Array.isArray(item.tags) ? item.tags : [],
    rationale: typeof item.rationale === 'string' ? item.rationale.trim() : '',
  };
};

const getEstimatedUnitPrice = (item: SanitizedContributionItem): number =>
  item.suggestedShares > 0
    ? Number((item.suggestedAmount / item.suggestedShares).toFixed(2))
    : 0;

const buildDistributionStatus = (
  monthlyContribution: number,
  totalSuggested: number,
  minAllocableTicket: number,
  hasSuggestions: boolean
): DistributionStatus => {
  if (!hasSuggestions) {
    return {
      kind: 'empty',
      tone: 'neutral',
      message: 'Nenhuma sugestão elegível para o aporte informado.',
    };
  }

  const residual = Number((monthlyContribution - totalSuggested).toFixed(2));

  if (Math.abs(residual) <= EPSILON) {
    return {
      kind: 'complete',
      tone: 'success',
      message: 'Aporte totalmente distribuído.',
    };
  }

  if (
    residual > EPSILON &&
    minAllocableTicket > 0 &&
    residual + EPSILON < minAllocableTicket
  ) {
    return {
      kind: 'residual',
      tone: 'warning',
      message: `Saldo residual não alocável: ${formatBRL(residual)}.`,
    };
  }

  return {
    kind: 'inconsistent',
    tone: 'danger',
    message: `Inconsistência na distribuição: diferença de ${formatBRL(
      Math.abs(residual)
    )}.`,
  };
};

export const ContributionSection = ({
  monthlyContribution,
  contribution,
  onContributionChange,
}: Props) => {
  const inputId = useId();

  const normalizedContribution = useMemo(() => {
    if (!Array.isArray(contribution)) {
      return [];
    }

    return contribution
      .map(sanitizeContributionItem)
      .filter((item): item is SanitizedContributionItem => item !== null);
  }, [contribution]);

  const totalSuggested = useMemo(
    () =>
      Number(
        normalizedContribution
          .reduce((acc, item) => acc + item.suggestedAmount, 0)
          .toFixed(2)
      ),
    [normalizedContribution]
  );

  const minAllocableTicket = useMemo(() => {
    if (normalizedContribution.length === 0) {
      return 0;
    }

    return normalizedContribution.reduce((min, item) => {
      const unitPrice = getEstimatedUnitPrice(item);

      if (unitPrice <= 0) {
        return min;
      }

      if (min === 0) {
        return unitPrice;
      }

      return Math.min(min, unitPrice);
    }, 0);
  }, [normalizedContribution]);

  const distributionStatus = useMemo(
    () =>
      buildDistributionStatus(
        sanitizeMoney(monthlyContribution),
        totalSuggested,
        minAllocableTicket,
        normalizedContribution.length > 0
      ),
    [
      monthlyContribution,
      totalSuggested,
      minAllocableTicket,
      normalizedContribution.length,
    ]
  );

  const handleContributionInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const rawValue = event.target.valueAsNumber;

    if (!Number.isFinite(rawValue)) {
      onContributionChange(0);
      return;
    }

    if (rawValue < 0) {
      return;
    }

    onContributionChange(rawValue);
  };

  const hasSuggestions = normalizedContribution.length > 0;

  return (
    <section className="card">
      <h2>Simulação de aporte</h2>
      <p className="muted">
        Distribuição otimizada baseada em score, restrições e alocação atual.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor={inputId}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontWeight: 600,
          }}
        >
          Aporte mensal
          <input
            id={inputId}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={monthlyContribution}
            onChange={handleContributionInputChange}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: 16,
              width: 220,
            }}
          />
        </label>

        <div
          style={{
            marginTop: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div className="mini muted">
            Total distribuído: {formatBRL(totalSuggested)}
          </div>

          <div
            style={{
              color: getStatusColor(distributionStatus.tone),
              background: getStatusBackground(distributionStatus.tone),
              borderRadius: 999,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {distributionStatus.message}
          </div>
        </div>
      </div>

      {!hasSuggestions ? (
        <p className="muted">Nenhuma sugestão disponível.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Valor sugerido</th>
              <th>Quantidade</th>
              <th>Peso no aporte</th>
              <th>Justificativa</th>
            </tr>
          </thead>

          <tbody>
            {normalizedContribution.map((item) => {
              const weight =
                totalSuggested > 0
                  ? (item.suggestedAmount / totalSuggested) * 100
                  : 0;

              const hasTags = item.tags.length > 0;
              const hasRationale = Boolean(item.rationale);

              return (
                <tr key={item.ticker}>
                  <td>
                    <strong>{item.ticker}</strong>
                  </td>

                  <td>{formatBRL(item.suggestedAmount)}</td>

                  <td>{item.suggestedShares}</td>

                  <td>{formatPercent(weight)}</td>

                  <td style={{ maxWidth: 420 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      {hasTags &&
                        item.tags.map((tagKey) => {
                          const tag = TAG_UI[tagKey];

                          if (!tag) {
                            return null;
                          }

                          return (
                            <span
                              key={`${item.ticker}-${tagKey}`}
                              style={{
                                backgroundColor: `${tag.color}15`,
                                color: tag.color,
                                padding: '4px 8px',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {tag.label}
                            </span>
                          );
                        })}

                      {hasRationale ? (
                        <span className="muted">{item.rationale}</span>
                      ) : !hasTags ? (
                        <span className="muted">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};