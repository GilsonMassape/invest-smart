import { useMemo } from 'react'
import type {
  ContributionSuggestion,
  MacroScenario,
  PortfolioPosition,
  RankedAsset,
  RebalanceSuggestion,
  RiskProfile,
} from '../domain/types'
import { ASSETS } from '../data/assets'
import { buildContribution } from '../engine/contribution/buildContribution'
import {
  buildPortfolio,
  buildPortfolioAssetMap,
  calculateTotalInvested,
  type PortfolioItem,
} from '../engine/portfolio/buildPortfolio'
import { buildSafePreferences } from '../engine/preferences/buildSafePreferences'
import { buildRanking } from '../engine/ranking/buildRanking'
import { buildRebalance } from '../engine/rebalance/buildRebalance'

type InputState = {
  positions: PortfolioPosition[]
  preferences: {
    riskProfile: RiskProfile
    macroScenario: MacroScenario
  }
}

type UsePortfolioDataResult = {
  ranking: RankedAsset[]
  portfolio: PortfolioItem[]
  totalInvested: number
  contribution: ContributionSuggestion[]
  rebalance: RebalanceSuggestion[]
  alerts: string[]
}

function buildAlerts(rebalance: RebalanceSuggestion[]): string[] {
  return rebalance
    .filter((item) => item.action === 'REDUZIR')
    .map((item) => `Alta concentração em ${item.ticker}`)
}

export const usePortfolioData = (
  state: InputState
): UsePortfolioDataResult => {
  const assetMap = useMemo(() => buildPortfolioAssetMap(ASSETS), [])

  const portfolio = useMemo(
    () => buildPortfolio(state.positions, assetMap),
    [state.positions, assetMap]
  )

  const totalInvested = useMemo(
    () => calculateTotalInvested(state.positions),
    [state.positions]
  )

  const safePreferences = useMemo(
    () => buildSafePreferences(state.preferences),
    [state.preferences]
  )

  const ranking = useMemo(
    () => buildRanking(ASSETS, state.positions, safePreferences),
    [state.positions, safePreferences]
  )

  const contribution = useMemo(
    () => buildContribution(ranking),
    [ranking]
  )

  const rebalance = useMemo(
    () => buildRebalance(ranking),
    [ranking]
  )

  const alerts = useMemo(
    () => buildAlerts(rebalance),
    [rebalance]
  )

  return {
    ranking,
    portfolio,
    totalInvested,
    contribution,
    rebalance,
    alerts,
  }
}