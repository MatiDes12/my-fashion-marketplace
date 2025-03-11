import { pmlib } from './sign-util-lib';

// Fields not participating in signature
const excludeFields = [
  'sign',
  'sign_type',
  'header',
  'refund_info',
  'openType',
  'raw_request',
  'biz_content',
];

export function signRequestObject(requestObject: any, privateKey: string): string {
  let fields: string[] = [];
  let fieldMap: Record<string, any> = {};

  // Add main fields
  for (let key in requestObject) {
    if (excludeFields.includes(key)) continue;
    fields.push(key);
    fieldMap[key] = requestObject[key];
  }

  // Add biz_content fields
  if (requestObject.biz_content) {
    for (let key in requestObject.biz_content) {
      if (excludeFields.includes(key)) continue;
      fields.push(key);
      fieldMap[key] = requestObject.biz_content[key];
    }
  }

  // Sort fields by ASCII
  fields.sort();

  // Create signature string
  const signStrList = fields.map(key => `${key}=${fieldMap[key]}`);
  const signOriginStr = signStrList.join('&');

  // Sign using SHA256withRSA
  const sha256withrsa = new pmlib.rs.KJUR.crypto.Signature({
    alg: "SHA256withRSAandMGF1",
  });
  sha256withrsa.init(privateKey);
  sha256withrsa.updateString(signOriginStr);
  return pmlib.rs.hextob64(sha256withrsa.sign());
}

export function createTimeStamp(): string {
  return Math.round(Date.now() / 1000).toString();
}

export function createNonceStr(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
} 