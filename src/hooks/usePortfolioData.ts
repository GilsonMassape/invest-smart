import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import * as priceServiceModule from '../services/priceService'
import { fetchPrices as fetchRemotePrices } from '../infra/pricing/fetchPrices'

type InputState = {
  positions: PortfolioPosition[]
  preferences: {
    riskProfile: RiskProfile
    macroScenario: MacroScenario
  }
}

type PriceStatus = 'idle' | 'loading' | 'success' | 'error'

type UsePortfolioDataResult = {
  ranking: RankedAsset[]
  portfolio: PortfolioItem[]
  totalInvested: number
  contribution: ContributionSuggestion[]
  rebalance: RebalanceSuggestion[]
  alerts: string[]
  priceStatus: PriceStatus
  priceError: string | null
  lastPriceUpdateAt: number | null
  refreshPrices: () => Promise<void>
}

type MarketPriceMap = Record<string, number>

type PriceLoader = (tickers: string[]) => Promise<MarketPriceMap>

const PRICE_REFRESH_INTERVAL_MS = 5 * 60 * 1000

function buildAlerts(rebalance: RebalanceSuggestion[]): string[] {
  return rebalance
    .filter((item) => item.action === 'REDUZIR')
    .map((item) => `Alta concentração em ${item.ticker}`)
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function buildTrackedTickers(positions: readonly PortfolioPosition[]): string[] {
  const unique = new Set<string>()

  for (const position of positions) {
    const ticker = normalizeTicker(position.ticker)

    if (ticker) {
      unique.add(ticker)
    }
  }

  return Array.from(unique).sort()
}

function buildTrackedTickersKey(tickers: readonly string[]): string {
  return tickers.join('|')
}

function sanitizePriceMap(input: unknown): MarketPriceMap {
  if (!input || typeof input !== 'object') {
    return {}
  }

  const output: MarketPriceMap = {}

  for (const [ticker, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      output[normalizeTicker(ticker)] = value
      continue
    }

    if (value && typeof value === 'object') {
      const nestedRecord = value as Record<string, unknown>
      const nestedCandidates = [
        nestedRecord.price,
        nestedRecord.currentPrice,
        nestedRecord.close,
        nestedRecord.last,
        nestedRecord.value,
        nestedRecord.regularMarketPrice,
        nestedRecord.c,
      ]

      for (const candidate of nestedCandidates) {
        if (
          typeof candidate === 'number' &&
          Number.isFinite(candidate) &&
          candidate > 0
        ) {
          output[normalizeTicker(ticker)] = candidate
          break
        }
      }
    }
  }

  return output
}

function isPriceLoader(value: unknown): value is PriceLoader {
  return typeof value === 'function'
}

async function fetchPricesFromInfra(tickers: string[]): Promise<MarketPriceMap> {
  const result = await fetchRemotePrices(tickers)
  return sanitizePriceMap(result)
}

function resolvePriceLoader(): PriceLoader {
  const moduleRecord = priceServiceModule as Record<string, unknown>
  const defaultExport =
    'default' in moduleRecord &&
    moduleRecord.default &&
    typeof moduleRecord.default === 'object'
      ? (moduleRecord.default as Record<string, unknown>)
      : undefined

  const candidates: unknown[] = [
    moduleRecord.getPrices,
    moduleRecord.loadPrices,
    moduleRecord.fetchPrices,
    moduleRecord.getLatestPrices,
    moduleRecord.resolvePrices,
    defaultExport?.getPrices,
    defaultExport?.loadPrices,
    defaultExport?.fetchPrices,
    defaultExport?.getLatestPrices,
    defaultExport?.resolvePrices,
  ]

  for (const candidate of candidates) {
    if (isPriceLoader(candidate)) {
      return candidate
    }
  }

  return fetchPricesFromInfra
}

function getAssetFallbackPrice(asset: unknown): number {
  if (!asset || typeof asset !== 'object') {
    return 0
  }

  const record = asset as Record<string, unknown>
  const candidates = [
    record.currentPrice,
    record.price,
    record.marketPrice,
    record.lastPrice,
    record.closePrice,
    record.avgPrice,
  ]

  for (const candidate of candidates) {
    if (
      typeof candidate === 'number' &&
      Number.isFinite(candidate) &&
      candidate > 0
    ) {
      return candidate
    }
  }

  return 0
}

function resolveCurrentPrice(
  ticker: string,
  livePrices: MarketPriceMap,
  fallbackPrice: number
): number {
  const livePrice = livePrices[normalizeTicker(ticker)]

  if (
    typeof livePrice === 'number' &&
    Number.isFinite(livePrice) &&
    livePrice > 0
  ) {
    return livePrice
  }

  return fallbackPrice
}

function buildPriceErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Falha ao atualizar preços.'
}

