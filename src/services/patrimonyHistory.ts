import type { PatrimonyHistory, PatrimonySnapshot } from '../domain/history'

const STORAGE_KEY = 'invest-smart.patrimony-history.v1'
const MAX_HISTORY_SIZE = 365
const MIN_SNAPSHOT_INTERVAL_MS = 1000 * 60 * 30

type SafePatrimonySnapshot = Readonly<{
  timestamp: number
  total: number
}>

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isValidSnapshot(value: unknown): value is SafePatrimonySnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SafePatrimonySnapshot>

  return (
    typeof candidate.timestamp === 'number' &&
    Number.isFinite(candidate.timestamp) &&
    typeof candidate.total === 'number' &&
    Number.isFinite(candidate.total)
  )
}

function normalizeSnapshot(snapshot: PatrimonySnapshot): SafePatrimonySnapshot {
  return {
    timestamp: toSafeNumber(snapshot.timestamp),
    total: toSafeNumber(snapshot.total),
  }
}

function normalizeHistory(history: PatrimonyHistory): PatrimonyHistory {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .filter(isValidSnapshot)
    .map(normalizeSnapshot)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-MAX_HISTORY_SIZE)
}

function getDayStartTimestamp(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime()
}

function trimHistory(history: PatrimonyHistory): PatrimonyHistory {
  return history.slice(-MAX_HISTORY_SIZE)
}

export function loadPatrimonyHistory(): PatrimonyHistory {
  if (!isBrowser()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    return normalizeHistory(Array.isArray(parsed) ? (parsed as PatrimonyHistory) : [])
  } catch {
    return []
  }
}

export function savePatrimonyHistory(history: PatrimonyHistory): void {
  if (!isBrowser()) {
    return
  }

  try {
    const normalizedHistory = normalizeHistory(history)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedHistory))
  } catch {
    // noop
  }
}

export function appendSnapshot(
  history: PatrimonyHistory,
  snapshot: PatrimonySnapshot
): PatrimonyHistory {
  const normalizedHistory = normalizeHistory(history)
  const normalizedSnapshot = normalizeSnapshot(snapshot)

  if (normalizedSnapshot.timestamp <= 0 || normalizedSnapshot.total < 0) {
    return normalizedHistory
  }

  const lastSnapshot = normalizedHistory[normalizedHistory.length - 1]

  if (!lastSnapshot) {
    return [normalizedSnapshot]
  }

  const isSameDay =
    getDayStartTimestamp(lastSnapshot.timestamp) ===
    getDayStartTimestamp(normalizedSnapshot.timestamp)

  if (isSameDay) {
    const updatedSameDaySnapshot: SafePatrimonySnapshot = {
      timestamp: normalizedSnapshot.timestamp,
      total: normalizedSnapshot.total,
    }

    if (
      lastSnapshot.total === updatedSameDaySnapshot.total &&
      Math.abs(updatedSameDaySnapshot.timestamp - lastSnapshot.timestamp) <
        MIN_SNAPSHOT_INTERVAL_MS
    ) {
      return normalizedHistory
    }

    return trimHistory([
      ...normalizedHistory.slice(0, -1),
      updatedSameDaySnapshot,
    ])
  }

  const isSameTotal = lastSnapshot.total === normalizedSnapshot.total
  const isTooCloseInTime =
    Math.abs(normalizedSnapshot.timestamp - lastSnapshot.timestamp) <
    MIN_SNAPSHOT_INTERVAL_MS

  if (isSameTotal && isTooCloseInTime) {
    return normalizedHistory
  }

  return trimHistory([...normalizedHistory, normalizedSnapshot])
}