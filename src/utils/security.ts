/**
 * Security utilities for the AVRIO marketplace
 * Provides sanitization functions for logging, input validation, and URL handling
 */

/**
 * Sanitizes a value for safe logging by removing/escaping newlines and control characters
 * Prevents log injection attacks where attackers inject fake log entries
 */
export function sanitizeForLog(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  const stringValue = typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);

  // Remove newlines, carriage returns, and other control characters
  // Replace with a safe representation
  return stringValue
    .replace(/[\r\n]/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .substring(0, 1000); // Limit length to prevent log flooding
}

/**
 * Safe console.log wrapper that sanitizes all arguments
 */
export function safeLog(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeForLog(arg));
  console.log(sanitizeForLog(message), ...sanitizedArgs);
}

/**
 * Safe console.error wrapper that sanitizes all arguments
 */
export function safeError(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeForLog(arg));
  console.error(sanitizeForLog(message), ...sanitizedArgs);
}

/**
 * Safe console.warn wrapper that sanitizes all arguments
 */
export function safeWarn(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeForLog(arg));
  console.warn(sanitizeForLog(message), ...sanitizedArgs);
}

/**
 * Validates that a URL is from an allowed domain
 * Prevents SSRF attacks by ensuring requests only go to trusted endpoints
 */
export function isAllowedUrl(url: string, allowedDomains: string[]): boolean {
  try {
    const parsedUrl = new URL(url);
    return allowedDomains.some(domain =>
      parsedUrl.hostname === domain ||
      parsedUrl.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Allowed domains for external API calls
 */
export const ALLOWED_API_DOMAINS = [
  'api.chapa.co',
  'api.telebirr.com',
  'app.telebirr.com',
  'api.stripe.com',
  'checkout.stripe.com',
  'api.pusher.com',
  'api.telegram.org',
  'api.safaricom.co.ke', // M-Pesa
];

/**
 * Validates and sanitizes a URL for safe external requests
 * Returns null if URL is invalid or not allowed
 */
export function validateExternalUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return null;
    }

    // Check against allowed domains
    if (!isAllowedUrl(url, ALLOWED_API_DOMAINS)) {
      safeError('Blocked request to unauthorized domain:', parsedUrl.hostname);
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Escapes HTML entities to prevent XSS
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return String(text).replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
}

/**
 * Validates that a string matches expected format (alphanumeric with limited special chars)
 * Useful for validating IDs, codes, etc.
 */
export function isValidIdentifier(value: string, maxLength = 100): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  if (value.length > maxLength) {
    return false;
  }

  // Allow alphanumeric, hyphens, and underscores only
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation - not too strict to avoid false negatives
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates phone number format (Ethiopian format)
 */
export function isValidEthiopianPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Ethiopian phone numbers: +251XXXXXXXXX or 0XXXXXXXXX
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(\+251|0)[1-9]\d{8}$/.test(cleaned);
}

/**
 * Rate limiting helper - tracks request counts per key
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Cleans up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Validates that an object only contains expected keys
 * Prevents prototype pollution and unexpected property injection
 */
export function validateObjectKeys<T extends Record<string, unknown>>(
  obj: unknown,
  allowedKeys: string[]
): obj is T {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }

  const keys = Object.keys(obj);
  return keys.every(key =>
    allowedKeys.includes(key) &&
    !['__proto__', 'constructor', 'prototype'].includes(key)
  );
}

/**
 * Safely accesses nested object properties without prototype pollution risk
 */
export function safeGet<T>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue: T
): T {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  const keys = path.split('.');

  if (keys.some(key => dangerousKeys.includes(key))) {
    return defaultValue;
  }

  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}
