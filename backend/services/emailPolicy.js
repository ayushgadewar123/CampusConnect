const BLOCKED_DOMAINS = new Set([
  'campusconnect.test',
  'campusconnect.local',
  'example.com',
  'example.net',
  'example.org',
  'localhost',
  'invalid',
]);

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const isValidEmailShape = (email) => {
  const value = normalizeEmail(email);
  if (!value) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [localPart, domain] = parts;
  if (!localPart || !domain) return false;
  if (!domain.includes('.')) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
};

const isBlockedDomain = (email) => {
  const value = normalizeEmail(email);
  if (!isValidEmailShape(value)) return true;
  const domain = value.split('@')[1];
  if (BLOCKED_DOMAINS.has(domain)) return true;
  if (domain.endsWith('.test') || domain.endsWith('.local')) return true;
  return false;
};

const shouldSendToEmail = (email) => {
  if (String(process.env.DISABLE_EMAILS || '').toLowerCase() === 'true') return false;
  if (!isValidEmailShape(email)) return false;
  return !isBlockedDomain(email);
};

const getEmailBulkCap = () => Math.max(Number(process.env.EMAIL_BULK_CAP || 25), 1);
const canSendBulkEmail = (recipientCount = 1) => recipientCount <= getEmailBulkCap();

module.exports = {
  normalizeEmail,
  isValidEmailShape,
  isBlockedDomain,
  shouldSendToEmail,
  getEmailBulkCap,
  canSendBulkEmail,
};
