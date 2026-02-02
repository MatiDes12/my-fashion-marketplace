import { tools } from '@/utils/tools';
import { sanitizeForLog, validateExternalUrl, ALLOWED_API_DOMAINS } from '@/utils/security';

// Allowed Telebirr API domains
const TELEBIRR_DOMAINS = ['app.ethiomobilemoney.et', 'api.ethiomobilemoney.et'];

interface TelebirrResponse {
  errorCode?: string;
  errorMsg?: string;
  result?: string;
  token: string;
  biz_content?: {
    prepay_id?: string;
    merch_order_id?: string;
  };
  effectiveDate?: string;
  expirationDate?: string;
}

interface TokenResponse {
  token: string;
  effectiveDate?: string;
  expirationDate?: string;
}

function validateTelebirrUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    if (!TELEBIRR_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) {
      throw new Error('Invalid Telebirr API domain');
    }
    if (url.protocol !== 'https:') {
      throw new Error('Telebirr API must use HTTPS');
    }
    return url.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch {
    throw new Error('Invalid Telebirr base URL');
  }
}

export async function applyFabricToken(config: {
  baseUrl: string;
  fabricAppId: string;
  appSecret: string;
}): Promise<TelebirrResponse> {
  try {
    // Validate URL to prevent SSRF
    const validatedBaseUrl = validateTelebirrUrl(config.baseUrl);

    console.log('\n=== FABRIC TOKEN REQUEST ===');
    console.log('URL:', sanitizeForLog(`${validatedBaseUrl}/payment/v1/token`));
    console.log('Headers:', {
      'Content-Type': 'application/json',
      'X-APP-Key': sanitizeForLog(config.fabricAppId),
    });

    const response = await fetch(`${validatedBaseUrl}/payment/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': config.fabricAppId,
      },
      body: JSON.stringify({
        appSecret: config.appSecret
      })
    });

    const result = await response.json() as TelebirrResponse;
    console.log('\n=== FABRIC TOKEN RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response: token received:', result.token ? 'yes' : 'no');

    if (result.errorCode || result.result === 'FAIL') {
      throw new Error(`Telebirr API Error: ${result.errorMsg || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error('\n=== FABRIC TOKEN ERROR ===');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function createOrder(params: {
  config: any;
  fabricToken: string;
  title: string;
  amount: string;
  isSubscription?: boolean;
}) {
  try {
    const { config, fabricToken, title, amount } = params;

    // Validate URL to prevent SSRF
    const validatedBaseUrl = validateTelebirrUrl(config.baseUrl);

    console.log('\n=== CREATE ORDER REQUEST ===');
    console.log('Input Parameters:', {
      title: sanitizeForLog(title),
      amount: sanitizeForLog(amount),
      baseUrl: sanitizeForLog(validatedBaseUrl),
    });

    const reqObject = createRequestObject({
      title,
      amount,
      config,
    });

    console.log('\n=== API REQUEST ===');
    console.log('URL:', sanitizeForLog(`${validatedBaseUrl}/payment/v1/merchant/preOrder`));

    const response = await fetch(`${validatedBaseUrl}/payment/v1/merchant/preOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': config.fabricAppId,
        Authorization: fabricToken,
      },
      body: JSON.stringify(reqObject)
    });

    const result = await response.json() as TelebirrResponse;
    console.log('\n=== CREATE ORDER RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response: errorCode:', result.errorCode || 'none', 'prepay_id:', result.biz_content?.prepay_id ? 'received' : 'none');

    if (result.errorCode || result.result === 'FAIL') {
      throw new Error(`Telebirr API Error: ${result.errorMsg || 'Unknown error'}`);
    }

    if (!result.biz_content?.prepay_id) {
      throw new Error('No prepay_id in response');
    }

    const rawRequest = createRawRequest({
      prepayId: result.biz_content.prepay_id,
      config,
    });

    const paymentUrl = `${config.webBaseUrl}?${rawRequest}&version=1.0&trade_type=Checkout`;
    console.log('\n=== PAYMENT URL GENERATED ===');

    return paymentUrl;

  } catch (error) {
    console.error('\n=== CREATE ORDER ERROR ===');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

function createRequestObject({ title, amount, config, isSubscription = false }: {
  title: string;
  amount: string;
  config: any;
  isSubscription?: boolean;
}) {
  const timestamp = Math.ceil(Date.now() / 1000).toString();
  const nonceStr = tools.createNonceStr();
  
  const req = {
    timestamp,
    nonce_str: nonceStr,
    method: "payment.preorder",
    version: "1.0",
    biz_content: {
      notify_url: isSubscription ? config.subscription_notify_url : config.notify_url,
      redirect_url: config.redirect_url,
      appid: config.merchantAppId,
      merch_code: config.shortCode,
      merch_order_id: `${isSubscription ? 'SUB' : 'ORD'}${Date.now()}`,
      trade_type: "Checkout",
      title: title,
      total_amount: Number(amount).toFixed(2),
      trans_currency: "ETB",
      timeout_express: "120m"
    }
  };

  const signedReq = req as any;
  signedReq.sign = tools.signRequestObject(req, config.privateKey);
  signedReq.sign_type = "SHA256WithRSA";

  return signedReq;
}

function createRawRequest({ prepayId, config }: {
  prepayId: string;
  config: any;
}) {
  const map = {
    appid: config.merchantAppId,
    merch_code: config.shortCode,
    nonce_str: tools.createNonceStr(),
    prepay_id: prepayId,
    timestamp: Math.ceil(Date.now() / 1000).toString(),
  };

  const sign = tools.signRequestObject(map, config.privateKey);

  return [
    `appid=${map.appid}`,
    `merch_code=${map.merch_code}`,
    `nonce_str=${map.nonce_str}`,
    `prepay_id=${map.prepay_id}`,
    `timestamp=${map.timestamp}`,
    `sign=${sign}`,
    'sign_type=SHA256WithRSA',
  ].join('&');
} 