const crypto = require("crypto");
const pmlib = require("./sign-util-lib");

// Fields not participating in signature
const excludeFields = [
  "sign",
  "sign_type",
  "header",
  "refund_info",
  "openType",
  "raw_request",
  "biz_content",
];

// Dangerous keys that should never be processed (prevent prototype pollution)
const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

function signRequestObject(requestObject, privateKey) {
  let fields = [];
  let fieldMap = {};
  for (let key in requestObject) {
    // Skip inherited properties and dangerous keys
    if (!Object.prototype.hasOwnProperty.call(requestObject, key)) {
      continue;
    }
    if (excludeFields.indexOf(key) >= 0 || dangerousKeys.indexOf(key) >= 0) {
      continue;
    }
    fields.push(key);
    fieldMap[key] = requestObject[key];
  }
  // the fields in "biz_content" must Participating signature
  if (requestObject.biz_content && typeof requestObject.biz_content === 'object') {
    let biz = requestObject.biz_content;
    for (let key in biz) {
      // Skip inherited properties and dangerous keys
      if (!Object.prototype.hasOwnProperty.call(biz, key)) {
        continue;
      }
      if (excludeFields.indexOf(key) >= 0 || dangerousKeys.indexOf(key) >= 0) {
        continue;
      }
      fields.push(key);
      fieldMap[key] = biz[key];
    }
  }
  // sort by ascii
  fields.sort();

  let signStrList = [];
  for (let i = 0; i < fields.length; i++) {
    let key = fields[i];
    signStrList.push(key + "=" + fieldMap[key]);
  }
  let signOriginStr = signStrList.join("&");
  return signString(signOriginStr, privateKey);
}

let signString = (text, privateKey) => {
  const sha256withrsa = new pmlib.rs.KJUR.crypto.Signature({
    alg: "SHA256withRSAandMGF1",
  });
  sha256withrsa.init(privateKey);
  sha256withrsa.updateString(text);
  const sign = pmlib.rs.hextob64(sha256withrsa.sign());
  return sign;
};

function createTimeStamp() {
  return Math.round(new Date() / 1000) + "";
}

function createNonceStr() {
  let chars = [
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
    "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
    "U", "V", "W", "X", "Y", "Z"
  ];
  let str = "";
  for (let i = 0; i < 32; i++) {
    let index = parseInt(Math.random() * 35);
    str += chars[index];
  }
  return str;
}

export const tools = {
  signString,
  signRequestObject,
  createTimeStamp,
  createNonceStr,
};
