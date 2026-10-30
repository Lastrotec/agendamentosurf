import { describe, expect, it } from 'vitest';

import { formatPhoneBR, maskPhoneInput, maskPhonePrivate, normalizeBrazilPhone } from '../../src/shared/phone';

describe('normalizeBrazilPhone', () => {
  it.each([
    ['(71) 99999-1234', '5571999991234'],
    ['71999991234', '5571999991234'],
    ['+55 71 99999-1234', '5571999991234'],
    ['0055 71 999991234', '5571999991234'],
    ['071 99999-1234', '5571999991234'],
    ['5571999991234', '5571999991234'],
    ['(11) 3456-7890', '551134567890'],
  ])('%s → %s', (input, out) => {
    const r = normalizeBrazilPhone(input);
    expect(r.ok && r.e164).toBe(out);
  });

  it.each([
    ['', 'vazio'],
    ['123', 'curto'],
    ['(20) 99999-1234', 'DDD inexistente'],
    ['(71) 89999-1234', 'celular sem 9'],
    ['(71) 9999-1234', 'número antigo de 8 dígitos começando com 9'],
    ['(71) 99999-12345', 'longo'],
    ['(71) 99999-1234; drop table', 'caracteres inválidos'],
    ['(71) 99999-9999'.replace(/9/g, '1'), 'repetido'],
  ])('rejeita %s (%s)', (input) => {
    expect(normalizeBrazilPhone(input).ok).toBe(false);
  });

  it('exige celular quando pedido', () => {
    expect(normalizeBrazilPhone('(11) 3456-7890', { requireMobile: true }).ok).toBe(false);
  });

  it('formata e mascara', () => {
    expect(formatPhoneBR('5571999991234')).toBe('(71) 99999-1234');
    expect(maskPhoneInput('7199999')).toBe('(71) 9999-9');
    expect(maskPhoneInput('71999991234')).toBe('(71) 99999-1234');
    expect(maskPhonePrivate('5571999991234')).toBe('(71) •••••-1234');
  });
});
