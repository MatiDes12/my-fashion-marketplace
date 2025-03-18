const config = {
  baseUrl: "https://app.ethiomobilemoney.et:2121",
  webBaseUrl: "https://checkout.ethiomobilemoney.et",
  merchantAppId: process.env.MERCHANT_APP_ID,
  fabricAppId: process.env.FABRIC_APP_ID,
  appSecret: process.env.APP_SECRET,
  privateKey: process.env.PRIVATE_KEY,
  shortCode: process.env.SHORT_CODE,
  notifyUrl: process.env.NOTIFY_URL,
  redirectUrl: process.env.REDIRECT_URL,
};

module.exports = config; 