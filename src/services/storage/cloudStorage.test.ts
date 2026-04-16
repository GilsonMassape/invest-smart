import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../../domain/types'

const getUserMock = vi.fn()
const maybeSingleMock = vi.fn()
const upsertMock = vi.fn()
const eqMock = vi.fn(() => ({
  maybeSingle: maybeSingleMock,
}))
const selectMock = vi.fn(() => ({
  eq: eqMock,
}))
const fromMock = vi.fn(() => ({
  select: selectMock,
  upsert: upsertMock,
}))

vi.mock('../../infra/supabase/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  },
}))

async function loadCloudStorageModule() {
  return import('./cloudStorage')
}

const TEST_STATE: AppState = {
  positions: [
    {
      ticker: 'itub4',
      quantity: 10,
      avgPrice: 30,
      currentPrice: 35,
    },
    {
      ticker: 'hglg11',
      quantity: 2,
      avgPrice: 150,
      currentPrice: null,
    },
  ],
  preferences: {
    riskProfile: 'EQUILIBRADO',
    macroScenario: 'NEUTRO',
    preferredTypes: ['AÇÃO', 'FII', 'ETF', 'BDR'],
    blockedTickers: [' itub4 ', 'wege3'],
  },
  monthlyContribution: 2000,
  filterType: 'TODOS',
}

