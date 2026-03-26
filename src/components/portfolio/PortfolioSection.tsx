import { useMemo, useState } from 'react';
import { Card } from '../common/Card';
import { getAssetTypeLabel, getSectorLabel } from '../../utils/labels';
import { toMoney, toPercent } from '../../utils/number';
import type { PortfolioPosition } from '../../domain/types';

interface PortfolioRow extends PortfolioPosition {
  price: number;
  marketValue: number;
  profit: number;
  allocationPct: number;
  sector: string;
  type: 'AÇÃO' | 'FII' | 'ETF' | 'BDR';
}

interface Props {
  portfolio: PortfolioRow[];
  onUpsertPosition: (position: PortfolioPosition) => void;
  onRemovePosition: (ticker: string) => void;
}

interface SectorDistributionItem {
  sector: string;
  value: number;
  pct: number;
}

const LINE_PATTERN =
  /^([A-Z0-9]{4,6}(?:11|3|4|5|6|31|34|39|54)?)\s+(\d+(?:[.,]\d+)?)$/i;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const sanitizeTicker = (ticker: string): string => ticker.trim().toUpperCase();

const sanitizeQuantity = (value: unknown): number => {
  if (!isFiniteNumber(value) || value <= 0) return 0;
  return value;
};

const sanitizePortfolioRow = (row: PortfolioRow): PortfolioRow | null => {
  if (!row?.ticker) return null;
  if (!isFiniteNumber(row.marketValue) || row.marketValue < 0) return null;
  if (!isFiniteNumber(row.allocationPct) || row.allocationPct < 0) return null;
  if (!isFiniteNumber(row.quantity) || row.quantity < 0) return null;
  if (!isFiniteNumber(row.price) || row.price < 0) return null;
  if (!isFiniteNumber(row.profit)) return null;

  return {
    ...row,
    ticker: sanitizeTicker(row.ticker),
  };
};

const sortPortfolioByMarketValueDesc = (
  left: PortfolioRow,
  right: PortfolioRow
): number => right.marketValue - left.marketValue;

const buildSafePortfolio = (portfolio: PortfolioRow[]): PortfolioRow[] =>
  portfolio
    .map(sanitizePortfolioRow)
    .filter((item): item is PortfolioRow => item !== null)
    .sort(sortPortfolioByMarketValueDesc);

const calculateTotalValue = (portfolio: PortfolioRow[]): number =>
  portfolio.reduce((acc, item) => acc + item.marketValue, 0);

const buildTopPositions = (portfolio: PortfolioRow[]): PortfolioRow[] =>
  portfolio.slice(0, 3);

const calculateTop3Concentration = (
  topPositions: PortfolioRow[],
  totalValue: number
): number => {
  if (totalValue <= 0) return 0;

  const topValue = topPositions.reduce((acc, item) => acc + item.marketValue, 0);
  return topValue / totalValue;
};

const buildSectorDistribution = (
  portfolio: PortfolioRow[],
  totalValue: number
): SectorDistributionItem[] => {
  const sectorTotals = portfolio.reduce<Record<string, number>>((acc, item) => {
    acc[item.sector] = (acc[item.sector] ?? 0) + item.marketValue;
    return acc;
  }, {});

  return Object.entries(sectorTotals)
    .map(([sector, value]) => ({
      sector,
      value,
      pct: totalValue > 0 ? value / totalValue : 0,
    }))
    .sort((left, right) => right.value - left.value);
};

const parseValidLines = (text: string): PortfolioPosition[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(LINE_PATTERN);

      if (!match) return null;

      const [, rawTicker, rawQuantity] = match;
      const quantity = Number(rawQuantity.replace(',', '.'));

      if (!rawTicker || !isFiniteNumber(quantity) || quantity <= 0) {
        return null;
      }

      return {
        ticker: sanitizeTicker(rawTicker),
        quantity,
        avgPrice: 0,
      } satisfies PortfolioPosition;
    })
    .filter((item): item is PortfolioPosition => item !== null);

export const PortfolioSection = ({
  portfolio,
  onUpsertPosition,
  onRemovePosition,
}: Props) => {
  const [bulkText, setBulkText] = useState('');
  const [importFeedback, setImportFeedback] = useState('');

  const safePortfolio = useMemo(() => buildSafePortfolio(portfolio), [portfolio]);

  const totalValue = useMemo(
    () => calculateTotalValue(safePortfolio),
    [safePortfolio]
  );

  const topPositions = useMemo(
    () => buildTopPositions(safePortfolio),
    [safePortfolio]
  );

  const concentrationTop3 = useMemo(
    () => calculateTop3Concentration(topPositions, totalValue),
    [topPositions, totalValue]
  );

  const sectorDistribution = useMemo(
    () => buildSectorDistribution(safePortfolio, totalValue),
    [safePortfolio, totalValue]
  );

  const handleImport = () => {
    const parsedPositions = parseValidLines(bulkText);

    if (parsedPositions.length === 0) {
      setImportFeedback('Nenhuma linha válida encontrada.');
      return;
    }

    parsedPositions.forEach(onUpsertPosition);

    setImportFeedback(`${parsedPositions.length} ativo(s) importado(s).`);
    setBulkText('');
  };

  const hasPortfolio = safePortfolio.length > 0;
  const hasSectorDistribution = sectorDistribution.length > 0;

  return (
    <Card
      title="Carteira"
      subtitle="Visão consolidada, concentração e distribuição por setor"
    >
      <div style={{ marginBottom: 16 }}>
        <strong>Total investido:</strong> {toMoney(totalValue)}
        <br />
        <strong>Concentração Top 3:</strong> {toPercent(concentrationTop3)}
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Distribuição por setor:</strong>
        <div className="mini muted" style={{ marginTop: 6 }}>
          {hasSectorDistribution ? (
            sectorDistribution.map((item) => (
              <div key={item.sector}>
                {getSectorLabel(item.sector)}: {toPercent(item.pct)}
              </div>
            ))
          ) : (
            <div>Sem posições para consolidar.</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <textarea
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={'WEGE3 10\nITSA4 20\nHGLG11 5'}
          style={{ width: '100%', marginBottom: 10, minHeight: 120 }}
        />

        <button onClick={handleImport}>Importar</button>

        {importFeedback && <div style={{ marginTop: 8 }}>{importFeedback}</div>}
      </div>

      {!hasPortfolio ? (
        <div className="muted">Nenhuma posição cadastrada.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Tipo</th>
              <th>Setor</th>
              <th>Qtd</th>
              <th>Preço</th>
              <th>Valor</th>
              <th>Alocação</th>
              <th>Resultado</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {safePortfolio.map((item) => (
              <tr key={item.ticker}>
                <td>
                  <strong>{item.ticker}</strong>
                </td>
                <td>{getAssetTypeLabel(item.type)}</td>
                <td>{getSectorLabel(item.sector)}</td>
                <td>{sanitizeQuantity(item.quantity)}</td>
                <td>{toMoney(item.price)}</td>
                <td>{toMoney(item.marketValue)}</td>
                <td>{toPercent(item.allocationPct)}</td>
                <td>{toMoney(item.profit)}</td>
                <td>
                  <button onClick={() => onRemovePosition(item.ticker)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
};