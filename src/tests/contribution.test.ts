import { describe, expect, it } from 'vitest';
import { buildRanking } from '../engine/ranking/buildRanking';
import { calculateContribution } from '../engine/contribution/calculateContribution';
import { ASSETS } from '../data/assets';
import { DEFAULT_STATE } from '../data/defaults';
describe('contribution engine',()=>{it('retorna vazio para aporte zero',()=>{const ranking=buildRanking(ASSETS,DEFAULT_STATE.positions,DEFAULT_STATE.preferences);expect(calculateContribution(ranking,0)).toEqual([]);});it('sugere aporte para ativos elegíveis',()=>{const ranking=buildRanking(ASSETS,DEFAULT_STATE.positions,DEFAULT_STATE.preferences);const result=calculateContribution(ranking,1000);expect(result.length).toBeGreaterThan(0);expect(result[0].suggestedAmount).toBeGreaterThan(0);});});