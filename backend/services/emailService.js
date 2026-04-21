const noopResult = (reason = "email_disabled") => ({ skipped: true, reason });

const sendEmail = async () => noopResult();
const deliverEmail = async () => noopResult();
const sendRegistrationEmail = async () => noopResult();
const sendCancellationEmail = async () => noopResult();
const sendWaitlistPromotionEmail = async () => noopResult();
const sendAnnouncementEmail = async () => noopResult();
const sendReminderEmail = async () => noopResult();
const sendDigestEmail = async () => noopResult();
const sendVerificationEmail = async () => noopResult();
const sendPasswordResetEmail = async () => noopResult();
const isNonRetryableSmtpError = () => true;

module.exports = {
  sendEmail,
  deliverEmail,
  sendRegistrationEmail,
  sendCancellationEmail,
  sendWaitlistPromotionEmail,
  sendAnnouncementEmail,
  sendReminderEmail,
  sendDigestEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  isNonRetryableSmtpError,
};
