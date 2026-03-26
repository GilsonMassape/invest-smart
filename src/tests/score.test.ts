import { describe, expect, it } from 'vitest';
import { getScoreWeight } from '../engine/score/getScoreWeight';
import { getAssetScore } from '../engine/score/getAssetScore';
import { ASSETS } from '../data/assets';
import { DEFAULT_STATE } from '../data/defaults';
describe('score engine',()=>{it('aplica pesos nas faixas corretas',()=>{expect(getScoreWeight(90)).toBe(1.35);expect(getScoreWeight(80)).toBe(1.2);expect(getScoreWeight(72)).toBe(1.05);expect(getScoreWeight(65)).toBe(0.9);expect(getScoreWeight(40)).toBe(0.4);});it('penaliza concentração excessiva',()=>{const asset=ASSETS.find(i=>i.ticker==='ITUB4')!;const low=getAssetScore(asset,DEFAULT_STATE.preferences,5);const high=getAssetScore(asset,DEFAULT_STATE.preferences,28);expect(high.finalScore).toBeLessThan(low.finalScore);});});