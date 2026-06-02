import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const template = searchParams.get('template') || 'guest-invitation';
  const name = searchParams.get('name') || 'Carlos';
  const companyName = searchParams.get('company') || 'White Cloak Technologies, Inc.';
  const inviterEmail = searchParams.get('inviterEmail') || 'sabine@whitecloak.com';
  const inviterName = searchParams.get('inviterName') || 'Sabine Beatrix Dy';
  const recipientEmail = searchParams.get('recipientEmail') || 'melco.gulbe@whitecloak.com';
  const send = searchParams.get('send') === 'true';

  const templates: Record<string, string> = {
    'guest-invitation': getGuestInvitationTemplate(name, companyName, inviterEmail, inviterName),
    // Add more templates here as needed
  };

  const htmlContent = templates[template] || templates['guest-invitation'];

  // If send=true, send the email via nodemailer
  if (send) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      
      await transporter.sendMail({
        from: `"Jia" <${process.env.GMAIL_USER}>`,
        to: recipientEmail,
        subject: `Jia | ${companyName} has invited you to join`,
        html: htmlContent,
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `Email sent to ${recipientEmail}`,
      });
    } catch (error: any) {
      console.error('Email sending error:', error?.message || error);
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to send email' },
        { status: 500 }
      );
    }
  }

  // Otherwise just return the HTML preview
  return new NextResponse(htmlContent, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

function getGuestInvitationTemplate(
  name: string,
  companyName: string,
  inviterEmail: string,
  inviterName: string
): string {
  const JIA_LOGO_URL = "https://cdn.hellojia.ai/public-assets/jia-logo-header.png";
  const WHITECLOAK_LOGO_URL =
    "https://cdn.hellojia.ai/public-assets/whitecloak-logo.png";
  const HANDS_ICON_URL =
    "https://cdn.hellojia.ai/public-assets/hands-thumbs-up.png";
  
  // Build magic link through /auth/callback for Google SSO login
  const baseUrl = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN 
    ? `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}` 
    : 'http://localhost:3000';
  const redirectPath = '/guest-portal/careers';
  const LOGIN_URL = `${baseUrl}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jia Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif; background-color: #F8F9FC; padding: 40px 20px; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8F9FC;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; padding: 24px;">
          <!-- Header with gradient and Jia Logo -->
          <tr>
            <td align="center" style="background: linear-gradient(90deg, #A8C5E8 0%, #E8B5D0 100%); padding: 40px 24px; text-align: center; border-radius: 8px; height: 120px;">
              <img src="${JIA_LOGO_URL}" alt="Jia Logo" style="height: 60px; width: auto; display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <h1 style="font-size: 24px; font-weight: 700; color: #1A1625; margin: 0 0 24px 0;">Hi ${name}!</h1>
              
              <div style="margin: 20px 0;">
                <img src="${WHITECLOAK_LOGO_URL}" alt="White Cloak Technologies" style="width: 128px; height: 32px; display: block; margin: 0 auto;" />
              </div>
              
              <div style="font-size: 20px; font-weight: 700; color: #1A1625; margin: 0;">${companyName}</div>
              <p style="font-size: 18px; color: #717680; margin: 0 0 32px 0; font-weight: 500;">has invited you to join Jia</p>
              
              <div style="margin: 24px 0;">
                <img src="${HANDS_ICON_URL}" alt="Hands Icon" style="height: 120px; width: auto; display: block; margin: 0 auto;">
              </div>
              
              <h2 style="font-size: 24px; font-weight: 700; color: #1A1625; margin: 0 0 16px 0;">Welcome to Jia!</h2>
              
              <p style="font-size: 16px; color: #717680; margin: 0 0 16px 0; line-height: 1.6;">
                ${inviterName} (${inviterEmail}) has invited you as a guest at ${companyName} on Jia.
              </p>
              
              <p style="font-size: 16px; color: #717680; margin: 0 0 16px 0; line-height: 1.6;">
                If you have any questions, please contact our support team.
              </p>
              
              <p style="font-size: 16px; color: #717680; margin: 0 0 24px 0; line-height: 1.6;">
                Best regards,<br>
                Jia Team
              </p>
              
              <a href="${LOGIN_URL}" style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 12px 120px; border: 1px solid #999999; border-radius: 50px; text-decoration: none; font-size: 17px; font-weight: 550;">Log In</a>
            </td>
          </tr>
        </table>
        
        <!-- Footer outside card -->
        <div style="margin-top: 24px; text-align: center;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #717680;">© Jia</div>
          <p style="margin: 0; font-size: 12px; color: #717680;">Please do not reply to this email. This is a system generated email.</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
