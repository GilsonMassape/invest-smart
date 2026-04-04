import type { Asset, PortfolioPosition } from '../../domain/types'

export type PortfolioAssetMap = Map<string, Asset>

export type PortfolioItem = PortfolioPosition & {
  name: string
  type: Asset['type']
  sector: string
  price: number
  marketPrice: number
  marketValue: number
  profit: number
  allocationPct: number
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

export function buildPortfolioAssetMap(assets: Asset[]): PortfolioAssetMap {
  return new Map(assets.map((asset) => [normalizeTicker(asset.ticker), asset]))
}

function getAsset(
  ticker: string,
  assetMap: PortfolioAssetMap
): Asset | undefined {
  return assetMap.get(normalizeTicker(ticker))
}

function resolveMarketPrice(
  position: PortfolioPosition,
  asset?: Asset
): number {
  return asset?.price ?? position.currentPrice ?? position.avgPrice
}

export function buildPortfolio(
  positions: PortfolioPosition[],
  assetMap: PortfolioAssetMap
): PortfolioItem[] {
  if (!Array.isArray(positions) || positions.length === 0) {
    return []
  }

  const baseItems: PortfolioItem[] = positions.map((position) => {
    const asset = getAsset(position.ticker, assetMap)

    const quantity = toSafeNumber(position.quantity)
    const avgPrice = toSafeNumber(position.avgPrice)
    const marketPrice = toSafeNumber(resolveMarketPrice(position, asset))
    const marketValue = quantity * marketPrice
    const profit = (marketPrice - avgPrice) * quantity

    return {
      ...position,
      name: asset?.name ?? position.ticker,
      type: asset?.type ?? 'AÇÃO',
      sector: asset?.sector ?? 'N/A',
      price: marketPrice,
      marketPrice,
      marketValue,
      profit,
      allocationPct: 0,
    }
  })

  const totalMarketValue = baseItems.reduce(
    (sum, item) => sum + item.marketValue,
    0
  )

  return baseItems.map((item) => ({
    ...item,
    allocationPct:
      totalMarketValue > 0 ? (item.marketValue / totalMarketValue) * 100 : 0,
  }))
}

export function calculateTotalInvested(
  positions: PortfolioPosition[]
): number {
  if (!Array.isArray(positions) || positions.length === 0) {
    return 0
  }

  return positions.reduce(
    (sum, position) =>
      sum +
      toSafeNumber(position.quantity) * toSafeNumber(position.avgPrice),
    0
  )
}