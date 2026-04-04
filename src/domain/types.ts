export type AssetType = 'AÇÃO' | 'FII' | 'ETF' | 'BDR';

export type RiskProfile = 'CONSERVADOR' | 'EQUILIBRADO' | 'ARROJADO';

export type MacroScenario =
  | 'NEUTRO'
  | 'JUROS_ALTOS'
  | 'CRESCIMENTO'
  | 'INFLACAO';

export type ConfidenceLevel = 'ALTA' | 'MÉDIA' | 'BAIXA';

/* 🔥 NÃO QUEBRE O PADRÃO ORIGINAL */
export type DecisionAction =
  | 'COMPRAR_FORTE'
  | 'COMPRAR'
  | 'REDUZIR'
  | 'EVITAR';

export type DecisionConfidence = ConfidenceLevel;

export type RebalanceAction = 'COMPRAR' | 'REDUZIR' | 'MANTER';

export type FilterType = AssetType | 'TODOS';

/* 🔥 MANTÉM OS EXISTENTES + ADICIONA OS FALTANTES */
export type TagKey =
  | 'strongBuy'
  | 'highConfidence'
  | 'underweight'
  | 'overweight'
  | 'international'
  | 'dividend'
  | 'quality'
  | 'growth'
  | 'resilience'
  | 'balanced'
  | 'rebalance'
  | 'opportunity';

export interface Preferences {
  riskProfile: RiskProfile;
  macroScenario: MacroScenario;
  preferredTypes: AssetType[];
  blockedTickers: string[];
}

export interface PortfolioPosition {
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number | null;
}

export interface Asset {
  ticker: string;
  name: string;
  type: AssetType;
  sector: string;
  price: number;
  dividendYield?: number;
  quality: number;
  growth: number;
  resilience: number;
  governance: number;
  exposureIntl?: boolean;
}

export interface ScoreBreakdown {
  baseScore: number;
  preferenceBonus: number;
  macroAdjustment: number;
  concentrationPenalty: number;
  finalScore: number;
  weight: number;
  recommendation: string;
  confidence: ConfidenceLevel;
  reasons: string[];
  breakdown?: {
    macro: number;
    profile: number;
    concentration: number;
  };
  rationale?: string[];
}

export interface RankedAsset {
  ticker: string;
  name: string;
  type: AssetType;
  sector: string;
  price: number;
  score: ScoreBreakdown;
  percentile: number;
  currentAllocationPct: number;
  ownedQuantity: number;
  currentMarketValue: number;
  safeCurrentValue: number;
  tags?: TagKey[];
}

/* 🔥 NÃO ALTERAR ESTRUTURA, SÓ GARANTIR CAMPOS */
export interface ContributionSuggestion {
  ticker: string;
  suggestedAmount: number;
  suggestedShares?: number;
  rationale?: string;
  reason?: string;
  tags?: TagKey[];
}

/* 🔥 AQUI FOI ONDE QUEBROU ANTES */
export interface RebalanceSuggestion {
  ticker: string;
  action: RebalanceAction;
  currentValue: number;
  currentPct: number;
  targetValue?: number;
  targetPct: number;
  diffValue: number;
  deltaValue?: number;
}

/* 🔥 SÓ ADICIONA, NÃO REMOVE NADA */
export interface Decision {
  ticker: string;
  action: DecisionAction;
  confidence?: DecisionConfidence;
  reason?: string;
}

export interface AppState {
  positions: PortfolioPosition[];
  preferences: Preferences;
  monthlyContribution: number;
  filterType: FilterType;
}