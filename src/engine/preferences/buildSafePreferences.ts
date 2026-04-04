import type { Preferences, RiskProfile, MacroScenario } from '../../domain/types'

type PartialPreferencesInput = Readonly<{
  riskProfile: RiskProfile
  macroScenario: MacroScenario
  preferredTypes?: Preferences['preferredTypes']
  blockedTickers?: Preferences['blockedTickers']
}>

function normalizeBlockedTickers(
  blockedTickers: Preferences['blockedTickers'] | undefined
): Preferences['blockedTickers'] {
  if (!Array.isArray(blockedTickers)) {
    return []
  }

  return blockedTickers
    .filter((ticker): ticker is string => typeof ticker === 'string')
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker, index, array) => ticker.length > 0 && array.indexOf(ticker) === index)
}

function normalizePreferredTypes(
  preferredTypes: Preferences['preferredTypes'] | undefined
): Preferences['preferredTypes'] {
  if (!Array.isArray(preferredTypes)) {
    return []
  }

  return preferredTypes.filter(
    (assetType): assetType is Preferences['preferredTypes'][number] =>
      typeof assetType === 'string' && assetType.trim().length > 0
  )
}

export function buildSafePreferences(
  input: PartialPreferencesInput
): Preferences {
  return {
    riskProfile: input.riskProfile,
    macroScenario: input.macroScenario,
    preferredTypes: normalizePreferredTypes(input.preferredTypes),
    blockedTickers: normalizeBlockedTickers(input.blockedTickers),
  }
}