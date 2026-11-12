import QRCode from "qrcode";

const publicAppUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:5173";

export function billVerificationUrl(billId: string): string {
  return `${publicAppUrl}/verify/${billId}`;
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 240 });
}
