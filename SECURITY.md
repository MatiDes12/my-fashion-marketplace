# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: **security@avrio.com** (or create a private security advisory)
3. Use GitHub's private vulnerability reporting feature:
   - Go to the Security tab
   - Click "Report a vulnerability"
   - Provide detailed information

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days (depending on severity)

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| Critical | Data breach, RCE, auth bypass | 24 hours |
| High | XSS, SSRF, injection attacks | 48 hours |
| Medium | Information disclosure, DoS | 7 days |
| Low | Minor issues, best practices | 30 days |

## Security Measures

### Authentication
- JWT-based authentication via Supabase
- Secure session management with auto-refresh
- Password requirements enforced

### Data Protection
- All data encrypted in transit (HTTPS/TLS)
- Database-level Row Level Security (RLS)
- Sensitive data never logged

### API Security
- Rate limiting (100 requests/minute per IP)
- Input validation on all endpoints
- CORS properly configured
- SQL injection prevention via parameterized queries

### Infrastructure
- Hosted on Vercel with automatic security updates
- Supabase managed database with security patches
- Environment variables for all secrets

## Security Headers

The application implements the following security headers:
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Dependency Management

- Regular `npm audit` checks
- Automated dependency updates via Dependabot
- Security scanning via GitHub Code Scanning

## Bug Bounty

We currently do not have a formal bug bounty program, but we appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities.

## Contact

For security-related inquiries:
- Email: security@avrio.com
- GitHub Security Advisories: [Create Advisory](https://github.com/MatiDes12/avrio/security/advisories/new)
