export type AssetType = 'AÇÃO' | 'FII' | 'ETF' | 'BDR'
export type ValuationBasis = 'MARKET_PRICE'

export interface PortfolioPosition {
  ticker: string
  quantity: number
  avgPrice: number
  currentPrice?: number | null
  assetType?: AssetType | null
  label?: string | null
}

export interface PositionValuationInput {
  ticker: string
  quantity: number
  avgPrice: number
  currentPrice?: number | null
  assetType?: AssetType | null
  label?: string | null
}

export interface ValuedPosition {
  ticker: string
  label: string
  assetType: AssetType | 'OUTROS'
  quantity: number
  avgPrice: number
  currentPrice: number | null
  positionValue: number
  investedValue: number
  resultValue: number
}

export interface DistributionByTypeItem {
  type: AssetType | 'OUTROS'
  label: string
  value: number
  percentage: number
}

export interface DistributionByAssetItem {
  ticker: string
  label: string
  type: AssetType | 'OUTROS'
  quantity: number
  avgPrice: number
  currentPrice: number | null
  value: number
  investedValue: number
  resultValue: number
  percentage: number
}

export interface ConcentrationDataItem {
  ticker: string
  label: string
  value: number
  percentage: number
}

export interface PortfolioAggregationResult {
  valuationBasis: ValuationBasis
  totalInvested: number
  totalPatrimony: number
  totalPositions: number
  valuedPositions: ValuedPosition[]
  distributionByType: DistributionByTypeItem[]
  distributionByAsset: DistributionByAssetItem[]
  concentrationData: ConcentrationDataItem[]
}

const DEFAULT_ASSET_LABEL = 'Sem nome'
const DEFAULT_ASSET_TYPE: 'OUTROS' = 'OUTROS'

function toSafeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTicker(value: unknown): string {
  return toSafeString(value).toUpperCase()
}

function normalizeAssetType(
  value: AssetType | null | undefined
): AssetType | 'OUTROS' {
  return value ?? DEFAULT_ASSET_TYPE
}

function normalizeLabel(input: {
  ticker: string
  label?: string | null
}): string {
  const ticker = normalizeTicker(input.ticker)
  const label = toSafeString(input.label)

  if (ticker) return ticker
  if (label) return label

  return DEFAULT_ASSET_LABEL
}

function getInvestedValue(position: PositionValuationInput): number {
  const quantity = toSafeNumber(position.quantity)
  const avgPrice = toSafeNumber(position.avgPrice)

  if (quantity <= 0 || avgPrice <= 0) {
    return 0
  }

  return quantity * avgPrice
}

export function getPositionValue(position: PositionValuationInput): number {
  const quantity = toSafeNumber(position.quantity)
  const avgPrice = toSafeNumber(position.avgPrice)
  const currentPrice = toSafeNumber(position.currentPrice)

  if (quantity <= 0) {
    return 0
  }

  if (currentPrice > 0) {
    return quantity * currentPrice
  }

  if (avgPrice > 0) {
    return quantity * avgPrice
  }

  return 0
}

export function toValuedPosition(position: PortfolioPosition): ValuedPosition {
  const ticker = normalizeTicker(position.ticker)
  const quantity = toSafeNumber(position.quantity)
  const avgPrice = toSafeNumber(position.avgPrice)
  const currentPrice =
    typeof position.currentPrice === 'number' &&
    Number.isFinite(position.currentPrice) &&
    position.currentPrice > 0
      ? position.currentPrice
      : null

  const investedValue = getInvestedValue({
    ticker,
    label: position.label,
    quantity,
    avgPrice,
    currentPrice,
    assetType: position.assetType,
  })

  const positionValue = getPositionValue({
    ticker,
    label: position.label,
    quantity,
    avgPrice,
    currentPrice,
    assetType: position.assetType,
  })

  return {
    ticker,
    label: normalizeLabel({
      ticker,
      label: position.label,
    }),
    assetType: normalizeAssetType(position.assetType),
    quantity,
    avgPrice,
    currentPrice,
    investedValue,
    positionValue,
    resultValue: positionValue - investedValue,
  }
}

function calculatePercentage(value: number, total: number): number {
  if (total <= 0) return 0
  return (value / total) * 100
}

function aggregateByType(
  valuedPositions: ValuedPosition[],
  totalPatrimony: number
): DistributionByTypeItem[] {
  const grouped = new Map<AssetType | 'OUTROS', number>()

  for (const position of valuedPositions) {
    const previous = grouped.get(position.assetType) ?? 0
    grouped.set(position.assetType, previous + position.positionValue)
  }

  return Array.from(grouped.entries())
    .map(([type, value]) => ({
      type,
      label: type,
      value,
      percentage: calculatePercentage(value, totalPatrimony),
    }))
    .sort((a, b) => b.value - a.value)
}

function aggregateByAsset(
  valuedPositions: ValuedPosition[],
  totalPatrimony: number
): DistributionByAssetItem[] {
  return valuedPositions
    .map((position) => ({
      ticker: position.ticker,
      label: position.label,
      type: position.assetType,
      quantity: position.quantity,
      avgPrice: position.avgPrice,
      currentPrice: position.currentPrice,
      value: position.positionValue,
      investedValue: position.investedValue,
      resultValue: position.resultValue,
      percentage: calculatePercentage(position.positionValue, totalPatrimony),
    }))
    .sort((a, b) => b.value - a.value)
}

function buildConcentrationData(
  distributionByAsset: DistributionByAssetItem[]
): ConcentrationDataItem[] {
  return distributionByAsset.map((asset) => ({
    ticker: asset.ticker,
    label: asset.label,
    value: asset.value,
    percentage: asset.percentage,
  }))
}

export function aggregatePortfolio(
  positions: PortfolioPosition[]
): PortfolioAggregationResult {
  const valuedPositions = positions.map(toValuedPosition)

  const totalInvested = valuedPositions.reduce(
    (accumulator, position) => accumulator + position.investedValue,
    0
  )

  const totalPatrimony = valuedPositions.reduce(
    (accumulator, position) => accumulator + position.positionValue,
    0
  )

  const distributionByType = aggregateByType(valuedPositions, totalPatrimony)
  const distributionByAsset = aggregateByAsset(
    valuedPositions,
    totalPatrimony
  )
  const concentrationData = buildConcentrationData(distributionByAsset)

  return {
    valuationBasis: 'MARKET_PRICE',
    totalInvested,
    totalPatrimony,
    totalPositions: valuedPositions.length,
    valuedPositions,
    distributionByType,
    distributionByAsset,
    concentrationData,
  }
}