export const EMAIL_CONFIG = {
  SUPPORT: 'info@avrioxshop.com',
  SIGNUP: 'avriosignup@avrioxshop.com',
  NO_REPLY: 'noreply@avrioxshop.com',
  SENDER_NAME: 'Avrio'
} as const;

export type EmailPurpose = 'support' | 'signup' | 'noreply';

export const getEmailConfig = (purpose: EmailPurpose) => {
  return {
    email: EMAIL_CONFIG[purpose === 'support' ? 'SUPPORT' : 
           purpose === 'signup' ? 'SIGNUP' : 'NO_REPLY'],
    name: EMAIL_CONFIG.SENDER_NAME
  };
}; 