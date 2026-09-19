import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

interface MagicLinkEmailParams {
  to: string;
  code: string;
  firstName?: string;
  expiryMinutes: number;
}

interface WelcomeEmailParams {
  to: string;
  firstName?: string;
  temporaryPassword?: string;
  portalUrl: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly mailchimpApiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.mailchimpApiKey = this.configService.get<string>("email.mailchimpApiKey") || "";
    this.fromEmail = this.configService.get<string>("email.fromEmail") || "noreply@acmp.com";
    this.fromName = this.configService.get<string>("email.fromName") || "ACMP Platform";

    // Initialize SMTP transporter for local development
    const smtpHost = this.configService.get<string>("SMTP_HOST");
    if (smtpHost) {
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: this.configService.get<number>("SMTP_PORT", 1025),
        secure: false,
        auth: this.configService.get<string>("SMTP_USER")
          ? {
              user: this.configService.get<string>("SMTP_USER"),
              pass: this.configService.get<string>("SMTP_PASS"),
            }
          : undefined,
      });
      this.logger.log(`SMTP configured: ${smtpHost}:${this.configService.get<number>("SMTP_PORT", 1025)}`);
    }
  }

  async sendMagicLinkCode(params: MagicLinkEmailParams): Promise<void> {
    const { to, code, firstName, expiryMinutes } = params;

    const subject = `Your ACMP Login Code: ${code}`;
    const html = this.getMagicLinkTemplate(code, firstName, expiryMinutes);

    await this.sendEmail(to, subject, html);
  }

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
    const { to, firstName, temporaryPassword, portalUrl } = params;

    const subject = "Welcome to ACMP Platform";
    const html = this.getWelcomeTemplate(firstName, temporaryPassword, portalUrl);

    await this.sendEmail(to, subject, html);
  }

  async sendPasswordResetCode(to: string, code: string, firstName?: string): Promise<void> {
    const subject = `Your ACMP Password Reset Code: ${code}`;
    const html = this.getPasswordResetTemplate(code, firstName);

    await this.sendEmail(to, subject, html);
  }

  /**
   * Send a custom email with provided subject and HTML content
   */
  async sendCustomEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    await this.sendEmail(to, subject, html, text);
  }

  private async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    // Try SMTP first (for local development with Mailpit)
    if (this.smtpTransporter) {
      try {
        const smtpFromEmail = this.configService.get<string>("SMTP_FROM_EMAIL", this.fromEmail);
        const smtpFromName = this.configService.get<string>("SMTP_FROM_NAME", this.fromName);

        await this.smtpTransporter.sendMail({
          from: `"${smtpFromName}" <${smtpFromEmail}>`,
          to,
          subject,
          html,
          text,
        });

        this.logger.log(`Email sent via SMTP to ${to}`);
        return;
      } catch (error) {
        this.logger.warn(`SMTP failed, falling back to Mailchimp: ${error}`);
      }
    }

    // Fall back to Mailchimp
    if (!this.mailchimpApiKey) {
      this.logger.warn(`Email not sent (no API key configured): ${to} - ${subject}`);
      this.logger.debug(`Email content: ${html}`);
      return;
    }

    try {
      // Mailchimp Transactional API (Mandrill)
      const response = await fetch("https://mandrillapp.com/api/1.0/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: this.mailchimpApiKey,
          message: {
            from_email: this.fromEmail,
            from_name: this.fromName,
            to: [{ email: to, type: "to" }],
            subject,
            html,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Mailchimp API error: ${error}`);
      }

      this.logger.log(`Email sent via Mailchimp to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  private getMagicLinkTemplate(code: string, firstName?: string, expiryMinutes = 15): string {
    const greeting = firstName ? `Hi ${firstName},` : "Hi,";
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Login Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ACMP Platform</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">${greeting}</p>
          <p style="font-size: 16px;">Your login verification code is:</p>
          <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #666;">This code will expire in ${expiryMinutes} minutes.</p>
          <p style="font-size: 14px; color: #666;">If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message from ACMP Platform. Please do not reply.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeTemplate(firstName?: string, temporaryPassword?: string, portalUrl?: string): string {
    const greeting = firstName ? `Hi ${firstName},` : "Hi,";
    
    let passwordSection = "";
    if (temporaryPassword) {
      passwordSection = `
        <p style="font-size: 16px;">Your temporary password is:</p>
        <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 18px; font-weight: bold; color: #667eea;">${temporaryPassword}</span>
        </div>
        <p style="font-size: 14px; color: #e74c3c;"><strong>Important:</strong> You will be required to change your password on first login.</p>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ACMP</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ACMP Platform</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">${greeting}</p>
          <p style="font-size: 16px;">Welcome to the ACMP AI Challenge Management Platform! Your account has been created.</p>
          ${passwordSection}
          ${portalUrl ? `<p style="font-size: 16px;"><a href="${portalUrl}" style="color: #667eea;">Click here to login</a></p>` : ""}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message from ACMP Platform. Please do not reply.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetTemplate(code: string, firstName?: string): string {
    const greeting = firstName ? `Hi ${firstName},` : "Hi,";
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">${greeting}</p>
          <p style="font-size: 16px;">Your password reset code is:</p>
          <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #666;">This code will expire in 15 minutes.</p>
          <p style="font-size: 14px; color: #666;">If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message from ACMP Platform. Please do not reply.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  async sendOrganizationInvite(
    organizationName: string,
    email: string,
    customMessage?: string
  ): Promise<boolean> {
    const portalUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");

    const html = this.getOrganizationInviteTemplate(organizationName, email, portalUrl, customMessage);
    const text = `
You're Invited to ATF AI Challenge!

Hello ${organizationName},

You have been invited to participate in the ATF AI Challenge. This is an exciting opportunity to submit a brief and work with talented participants across Africa.

${customMessage ? `Message from ATF Team: "${customMessage}"` : ""}

Access your organization portal: ${portalUrl}/org/login

Use your email address ${email} to log in. You will receive a verification code to access your account.

© ${new Date().getFullYear()} African Technology Forum. All rights reserved.
    `;

    try {
      await this.sendEmail(email, "You're Invited to ATF AI Challenge", html, text);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send invite to ${email}`, error);
      return false;
    }
  }

  async sendBriefRevisionRequest(
    organizationName: string,
    email: string,
    briefTitle: string,
    feedback: string,
    briefId: string
  ): Promise<boolean> {
    const portalUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const briefUrl = `${portalUrl}/org/briefs/${briefId}`;

    const html = this.getBriefRevisionTemplate(organizationName, briefTitle, feedback, briefUrl);
    const text = `
Brief Revision Requested

Hello ${organizationName},

Your brief "${briefTitle}" requires some changes before it can be approved.

Reviewer Feedback:
${feedback}

Please review the feedback and update your brief at: ${briefUrl}

© ${new Date().getFullYear()} African Technology Forum. All rights reserved.
    `;

    try {
      await this.sendEmail(email, `Brief Revision Requested: ${briefTitle}`, html, text);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send revision request email to ${email}`, error);
      return false;
    }
  }

  private getBriefRevisionTemplate(
    organizationName: string,
    briefTitle: string,
    feedback: string,
    briefUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Brief Revision Requested</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Revision Requested</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Hello <strong>${organizationName}</strong>,
                    </p>
                    <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Your brief <strong>"${briefTitle}"</strong> has been reviewed and requires some changes before it can be approved.
                    </p>
                    <div style="margin: 24px 0; padding: 20px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">Reviewer Feedback:</p>
                      <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${feedback}</p>
                    </div>
                    <p style="margin: 0 0 24px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Please review the feedback and update your brief accordingly:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${briefUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            View &amp; Edit Brief
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                      After making the requested changes, remember to resubmit your brief for review.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 40px; background-color: #f4f4f5; text-align: center;">
                    <p style="margin: 0; color: #71717a; font-size: 12px;">
                      © ${new Date().getFullYear()} African Technology Forum. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getOrganizationInviteTemplate(
    organizationName: string,
    email: string,
    portalUrl: string,
    customMessage?: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're Invited to ATF AI Challenge</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">ATF AI Challenge</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">You're Invited!</h2>
                    <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Hello <strong>${organizationName}</strong>,
                    </p>
                    <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      You have been invited to participate in the ATF AI Challenge. This is an exciting opportunity to submit a brief and work with talented participants across Africa.
                    </p>
                    ${customMessage ? `
                    <div style="margin: 24px 0; padding: 16px; background-color: #f4f4f5; border-radius: 8px; border-left: 4px solid #667eea;">
                      <p style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.6; font-style: italic;">"${customMessage}"</p>
                    </div>
                    ` : ""}
                    <p style="margin: 0 0 24px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Click the button below to access your organization portal and submit your brief:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}/org/login" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Access Portal
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                      Use your email address <strong>${email}</strong> to log in. You will receive a verification code to access your account.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 40px; background-color: #f4f4f5; text-align: center;">
                    <p style="margin: 0; color: #71717a; font-size: 12px;">
                      © ${new Date().getFullYear()} African Technology Forum. All rights reserved.
                    </p>
                    <p style="margin: 8px 0 0 0; color: #a1a1aa; font-size: 12px;">
                      If you did not expect this invitation, please ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
