import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret, hashPassword, randomDigits, randomToken, verifyPassword, bytesToB64url, randomBytes } from '../../src/worker/lib/crypto';
import { base32Encode, totpAt, verifyTotp } from '../../src/worker/lib/totp';
import { parseBRLToCents, formatBRL } from '../../src/shared/money';

describe('senhas', () => {
  it('hash PBKDF2 verifica e rejeita', async () => {
    const h = await hashPassword('senha-forte-123');
    expect(h.startsWith('pbkdf2_sha256$100000$')).toBe(true);
    expect(await verifyPassword('senha-forte-123', h)).toBe(true);
    expect(await verifyPassword('senha-errada-123', h)).toBe(false);
  });
});

describe('tokens', () => {
  it('tokens e códigos aleatórios', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
    expect(randomDigits(6)).toMatch(/^\d{6}$/);
  });

  it('AES-GCM ida e volta', async () => {
    const key = bytesToB64url(randomBytes(32));
    const enc = await encryptSecret('JBSWY3DPEHPK3PXP', key);
    expect(enc).not.toContain('JBSWY3DPEHPK3PXP');
    expect(await decryptSecret(enc, key)).toBe('JBSWY3DPEHPK3PXP');
    await expect(decryptSecret(enc, bytesToB64url(randomBytes(32)))).rejects.toThrow();
  });
});

describe('TOTP (RFC 6238)', () => {
  const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
  it('vetores oficiais SHA1', async () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(await totpAt(secret, Math.floor(59 / 30))).toBe('287082');
    expect(await totpAt(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(await totpAt(secret, Math.floor(20000000000 / 30))).toBe('353130');
  });
  it('aceita ±1 passo e impede reutilização', async () => {
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30000);
    const code = await totpAt(secret, step);
    expect(await verifyTotp(secret, code, null, now)).toBe(step);
    expect(await verifyTotp(secret, code, step, now)).toBeNull();
    expect(await verifyTotp(secret, await totpAt(secret, step - 1), null, now)).toBe(step - 1);
    expect(await verifyTotp(secret, await totpAt(secret, step - 3), null, now)).toBeNull();
  });
});

describe('dinheiro', () => {
  it('formata e interpreta BRL', () => {
    expect(formatBRL(5500)).toBe('R$ 55,00');
    expect(parseBRLToCents('55')).toBe(5500);
    expect(parseBRLToCents('1.234,56')).toBe(123456);
    expect(parseBRLToCents('R$ 9,5')).toBe(950);
    expect(parseBRLToCents('abc')).toBeNull();
  });
});
