const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendVerificationEmail = async (toEmail, verificationToken) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Verify your HiddenGem account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #2d6a4f;">Welcome to HiddenGem! 💎</h2>
        <p>Thanks for signing up. Click the button below to verify your email address.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background-color: #2d6a4f; color: white;
                  padding: 0.75rem 2rem; border-radius: 8px; text-decoration: none;
                  font-weight: 600; margin: 1rem 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 0.875rem;">
          Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a>
        </p>
        <p style="color: #999; font-size: 0.75rem;">
          This link expires in 24 hours. If you didn't create an account, you can ignore this email.
        </p>
      </div>
    `,
  };

  await sgMail.send(msg);
};

module.exports = { sendVerificationEmail };