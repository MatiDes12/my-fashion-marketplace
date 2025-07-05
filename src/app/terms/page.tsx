'use client';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-extrabold mb-8 text-gray-900 text-center">Terms and Service</h1>
      <div className="space-y-8 text-gray-700 text-base bg-white rounded-xl shadow-lg p-8">
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">1. Acceptance of Terms</h2>
          <p>By accessing or using our marketplace, you agree to be bound by these Terms and Service and all applicable laws and regulations. If you do not agree, please do not use our platform.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">2. User Responsibilities</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide accurate, current, and complete information during registration and checkout.</li>
            <li>Maintain the security of your account and promptly notify us of any unauthorized use.</li>
            <li>Comply with all applicable laws and regulations.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">3. Orders and Payments</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>All orders are subject to acceptance and availability.</li>
            <li>Prices and availability of products are subject to change without notice.</li>
            <li>Payments are processed securely through our payment partners. We do not store your payment information.</li>
            <li>By placing an order, you authorize us to charge your selected payment method for the total amount.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">4. Shipping, Delivery & Pickup</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Ensure your delivery address and contact information are accurate.</li>
            <li>Delivery and pickup options are subject to availability and may vary by seller.</li>
            <li>Estimated delivery times are provided for convenience and are not guaranteed.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">5. Returns, Refunds & Disputes</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>All sales are subject to our <a href="/return-policy" className="text-green-600 hover:underline">return and refund policy</a>.</li>
            <li>If you have an issue with your order, please contact our support team promptly.</li>
            <li>Disputes will be handled according to our dispute resolution process.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">6. Privacy</h2>
          <p>Your data will be handled in accordance with our <a href="/privacy-policy" className="text-green-600 hover:underline">privacy policy</a>. We respect your privacy and are committed to protecting your personal information.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">7. Intellectual Property</h2>
          <p>All content on this platform, including text, graphics, logos, and images, is the property of the marketplace or its licensors and is protected by copyright and other intellectual property laws.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">8. Limitation of Liability</h2>
          <p>We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability to you for any claim shall not exceed the amount paid by you for the product or service in question.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">9. Changes to Terms</h2>
          <p>We reserve the right to update or modify these Terms and Service at any time. Changes will be effective upon posting. Continued use of the platform constitutes acceptance of the revised terms.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-2 text-green-700">10. Contact Us</h2>
          <p>If you have any questions or concerns about these Terms and Service, please contact our support team at <a href="mailto:noreply@avrioxshop.com" className="text-green-600 hover:underline">noreply@avrioxshop.com</a>.</p>
        </section>
        <p className="mt-8 text-sm text-gray-500 text-center">Last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
} 