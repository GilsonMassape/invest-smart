import { describe, expect, it } from 'vitest';
import { getSectorLabel } from '../utils/labels';
describe('labels',()=>{it('traduz setores conhecidos e preserva desconhecidos',()=>{expect(getSectorLabel('Banks')).toBe('Bancos');expect(getSectorLabel('Outro')).toBe('Outro');});});