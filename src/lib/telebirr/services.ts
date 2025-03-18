import { tools } from '@/utils/tools';

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

export async function applyFabricToken(config: {
  baseUrl: string;
  fabricAppId: string;
  appSecret: string;
}): Promise<TelebirrResponse> {
  try {
    console.log('\n=== FABRIC TOKEN REQUEST ===');
    console.log('URL:', `${config.baseUrl}/payment/v1/token`);
    console.log('Headers:', {
      'Content-Type': 'application/json',
      'X-APP-Key': config.fabricAppId,
    });
    console.log('Body:', {
      appSecret: '******' // masked for security
    });

    const response = await fetch(`${config.baseUrl}/payment/v1/token`, {
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
    console.log('Response:', {
      ...result,
      token: result.token ? `${result.token.substring(0, 10)}...` : undefined // Mask token
    });

    if (result.errorCode || result.result === 'FAIL') {
      throw new Error(`Telebirr API Error: ${result.errorMsg || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error('\n=== FABRIC TOKEN ERROR ===');
    console.error(error);
    throw error;
  }
}

export async function createOrder(params: {
  config: any;
  fabricToken: string;
  title: string;
  amount: string;
}) {
  try {
    const { config, fabricToken, title, amount } = params;
    
    console.log('\n=== CREATE ORDER REQUEST ===');
    console.log('Input Parameters:', {
      title,
      amount,
      baseUrl: config.baseUrl,
      merchantAppId: config.merchantAppId,
      shortCode: config.shortCode,
      notifyUrl: config.notifyUrl,
      redirectUrl: config.redirectUrl
    });

    const reqObject = createRequestObject({
      title,
      amount,
      config,
    });

    console.log('\n=== REQUEST OBJECT ===');
    console.log(JSON.stringify(reqObject, null, 2));

    console.log('\n=== API REQUEST ===');
    console.log('URL:', `${config.baseUrl}/payment/v1/merchant/preOrder`);
    console.log('Headers:', {
      'Content-Type': 'application/json',
      'X-APP-Key': config.fabricAppId,
      'Authorization': `${fabricToken.substring(0, 10)}...` // Mask token
    });

    const response = await fetch(`${config.baseUrl}/payment/v1/merchant/preOrder`, {
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
    console.log('Response:', JSON.stringify(result, null, 2));

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
    console.log('URL:', paymentUrl);
    
    return paymentUrl;

  } catch (error) {
    console.error('\n=== CREATE ORDER ERROR ===');
    console.error(error);
    throw error;
  }
}

function createRequestObject({ title, amount, config }: {
  title: string;
  amount: string;
  config: any;
}) {
  const timestamp = Math.ceil(Date.now() / 1000).toString();
  const nonceStr = tools.createNonceStr();
  
  const req = {
    timestamp,
    nonce_str: nonceStr,
    method: "payment.preorder",
    version: "1.0",
    biz_content: {
      notify_url: config.notifyUrl,
      redirect_url: config.redirectUrl,
      appid: config.merchantAppId,
      merch_code: config.shortCode,
      merch_order_id: `ORD${Date.now()}`,
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