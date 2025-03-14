import { pmlib } from './sign-util-lib';
import crypto from 'crypto';

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

function formatPrivateKey(key: string): string {
  // Add PEM format if not present
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
  return key.replace(/\\n/g, '\n');
}

export function signRequestObject(requestObject: any, privateKey: string): string {
  try {
    // Format private key
    const formattedKey = formatPrivateKey(privateKey);

    // Sort fields alphabetically
    const fields = Object.keys(requestObject).sort().filter(key => 
      !excludeFields.includes(key)
    );

    // Create string to sign
    const signStr = fields.map(key => `${key}=${requestObject[key]}`).join('&');
    console.log('String to sign:', signStr); // For debugging

    // Create signer with SHA256 and RSA-PSS padding
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signStr);
    
    // Sign and encode
    const signature = signer.sign({
      key: formattedKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    }, 'base64');
    
    return signature;

  } catch (error) {
    console.error('Signing error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error('Failed to sign request');
  }
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

// Add this function to verify signatures from Telebirr
export function verifyTelebirrSignature(
  payload: any,
  signature: string,
  appSecret: string
): boolean {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(payload)
    .sort()
    .reduce((acc: Record<string, any>, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});

  // Create string to sign
  const stringToSign = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  // Add app secret
  const signString = `${stringToSign}&key=${appSecret}`;

  // Generate signature
  const calculatedSignature = crypto
    .createHash('md5')
    .update(signString)
    .digest('hex')
    .toUpperCase();

  return calculatedSignature === signature;
}

export function verifyWebhookSignature(
  payload: any,
  signature: string,
  publicKey: string
): boolean {
  try {
    // Format public key
    if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
      publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    }
    publicKey = publicKey.replace(/\\n/g, '\n');

    // Sort payload keys alphabetically
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce((obj: any, key) => {
        obj[key] = payload[key];
        return obj;
      }, {});

    // Create string to verify
    const dataToVerify = JSON.stringify(sortedPayload);

    // Create verifier with SHA256 and RSA-PSS padding
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(dataToVerify);
    
    return verifier.verify(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
      },
      Buffer.from(signature, 'base64')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export function generateTelebirrSignature(
  params: Record<string, any>,
  appSecret: string
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc: Record<string, any>, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  // Create string to sign
  const stringToSign = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  // Add app secret
  const signString = `${stringToSign}&key=${appSecret}`;

  // Generate signature
  return crypto
    .createHash('md5')
    .update(signString)
    .digest('hex')
    .toUpperCase();
}