export const usePortfolioData = (
  state: InputState
): UsePortfolioDataResult => {
  const [livePrices, setLivePrices] = useState<MarketPriceMap>({})
  const [priceStatus, setPriceStatus] = useState<PriceStatus>('idle')
  const [priceError, setPriceError] = useState<string | null>(null)
  const [lastPriceUpdateAt, setLastPriceUpdateAt] = useState<number | null>(null)

  const requestIdRef = useRef(0)
  const priceLoaderRef = useRef<PriceLoader>(resolvePriceLoader())

  const trackedTickers = useMemo(
    () => buildTrackedTickers(state.positions),
    [state.positions]
  )

  const trackedTickersKey = useMemo(
    () => buildTrackedTickersKey(trackedTickers),
    [trackedTickers]
  )

  const trackedTickersRef = useRef<string[]>(trackedTickers)

  useEffect(() => {
    trackedTickersRef.current = trackedTickers
  }, [trackedTickersKey])

  const refreshPrices = useCallback(async (): Promise<void> => {
    const currentTickers = trackedTickersRef.current

    if (currentTickers.length === 0) {
      setLivePrices({})
      setPriceStatus('idle')
      setPriceError(null)
      setLastPriceUpdateAt(null)
      return
    }

    const currentRequestId = ++requestIdRef.current

    setPriceStatus((previous) =>
      previous === 'success' ? 'success' : 'loading'
    )
    setPriceError(null)

    try {
      const fetchedPrices = await priceLoaderRef.current(currentTickers)
      const sanitizedPrices = sanitizePriceMap(fetchedPrices)

      if (currentRequestId !== requestIdRef.current) {
        return
      }

      if (Object.keys(sanitizedPrices).length === 0) {
        setPriceStatus((previous) =>
          previous === 'success' ? 'success' : 'error'
        )
        setPriceError('Nenhum preço válido retornado.')
        return
      }

      setLivePrices((previous) => ({
        ...previous,
        ...sanitizedPrices,
      }))
      setPriceStatus('success')
      setPriceError(null)
      setLastPriceUpdateAt(Date.now())
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) {
        return
      }

      setPriceStatus((previous) =>
        previous === 'success' ? 'success' : 'error'
      )
      setPriceError(buildPriceErrorMessage(error))
    }
  }, [trackedTickersKey])

  useEffect(() => {
    if (trackedTickersKey.length === 0) {
      setLivePrices({})
      setPriceStatus('idle')
      setPriceError(null)
      setLastPriceUpdateAt(null)
      return
    }

    void refreshPrices()

    const intervalId = window.setInterval(() => {
      void refreshPrices()
    }, PRICE_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [trackedTickersKey, refreshPrices])

  const pricedAssets = useMemo(
    () =>
      ASSETS.map((asset) => {
        const fallbackPrice = getAssetFallbackPrice(asset)
        const currentPrice = resolveCurrentPrice(
          asset.ticker,
          livePrices,
          fallbackPrice
        )

        return {
          ...asset,
          currentPrice,
        }
      }),
    [livePrices]
  )

  const assetMap = useMemo(
    () => buildPortfolioAssetMap(pricedAssets),
    [pricedAssets]
  )

  const portfolio = useMemo(
    () => buildPortfolio(state.positions, assetMap),
    [state.positions, assetMap]
  )

  const totalInvested = useMemo(
    () => calculateTotalInvested(state.positions),
    [state.positions]
  )

  const safePreferences = useMemo(
    () =>
      buildSafePreferences({
        riskProfile: state.preferences.riskProfile,
        macroScenario: state.preferences.macroScenario,
      }),
    [state.preferences.riskProfile, state.preferences.macroScenario]
  )

  const ranking = useMemo(
    () => buildRanking(pricedAssets, state.positions, safePreferences),
    [pricedAssets, state.positions, safePreferences]
  )

  const contribution = useMemo(() => buildContribution(ranking), [ranking])

  const rebalance = useMemo(() => buildRebalance(ranking), [ranking])

  const alerts = useMemo(() => buildAlerts(rebalance), [rebalance])

  return {
    ranking,
    portfolio,
    totalInvested,
    contribution,
    rebalance,
    alerts,
    priceStatus,
    priceError,
    lastPriceUpdateAt,
    refreshPrices,
  }
}