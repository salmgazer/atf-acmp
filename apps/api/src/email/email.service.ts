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
  private readonly frontendUrl: string;
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.mailchimpApiKey = this.configService.get<string>("email.mailchimpApiKey") || "";
    this.fromEmail = this.configService.get<string>("email.fromEmail") || "noreply@atf.africa";
    this.fromName = this.configService.get<string>("email.fromName") || "ATF AI Challenge";
    this.frontendUrl = this.configService.get<string>("FRONTEND_URL", "https://challenge.atf.africa");

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

  /**
   * Get the ATF logo URL for emails
   */
  private getLogoUrl(): string {
    return `${this.frontendUrl}/logos/full/Full-color-logo.png`;
  }

  /**
   * Get the common email footer with "The ATF Team" and logo
   */
  private getEmailFooter(): string {
    return `
      <tr>
        <td style="padding: 32px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
          <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; font-weight: 500;">
            The ATF Team
          </p>
          <img src="${this.getLogoUrl()}" alt="ATF Logo" style="height: 40px; width: auto;" />
          <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} African Technology Forum. All rights reserved.
          </p>
        </td>
      </tr>
    `;
  }

  /**
   * Get the common email header with logo
   */
  private getEmailHeader(): string {
    return `
      <tr>
        <td style="padding: 32px 40px; text-align: center;">
          <img src="${this.getLogoUrl()}" alt="ATF Logo" style="height: 50px; width: auto;" />
        </td>
      </tr>
    `;
  }

  async sendMagicLinkCode(params: MagicLinkEmailParams): Promise<void> {
    const { to, code, firstName, expiryMinutes } = params;

    const subject = `Your ATF Login Code: ${code}`;
    const html = this.getMagicLinkTemplate(code, firstName, expiryMinutes);

    await this.sendEmail(to, subject, html);
  }

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
    const { to, firstName, temporaryPassword, portalUrl } = params;

    const subject = "Welcome to ATF AI Challenge";
    const html = this.getWelcomeTemplate(firstName, temporaryPassword, portalUrl);

    await this.sendEmail(to, subject, html);
  }

  async sendPasswordResetCode(to: string, code: string, firstName?: string): Promise<void> {
    const subject = `Your ATF Password Reset Code: ${code}`;
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
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">Your Login Code</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      ${greeting}
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Use the following code to complete your login:
                    </p>
                    <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</span>
                    </div>
                    <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      This code will expire in <strong>${expiryMinutes} minutes</strong>.
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      If you didn&apos;t request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getWelcomeTemplate(firstName?: string, temporaryPassword?: string, portalUrl?: string): string {
    const greeting = firstName ? `Hi ${firstName},` : "Hi,";
    
    let passwordSection = "";
    if (temporaryPassword) {
      passwordSection = `
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
          Your temporary password is:
        </p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
          <span style="font-size: 18px; font-weight: 600; color: #111827;">${temporaryPassword}</span>
        </div>
        <p style="margin: 0 0 24px 0; color: #dc2626; font-size: 14px; line-height: 1.6;">
          <strong>Important:</strong> You will be required to change your password on first login.
        </p>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ATF AI Challenge</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">Welcome to ATF AI Challenge!</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      ${greeting}
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Your account has been created successfully. We&apos;re excited to have you join the ATF AI Challenge!
                    </p>
                    ${passwordSection}
                    ${portalUrl ? `
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Login to Your Account
                          </a>
                        </td>
                      </tr>
                    </table>
                    ` : ""}
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
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
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">Password Reset</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      ${greeting}
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      We received a request to reset your password. Use the following code to complete the process:
                    </p>
                    <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</span>
                    </div>
                    <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      This code will expire in <strong>15 minutes</strong>.
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      If you didn&apos;t request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  async sendOrganizationInvite(
    organizationName: string,
    email: string,
    customMessage?: string
  ): Promise<boolean> {
    const portalUrl = this.frontendUrl;

    const html = this.getOrganizationInviteTemplate(organizationName, email, portalUrl, customMessage);
    const text = `
You're Invited to ATF AI Challenge!

Hello ${organizationName},

You have been invited to participate in the ATF AI Challenge. This is an exciting opportunity to submit a brief and work with talented participants across Africa.

${customMessage ? `Message from ATF Team: "${customMessage}"` : ""}

Access your organization portal: ${portalUrl}/org/login

Use your email address ${email} to log in. You will receive a verification code to access your account.

The ATF Team

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
    const portalUrl = this.frontendUrl;
    const briefUrl = `${portalUrl}/org/briefs/${briefId}`;

    const html = this.getBriefRevisionTemplate(organizationName, briefTitle, feedback, briefUrl);
    const text = `
Brief Revision Requested

Hello ${organizationName},

Your brief "${briefTitle}" requires some changes before it can be approved.

Reviewer Feedback:
${feedback}

Please review the feedback and update your brief at: ${briefUrl}

The ATF Team

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
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">Revision Requested</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Hello <strong>${organizationName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Your brief <strong>&quot;${briefTitle}&quot;</strong> has been reviewed and requires some changes before it can be approved.
                    </p>
                    <div style="margin: 0 0 24px 0; padding: 20px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">Reviewer Feedback:</p>
                      <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${feedback}</p>
                    </div>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Please review the feedback and update your brief accordingly:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${briefUrl}" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            View &amp; Edit Brief
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      After making the requested changes, remember to resubmit your brief for review.
                    </p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
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
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">You&apos;re Invited!</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Hello <strong>${organizationName}</strong>,
                    </p>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      You have been invited to participate in the ATF AI Challenge. This is an exciting opportunity to submit a brief and work with talented participants across Africa.
                    </p>
                    ${customMessage ? `
                    <div style="margin: 0 0 24px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid #111827;">
                      <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; font-style: italic;">&quot;${customMessage}&quot;</p>
                    </div>
                    ` : ""}
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Click the button below to access your organization portal and submit your brief:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}/org/login" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Access Portal
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      Use your email address <strong>${email}</strong> to log in. You will receive a verification code to access your account.
                    </p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