describe('cloudStorage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    })

    upsertMock.mockResolvedValue({
      error: null,
    })
  })

  it('toCloudPayload normaliza o estado para o formato cloud', async () => {
    const { toCloudPayload } = await loadCloudStorageModule()

    const result = toCloudPayload(TEST_STATE)

    expect(result).toEqual({
      positions: [
        {
          ticker: 'ITUB4',
          quantity: 10,
          avg_price: 30,
          current_price: 35,
        },
        {
          ticker: 'HGLG11',
          quantity: 2,
          avg_price: 150,
          current_price: null,
        },
      ],
      preferences: {
        risk_profile: 'EQUILIBRADO',
        macro_scenario: 'NEUTRO',
        preferred_types: ['AÇÃO', 'FII', 'ETF', 'BDR'],
        blocked_tickers: ['ITUB4', 'WEGE3'],
      },
      monthly_contribution: 2000,
      filter_type: 'TODOS',
    })
  })

  it('fromCloudPayload retorna defaults quando payload é inválido', async () => {
    const { fromCloudPayload } = await loadCloudStorageModule()

    expect(fromCloudPayload(null)).toEqual({
      positions: [],
      preferences: {
        riskProfile: 'EQUILIBRADO',
        macroScenario: 'NEUTRO',
        preferredTypes: ['AÇÃO', 'FII', 'ETF', 'BDR'],
        blockedTickers: [],
      },
      monthlyContribution: 0,
      filterType: 'TODOS',
    })
  })

  it('fromCloudPayload normaliza payload válido vindo da nuvem', async () => {
    const { fromCloudPayload } = await loadCloudStorageModule()

    const result = fromCloudPayload({
      positions: [
        {
          ticker: 'itub4',
          quantity: 10,
          avg_price: 30,
          current_price: 35,
        },
        {
          ticker: ' hglg11 ',
          quantity: 2,
          avg_price: 150,
          current_price: null,
        },
      ],
      preferences: {
        risk_profile: 'ARROJADO',
        macro_scenario: 'CRESCIMENTO',
        preferred_types: ['AÇÃO', 'FII'],
        blocked_tickers: [' itub4 ', 'wege3'],
      },
      monthly_contribution: 2500,
      filter_type: 'AÇÃO',
    })

    expect(result).toEqual({
      positions: [
        {
          ticker: 'ITUB4',
          quantity: 10,
          avgPrice: 30,
          currentPrice: 35,
        },
        {
          ticker: 'HGLG11',
          quantity: 2,
          avgPrice: 150,
          currentPrice: null,
        },
      ],
      preferences: {
        riskProfile: 'ARROJADO',
        macroScenario: 'CRESCIMENTO',
        preferredTypes: ['AÇÃO', 'FII'],
        blockedTickers: ['ITUB4', 'WEGE3'],
      },
      monthlyContribution: 2500,
      filterType: 'AÇÃO',
    })
  })

  it('fromCloudPayload aplica defaults para campos inválidos', async () => {
    const { fromCloudPayload } = await loadCloudStorageModule()

    const result = fromCloudPayload({
      positions: [
        {
          ticker: 'itub4',
          quantity: '10',
          avg_price: '30',
          current_price: '35',
        },
        {
          ticker: '',
          quantity: 1,
          avg_price: 1,
          current_price: 1,
        },
      ],
      preferences: {
        risk_profile: 'INVALIDO',
        macro_scenario: 'INVALIDO',
        preferred_types: ['AÇÃO', 'TIPO_INVALIDO'],
        blocked_tickers: [' wege3 ', ''],
      },
      monthly_contribution: '1500',
      filter_type: 'INVALIDO',
    })

    expect(result).toEqual({
      positions: [
        {
          ticker: 'ITUB4',
          quantity: 10,
          avgPrice: 30,
          currentPrice: null,
        },
      ],
      preferences: {
        riskProfile: 'EQUILIBRADO',
        macroScenario: 'NEUTRO',
        preferredTypes: ['AÇÃO'],
        blockedTickers: ['WEGE3'],
      },
      monthlyContribution: 1500,
      filterType: 'TODOS',
    })
  })

  it('toPositionsInsertRows retorna somente as linhas de posições', async () => {
    const { toPositionsInsertRows } = await loadCloudStorageModule()

    const result = toPositionsInsertRows(TEST_STATE)

    expect(result).toEqual([
      {
        ticker: 'ITUB4',
        quantity: 10,
        avg_price: 30,
        current_price: 35,
      },
      {
        ticker: 'HGLG11',
        quantity: 2,
        avg_price: 150,
        current_price: null,
      },
    ])
  })

  it('loadCloudAppState retorna null quando não há usuário autenticado', async () => {
    const { loadCloudAppState } = await loadCloudStorageModule()

    const result = await loadCloudAppState()

    expect(result).toBeNull()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('loadCloudAppState lança erro quando a leitura do usuário falha', async () => {
    const fakeError = new Error('auth error')

    getUserMock.mockResolvedValue({
      data: { user: null },
      error: fakeError,
    })

    const { loadCloudAppState } = await loadCloudStorageModule()

    await expect(loadCloudAppState()).rejects.toThrow('auth error')
  })

  it('loadCloudAppState retorna null quando não existe registro em cloud', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    })

    const { loadCloudAppState } = await loadCloudStorageModule()
    const result = await loadCloudAppState()

    expect(result).toBeNull()
    expect(fromMock).toHaveBeenCalledWith('user_app_state')
    expect(selectMock).toHaveBeenCalledWith('payload')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('loadCloudAppState lança erro quando a consulta ao banco falha', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    maybeSingleMock.mockResolvedValue({
      data: null,
      error: new Error('select error'),
    })

    const { loadCloudAppState } = await loadCloudStorageModule()

    await expect(loadCloudAppState()).rejects.toThrow('select error')
  })

  it('loadCloudAppState retorna estado convertido quando existe payload salvo', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    maybeSingleMock.mockResolvedValue({
      data: {
        payload: {
          positions: [
            {
              ticker: 'itub4',
              quantity: 10,
              avg_price: 30,
              current_price: 35,
            },
          ],
          preferences: {
            risk_profile: 'EQUILIBRADO',
            macro_scenario: 'NEUTRO',
            preferred_types: ['AÇÃO', 'FII'],
            blocked_tickers: [' itub4 '],
          },
          monthly_contribution: 2000,
          filter_type: 'FII',
        },
      },
      error: null,
    })

    const { loadCloudAppState } = await loadCloudStorageModule()
    const result = await loadCloudAppState()

    expect(result).toEqual({
      positions: [
        {
          ticker: 'ITUB4',
          quantity: 10,
          avgPrice: 30,
          currentPrice: 35,
        },
      ],
      preferences: {
        riskProfile: 'EQUILIBRADO',
        macroScenario: 'NEUTRO',
        preferredTypes: ['AÇÃO', 'FII'],
        blockedTickers: ['ITUB4'],
      },
      monthlyContribution: 2000,
      filterType: 'FII',
    })
  })

  it('saveCloudAppState não tenta salvar quando não há usuário autenticado', async () => {
    const { saveCloudAppState } = await loadCloudStorageModule()

    await saveCloudAppState(TEST_STATE)

    expect(fromMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('saveCloudAppState lança erro quando a leitura do usuário falha', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error('auth error'),
    })

    const { saveCloudAppState } = await loadCloudStorageModule()

    await expect(saveCloudAppState(TEST_STATE)).rejects.toThrow('auth error')
  })

  it('saveCloudAppState faz upsert do payload normalizado', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    const { saveCloudAppState } = await loadCloudStorageModule()

    await saveCloudAppState(TEST_STATE)

    expect(fromMock).toHaveBeenCalledWith('user_app_state')
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        payload: {
          positions: [
            {
              ticker: 'ITUB4',
              quantity: 10,
              avg_price: 30,
              current_price: 35,
            },
            {
              ticker: 'HGLG11',
              quantity: 2,
              avg_price: 150,
              current_price: null,
            },
          ],
          preferences: {
            risk_profile: 'EQUILIBRADO',
            macro_scenario: 'NEUTRO',
            preferred_types: ['AÇÃO', 'FII', 'ETF', 'BDR'],
            blocked_tickers: ['ITUB4', 'WEGE3'],
          },
          monthly_contribution: 2000,
          filter_type: 'TODOS',
        },
      },
      {
        onConflict: 'user_id',
      }
    )
  })

  it('saveCloudAppState lança erro quando o upsert falha', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    upsertMock.mockResolvedValue({
      error: new Error('upsert error'),
    })

    const { saveCloudAppState } = await loadCloudStorageModule()

    await expect(saveCloudAppState(TEST_STATE)).rejects.toThrow('upsert error')
  })
})