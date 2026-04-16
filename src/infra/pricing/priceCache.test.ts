import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockStorage = {
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  removeItem: ReturnType<typeof vi.fn>
}

const STORAGE_KEY = 'invest-smart.pricing.cache.v1'

function createLocalStorageMock(): MockStorage {
  const store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
  }
}

describe('priceCache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('retorna null para ticker sem cache', async () => {
    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { getCachedPrices } = await import('./priceCache')
    const result = getCachedPrices(['ITUB4'])

    expect(result).toEqual({
      ITUB4: null,
    })
  })

  it('salva e recupera preços do cache normalizando ticker', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { savePricesToCache, getCachedPrices } = await import('./priceCache')

    savePricesToCache(
      {
        itub4: 33.45,
        wege3: 52.1,
      },
      now
    )

    const result = getCachedPrices([' ITUB4 ', 'wege3'])

    expect(result).toEqual({
      ITUB4: 33.45,
      WEGE3: 52.1,
    })
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
  })

  it('retorna tickers faltantes quando não existem no cache', async () => {
    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { getMissingTickers } = await import('./priceCache')
    const result = getMissingTickers(['ITUB4', 'WEGE3'])

    expect(result).toEqual(['ITUB4', 'WEGE3'])
  })

  it('não retorna como faltante ticker fresco no cache', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { savePricesToCache, getMissingTickers } = await import('./priceCache')

    savePricesToCache({ ITUB4: 33.45 }, now)

    const result = getMissingTickers(['ITUB4', 'WEGE3'])

    expect(result).toEqual(['WEGE3'])
  })

  it('expira entradas antigas com base no ttl', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { savePricesToCache, getCachedPrices, getMissingTickers } = await import('./priceCache')

    savePricesToCache({ ITUB4: 33.45 }, now - 600001)

    const cached = getCachedPrices(['ITUB4'])
    const missing = getMissingTickers(['ITUB4'])

    expect(cached).toEqual({
      ITUB4: null,
    })
    expect(missing).toEqual(['ITUB4'])
  })

  it('preserva null como valor de preço no cache', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { savePricesToCache, getCachedPrices } = await import('./priceCache')

    savePricesToCache({ ITUB4: null }, now)

    const result = getCachedPrices(['ITUB4'])

    expect(result).toEqual({
      ITUB4: null,
    })
  })

  it('clearPriceCache limpa memória e localStorage', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { savePricesToCache, clearPriceCache, getCachedPrices } = await import('./priceCache')

    savePricesToCache({ ITUB4: 33.45 }, now)
    clearPriceCache()

    const result = getCachedPrices(['ITUB4'])

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    expect(result).toEqual({
      ITUB4: null,
    })
  })

  it('getPriceCacheSnapshot retorna apenas entradas frescas', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { savePricesToCache, getPriceCacheSnapshot } = await import('./priceCache')

    savePricesToCache(
      {
        ITUB4: 33.45,
        WEGE3: 52.1,
      },
      now
    )

    const snapshot = getPriceCacheSnapshot()

    expect(snapshot).toEqual({
      ITUB4: {
        value: 33.45,
        updatedAt: now,
      },
      WEGE3: {
        value: 52.1,
        updatedAt: now,
      },
    })
  })

  it('hidrata o cache a partir do localStorage ao iniciar', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        ITUB4: {
          value: 33.45,
          updatedAt: now,
        },
      })
    )

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { getCachedPrices } = await import('./priceCache')
    const result = getCachedPrices(['ITUB4', 'WEGE3'])

    expect(result).toEqual({
      ITUB4: 33.45,
      WEGE3: null,
    })
  })

  it('ignora registros inválidos do localStorage', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const localStorageMock = createLocalStorageMock()

    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        ITUB4: {
          value: 'invalid',
          updatedAt: 'invalid',
        },
        WEGE3: {
          value: 52.1,
          updatedAt: now,
        },
      })
    )

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    const { getCachedPrices } = await import('./priceCache')
    const result = getCachedPrices(['ITUB4', 'WEGE3'])

    expect(result).toEqual({
      ITUB4: null,
      WEGE3: 52.1,
    })
  })
})