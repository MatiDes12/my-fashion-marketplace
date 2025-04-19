import React from 'react';

export default function SecurityPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 bg-white shadow-sm rounded-lg my-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Security Policy</h1>
      
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Reporting Security Issues</h2>
        <div className="prose prose-gray max-w-none">
          <p className="mb-4 text-gray-700">
            We take the security of Avriox Shop seriously. If you believe you have found a security vulnerability, please report it to us as described below.
          </p>
          <p className="mb-4 text-gray-900 font-medium bg-yellow-50 p-4 rounded border border-yellow-200">
            Please do NOT report security vulnerabilities through public GitHub issues, discussions, or pull requests.
          </p>
          <p className="mb-4 text-gray-700">
            Instead, please report them via email to:{' '}
            <a href="mailto:security@avrioxshop.com" className="text-blue-600 hover:text-blue-800 font-medium">
              security@avrioxshop.com
            </a>
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Reporting Format</h2>
        <p className="mb-4 text-gray-700">Please include the following information in your report:</p>
        <ul className="list-disc ml-6 mb-4 text-gray-700 space-y-2">
          <li>Description of the vulnerability</li>
          <li>Steps to reproduce the issue</li>
          <li>Potential impact of the vulnerability</li>
          <li>Suggestions for mitigating the issue (if any)</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Response Policy</h2>
        <p className="mb-4 text-gray-700">When you submit a vulnerability report, you can expect:</p>
        <ul className="list-disc ml-6 mb-4 text-gray-700 space-y-2">
          <li>Confirmation of receipt within 24 hours</li>
          <li>Initial assessment and response within 48 hours</li>
          <li>Regular updates on the progress of the fix</li>
          <li>Notification when the vulnerability is fixed</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Scope</h2>
        <p className="mb-4 text-gray-700">This security policy applies to:</p>
        <ul className="list-disc ml-6 mb-4 text-gray-700 space-y-2">
          <li>The main Avriox Shop website (www.avrioxshop.com)</li>
          <li>All subdomains of avrioxshop.com</li>
          <li>Mobile applications (if applicable)</li>
          <li>API endpoints</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Safe Harbor</h2>
        <div className="bg-green-50 border border-green-200 rounded p-4 text-gray-700">
          <p className="mb-4">
            We support responsible disclosure practices and do not take legal action against individuals who submit security vulnerability reports according to this policy.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Out of Scope</h2>
        <ul className="list-disc ml-6 mb-4 text-gray-700 space-y-2">
          <li>DOS/DDOS attacks</li>
          <li>Spam attacks</li>
          <li>Social engineering attacks</li>
          <li>Physical security attacks</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Recognition</h2>
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-gray-700">
          <p className="mb-4">
            We believe in recognizing security researchers who help us keep Avriox Shop secure. With permission, we will publicly acknowledge security researchers who report valid security vulnerabilities.
          </p>
        </div>
      </section>
    </div>
  );
} 