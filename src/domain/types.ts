export type AssetType = 'AÇÃO' | 'FII' | 'ETF' | 'BDR';

export type RiskProfile = 'CONSERVADOR' | 'EQUILIBRADO' | 'ARROJADO';

export type MacroScenario =
  | 'NEUTRO'
  | 'JUROS_ALTOS'
  | 'CRESCIMENTO'
  | 'INFLACAO';

export type FilterType = 'TODOS' | AssetType;

export interface PortfolioPosition {
  ticker: string;
  quantity: number;
  avgPrice: number;
}

export interface Preferences {
  riskProfile: RiskProfile;
  macroScenario: MacroScenario;
  preferredTypes: AssetType[];
  blockedTickers: string[];
}

export interface AppState {
  positions: PortfolioPosition[];
  monthlyContribution: number;
  filterType: FilterType;
  preferences: Preferences;
}

export interface Asset {
  ticker: string;
  name: string;
  type: AssetType;
  sector: string;
  price: number;
  quality: number;
  growth: number;
  resilience: number;
  governance: number;
  dividendYield?: number;
  exposureIntl?: boolean;
  thesis?: string;
}

export interface ScoreBreakdownDetail {
  macro: number;
  profile: number;
  concentration: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  preferenceBonus: number;
  macroAdjustment: number;
  concentrationPenalty: number;
  finalScore: number;
  weight: number;
  recommendation: string;
  confidence: string;
  reasons: string[];
  rationale?: string[];
  breakdown?: ScoreBreakdownDetail;
}

export interface RankedAsset extends Asset {
  score: ScoreBreakdown;
  ownedQuantity: number;
  currentMarketValue: number;
  currentAllocationPct: number;
  percentile?: number;
}

export type TagKey = 'strongBuy' | 'highConfidence' | 'underweight';

export interface ContributionSuggestion {
  ticker: string;
  suggestedAmount: number;
  suggestedShares?: number;
  amount?: number;
  rationale: string;
  quantity?: number;
  tags?: TagKey[];
}

export type RebalanceAction = 'COMPRAR' | 'REDUZIR' | 'MANTER';

export interface RebalanceSuggestion {
  ticker: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  diffValue: number;
  action: RebalanceAction;
}