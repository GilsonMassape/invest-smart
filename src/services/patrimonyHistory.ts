import type { PatrimonyHistory, PatrimonySnapshot } from '../domain/history'

const STORAGE_KEY = 'invest-smart.patrimony-history.v1'

export function loadPatrimonyHistory(): PatrimonyHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as PatrimonyHistory
    if (!Array.isArray(parsed)) return []

    return parsed
  } catch {
    return []
  }
}

export function savePatrimonyHistory(history: PatrimonyHistory) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function appendSnapshot(
  history: PatrimonyHistory,
  snapshot: PatrimonySnapshot
): PatrimonyHistory {
  const safeHistory = Array.isArray(history) ? history : []
  const lastSnapshot = safeHistory[safeHistory.length - 1]

  if (!lastSnapshot) {
    return [snapshot]
  }

  const isSameTotal = lastSnapshot.total === snapshot.total
  const isTooCloseInTime =
    Math.abs(snapshot.timestamp - lastSnapshot.timestamp) < 1000 * 60 * 30

  if (isSameTotal && isTooCloseInTime) {
    return safeHistory
  }

  return [...safeHistory, snapshot].slice(-200)
}