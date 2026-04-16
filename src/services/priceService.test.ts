import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchRemotePricesMock = vi.fn()
const getCachedPricesMock = vi.fn()
const getMissingTickersMock = vi.fn()
const savePricesToCacheMock = vi.fn()

vi.mock('../infra/pricing/fetchPrices', () => ({
  fetchPrices: fetchRemotePricesMock,
}))

vi.mock('../infra/pricing/priceCache', () => ({
  getCachedPrices: getCachedPricesMock,
  getMissingTickers: getMissingTickersMock,
  savePricesToCache: savePricesToCacheMock,
}))

describe('priceService.fetchPrices', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('retorna vazio quando não há tickers válidos', async () => {
    const { fetchPrices } = await import('./priceService')

    const result = await fetchPrices(['', '   '])

    expect(result).toEqual({})
    expect(getCachedPricesMock).not.toHaveBeenCalled()
    expect(getMissingTickersMock).not.toHaveBeenCalled()
    expect(fetchRemotePricesMock).not.toHaveBeenCalled()
    expect(savePricesToCacheMock).not.toHaveBeenCalled()
  })

  it('normaliza e remove tickers duplicados antes de consultar cache', async () => {
    getCachedPricesMock.mockReturnValue({})
    getMissingTickersMock.mockReturnValue([])
    const { fetchPrices } = await import('./priceService')

    await fetchPrices(['itub4', ' ITUB4 ', 'wege3'])

    expect(getCachedPricesMock).toHaveBeenCalledWith(['ITUB4', 'WEGE3'], 300000)
    expect(getMissingTickersMock).toHaveBeenCalledWith(['ITUB4', 'WEGE3'], 300000)
  })

  it('retorna somente cache quando nenhum ticker precisa ser buscado remotamente', async () => {
    getCachedPricesMock.mockReturnValue({
      ITUB4: 33.5,
      WEGE3: 52.1,
    })
    getMissingTickersMock.mockReturnValue([])
    const { fetchPrices } = await import('./priceService')

    const result = await fetchPrices(['ITUB4', 'WEGE3'])

    expect(result).toEqual({
      ITUB4: 33.5,
      WEGE3: 52.1,
    })
    expect(fetchRemotePricesMock).not.toHaveBeenCalled()
    expect(savePricesToCacheMock).not.toHaveBeenCalled()
  })

  it('mescla preços remotos válidos sobre os preços em cache', async () => {
    getCachedPricesMock.mockReturnValue({
      ITUB4: 33.5,
      WEGE3: 52.1,
    })
    getMissingTickersMock.mockReturnValue(['WEGE3'])
    fetchRemotePricesMock.mockResolvedValue({
      WEGE3: 53.2,
    })

    const { fetchPrices } = await import('./priceService')
    const result = await fetchPrices(['ITUB4', 'WEGE3'])

    expect(fetchRemotePricesMock).toHaveBeenCalledWith(['WEGE3'])
    expect(savePricesToCacheMock).toHaveBeenCalledWith({
      WEGE3: 53.2,
    })
    expect(result).toEqual({
      ITUB4: 33.5,
      WEGE3: 53.2,
    })
  })

  it('filtra preços remotos inválidos antes de salvar e retornar', async () => {
    getCachedPricesMock.mockReturnValue({
      ITUB4: 33.5,
    })
    getMissingTickersMock.mockReturnValue(['WEGE3', 'BOVA11'])
    fetchRemotePricesMock.mockResolvedValue({
      WEGE3: 53.2,
      BOVA11: null,
      MXRF11: -1,
      HASH11: Number.NaN,
    })

    const { fetchPrices } = await import('./priceService')
    const result = await fetchPrices(['ITUB4', 'WEGE3', 'BOVA11'])

    expect(savePricesToCacheMock).toHaveBeenCalledWith({
      WEGE3: 53.2,
    })
    expect(result).toEqual({
      ITUB4: 33.5,
      WEGE3: 53.2,
    })
  })

  it('não salva no cache quando a resposta remota não contém preços válidos', async () => {
    getCachedPricesMock.mockReturnValue({
      ITUB4: 33.5,
    })
    getMissingTickersMock.mockReturnValue(['WEGE3'])
    fetchRemotePricesMock.mockResolvedValue({
      WEGE3: null,
    })

    const { fetchPrices } = await import('./priceService')
    const result = await fetchPrices(['ITUB4', 'WEGE3'])

    expect(savePricesToCacheMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      ITUB4: 33.5,
    })
  })

  it('usa forceRefresh para ignorar cache e buscar todos os tickers', async () => {
    fetchRemotePricesMock.mockResolvedValue({
      ITUB4: 34.1,
      WEGE3: 53.3,
    })

    const { fetchPrices } = await import('./priceService')
    const result = await fetchPrices(['ITUB4', 'WEGE3'], {
      forceRefresh: true,
    })

    expect(getCachedPricesMock).not.toHaveBeenCalled()
    expect(getMissingTickersMock).not.toHaveBeenCalled()
    expect(fetchRemotePricesMock).toHaveBeenCalledWith(['ITUB4', 'WEGE3'])
    expect(savePricesToCacheMock).toHaveBeenCalledWith({
      ITUB4: 34.1,
      WEGE3: 53.3,
    })
    expect(result).toEqual({
      ITUB4: 34.1,
      WEGE3: 53.3,
    })
  })

  it('respeita ttl customizado ao consultar o cache', async () => {
    getCachedPricesMock.mockReturnValue({})
    getMissingTickersMock.mockReturnValue([])
    const { fetchPrices } = await import('./priceService')

    await fetchPrices(['ITUB4'], { ttlMs: 120000 })

    expect(getCachedPricesMock).toHaveBeenCalledWith(['ITUB4'], 120000)
    expect(getMissingTickersMock).toHaveBeenCalledWith(['ITUB4'], 120000)
  })

  it('retorna o cache quando a busca remota falha', async () => {
    getCachedPricesMock.mockReturnValue({
      ITUB4: 33.5,
    })
    getMissingTickersMock.mockReturnValue(['WEGE3'])
    fetchRemotePricesMock.mockRejectedValue(new Error('network error'))

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { fetchPrices } = await import('./priceService')
    const result = await fetchPrices(['ITUB4', 'WEGE3'])

    expect(result).toEqual({
      ITUB4: 33.5,
    })
    expect(savePricesToCacheMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})