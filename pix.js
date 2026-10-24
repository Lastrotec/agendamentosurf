'use strict';
// Gera o "Pix copia e cola" (BR Code / EMV) e o QR Code correspondente.
const Pix = (() => {
  const field = (id, value) => id + String(value.length).padStart(2, '0') + value;
  const ascii = (s, max) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .-]/g, '').toUpperCase().trim().slice(0, max);

  function crc16(s) {
    let crc = 0xffff;
    for (let i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function payload({ key, name, city, amount, txid }) {
    const account = field('00', 'br.gov.bcb.pix') + field('01', key);
    const ref = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    const body = field('00', '01') + field('26', account) + field('52', '0000') + field('53', '986') +
      (amount ? field('54', Number(amount).toFixed(2)) : '') + field('58', 'BR') +
      field('59', ascii(name, 25)) + field('60', ascii(city, 15)) + field('62', field('05', ref)) + '6304';
    return body + crc16(body);
  }

  function qrSvg(text) {
    if (typeof qrcode !== 'function') return '';
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'QR Code Pix' });
  }

  // Normaliza a chave celular para o formato exigido pelo Pix (+55DDDNÚMERO).
  function phoneKey(raw) {
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    return '+' + (digits.startsWith('55') && digits.length > 11 ? digits : '55' + digits);
  }

  return { payload, qrSvg, phoneKey, crc16 };
})();
if (typeof module === 'object') module.exports = Pix;
