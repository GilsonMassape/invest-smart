import type { AppState } from '../domain/types'

export const DEFAULT_STATE: AppState = {
  positions: [
    {
      ticker: 'ITUB4',
      quantity: 40,
      avgPrice: 31.15,
      currentPrice: 33.8,
    },
    {
      ticker: 'HGLG11',
      quantity: 10,
      avgPrice: 158.1,
      currentPrice: 161.9,
    },
    {
      ticker: 'IVVB11',
      quantity: 4,
      avgPrice: 295,
      currentPrice: 312.7,
    },
  ],
  preferences: {
    riskProfile: 'EQUILIBRADO',
    macroScenario: 'NEUTRO',
    preferredTypes: ['AÇÃO', 'FII', 'ETF', 'BDR'],
    blockedTickers: [],
  },
  monthlyContribution: 2000,
  filterType: 'TODOS',
}