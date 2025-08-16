// Simple test to verify Stripe integration
const { convertETBToUSD, convertUSDToETB, formatAmountForStripe } = require('./src/lib/stripe');

console.log('🧪 Testing Stripe Integration...\n');

// Test currency conversion
const testAmountETB = 1000; // 1000 ETB
const convertedUSD = convertETBToUSD(testAmountETB);
const backToETB = convertUSDToETB(convertedUSD);
const stripeAmount = formatAmountForStripe(convertedUSD);

console.log('💱 Currency Conversion Tests:');
console.log(`ETB ${testAmountETB} → USD $${convertedUSD}`);
console.log(`USD $${convertedUSD} → ETB ${backToETB}`);
console.log(`Stripe amount (cents): ${stripeAmount}\n`);

// Test with your actual cart amounts
const cartAmounts = [100, 500, 1500, 5000]; // Common cart amounts in ETB

console.log('🛒 Sample Cart Conversions:');
cartAmounts.forEach(amount => {
  const usd = convertETBToUSD(amount);
  const cents = formatAmountForStripe(usd);
  console.log(`ETB ${amount} → USD $${usd} → Stripe ${cents} cents`);
});

console.log('\n✅ Stripe integration ready!');
console.log('\n📝 Next Steps:');
console.log('1. Start your development server: npm run dev');
console.log('2. Go to checkout and select "Credit/Debit Card (USD)"');
console.log('3. Use test card: 4242 4242 4242 4242');
console.log('4. Set up webhook for production (see setup-stripe.md)');
