/** QR codes for tickets: PNG for emails (inline image), SVG for the order page. */
import QRCode from 'qrcode';

export const qrPng = (text: string) =>
  QRCode.toBuffer(text, { type: 'png', margin: 2, width: 360, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });

export const qrSvg = (text: string) =>
  QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
