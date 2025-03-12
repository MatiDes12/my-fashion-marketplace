import React from 'react';

export function PaymentInstructions() {
  return (
    <div className="bg-blue-50 p-4 rounded-lg mb-6">
      <h3 className="text-lg font-medium text-blue-900 mb-2">
        Payment Instructions
      </h3>
      <ol className="list-decimal list-inside space-y-2 text-blue-800">
        <li>Press "Proceed" to open telebirr's payment page.</li>
        <li>Press "Login telebirr Account Payment".</li>
        <li>Enter your phone number and telebirr PIN.</li>
        <li>Press "Get Code" and you will receive a verification code from 127 (telebirr) via SMS.</li>
        <li>Enter this verification code and press "Next".</li>
        <li>Submit your telebirr PIN again on the next page and you're good to go!</li>
      </ol>
    </div>
  );
} 