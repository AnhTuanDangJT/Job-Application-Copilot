import sgMail from "@sendgrid/mail";

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface SendVerificationEmailParams {
  email: string;
  code: string;
  name: string;
}

/**
 * Send verification email via SendGrid
 */
export async function sendVerificationEmail({
  email,
  code,
  name,
}: SendVerificationEmailParams): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  const fromEmail = "noreply@jobcopilot.online";
  const subject = "Verify your Job Application Copilot account";

  // Plain text version
  const textContent = `
Hello ${name},

Thank you for signing up for Job Application Copilot!

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't create an account, please ignore this email.

Best regards,
Job Application Copilot Team
  `.trim();

  // HTML version
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to bottom right, #F8F5F2, #F4E2D4); padding: 30px; border-radius: 12px; border: 1px solid #CAAE92;">
    <h1 style="color: #734C23; margin-top: 0; font-size: 24px;">Welcome to Job Application Copilot!</h1>
    
    <p style="color: #1F2937; font-size: 16px;">Hello ${name},</p>
    
    <p style="color: #1F2937; font-size: 16px;">Thank you for signing up! To complete your registration, please verify your email address using the code below:</p>
    
    <div style="background: white; border: 2px solid #9C6A45; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
      <div style="font-size: 32px; font-weight: bold; color: #734C23; letter-spacing: 4px; font-family: 'Courier New', monospace;">
        ${code}
      </div>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
      <strong>Important:</strong> This code will expire in <strong>10 minutes</strong>.
    </p>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
      If you didn't create an account, please ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #CAAE92; margin: 30px 0;">
    
    <p style="color: #6B7280; font-size: 12px; margin-bottom: 0;">
      Best regards,<br>
      Job Application Copilot Team
    </p>
  </div>
</body>
</html>
  `.trim();

  const msg = {
    to: email,
    from: fromEmail,
    subject,
    text: textContent,
    html: htmlContent,
  };

  try {
    await sgMail.send(msg);
    console.log(`[EMAIL] Verification email sent to ${email}`);
  } catch (error) {
    console.error("[EMAIL] Failed to send verification email:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to send verification email");
  }
}



