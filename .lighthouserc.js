module.exports = {
  ci: {
    collect: {
      // Default URLs for local runs; CI jobs may override via action inputs
      url: [
        'http://localhost:3000',
        'http://localhost:3000/products',
        'http://localhost:3000/cart',
        'http://localhost:3000/login',
        'http://localhost:3000/signup'
      ],
      // Do not auto-start the server here. Our workflows start the server
      // explicitly on the desired port to avoid port conflicts.
      numberOfRuns: 3,
      settings: {
        formFactor: 'desktop',
        screenEmulation: { disabled: true },
        // Help headless Chrome in CI
        chromeFlags: '--no-sandbox --disable-dev-shm-usage --ignore-certificate-errors --allow-insecure-localhost --disable-gpu --disable-web-security'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}; 