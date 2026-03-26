import { describe, expect, it } from 'vitest';
import { buildRanking } from '../engine/ranking/buildRanking';
import { calculateRebalance } from '../engine/rebalance/calculateRebalance';
import { ASSETS } from '../data/assets';
import { DEFAULT_STATE } from '../data/defaults';
describe('rebalance engine',()=>{it('gera ações para carteira existente',()=>{const ranking=buildRanking(ASSETS,DEFAULT_STATE.positions,DEFAULT_STATE.preferences);const result=calculateRebalance(ranking);expect(result.length).toBe(DEFAULT_STATE.positions.length);expect(result.some(item=>['COMPRAR','REDUZIR','MANTER'].includes(item.action))).toBe(true);});});