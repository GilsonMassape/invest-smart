export type AssetPosition = {
  ticker: string
  value: number
  sector: string
}

export type SafetyConfig = {
  maxPerAsset: number
  maxPerSector: number
}

export type SafetyResult = {
  allowed: boolean
  reason?: string
}

const normalizePositions = (positions?: AssetPosition[]) => {
  return Array.isArray(positions) ? positions : []
}

const getTotal = (positions?: AssetPosition[]) => {
  return normalizePositions(positions).reduce((sum, p) => sum + p.value, 0)
}

const getSectorExposure = (positions: AssetPosition[] | undefined, sector: string) => {
  return normalizePositions(positions)
    .filter((p) => p.sector === sector)
    .reduce((sum, p) => sum + p.value, 0)
}

export function checkSafety(
  positions: AssetPosition[] | undefined,
  newPosition: AssetPosition,
  config: SafetyConfig
): SafetyResult {
  const totalBefore = getTotal(positions)
  const totalAfter = totalBefore + newPosition.value

  if (totalAfter <= 0) {
    return {
      allowed: false,
      reason: 'Total da carteira inválido'
    }
  }

  const existingAssetValue = normalizePositions(positions)
    .filter((p) => p.ticker === newPosition.ticker)
    .reduce((sum, p) => sum + p.value, 0)

  const assetAfter = existingAssetValue + newPosition.value
  const assetShare = assetAfter / totalAfter

  if (assetShare > config.maxPerAsset) {
    return {
      allowed: false,
      reason: 'Excede limite por ativo'
    }
  }

  const sectorBefore = getSectorExposure(positions, newPosition.sector)
  const sectorAfter = sectorBefore + newPosition.value
  const sectorShare = sectorAfter / totalAfter

  if (sectorShare > config.maxPerSector) {
    return {
      allowed: false,
      reason: 'Excede limite por setor'
    }
  }

  return {
    allowed: true
  }
}