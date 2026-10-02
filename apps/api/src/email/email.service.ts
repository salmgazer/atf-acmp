import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Resend } from "resend";

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

interface ParticipantWelcomeEmailParams {
  to: string;
  firstName: string;
  participantId: string;
  portalUrl: string;
}

interface MentorWelcomeEmailParams {
  to: string;
  firstName: string;
  lastName: string;
  cohortName?: string;
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
  private resendClient: Resend | null = null;
  private readonly resendFromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.mailchimpApiKey = this.configService.get<string>("email.mailchimpApiKey") || "";
    this.fromEmail = this.configService.get<string>("email.fromEmail") || "noreply@atf.africa";
    this.fromName = this.configService.get<string>("email.fromName") || "ATF AI Challenge";
    this.frontendUrl = this.configService.get<string>("FRONTEND_URL", "https://challenge.atf.africa");

    // Initialize SMTP transporter (used if SMTP_HOST is configured)
    const smtpHost = this.configService.get<string>("SMTP_HOST");
    if (smtpHost) {
      const smtpPort = this.configService.get<number>("SMTP_PORT", 587);
      // secure: true for port 465 (SSL), false for port 587 (STARTTLS)
      const smtpSecure = this.configService.get<string>("SMTP_SECURE", "false") === "true" || smtpPort === 465;
      
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: this.configService.get<string>("SMTP_USER")
          ? {
              user: this.configService.get<string>("SMTP_USER"),
              pass: this.configService.get<string>("SMTP_PASS"),
            }
          : undefined,
      });
      this.logger.log(`SMTP configured: ${smtpHost}:${smtpPort} (secure: ${smtpSecure})`);
    }

    // Initialize Resend client (used if RESEND_API_KEY is configured)
    const resendApiKey = this.configService.get<string>("RESEND_API_KEY");
    this.resendFromEmail = this.configService.get<string>("RESEND_FROM_EMAIL") || this.fromEmail;
    if (resendApiKey) {
      this.resendClient = new Resend(resendApiKey);
      this.logger.log(`Resend configured with from email: ${this.resendFromEmail}`);
    }
  }

  /**
   * Get the ATF logo URL for emails
   */
  private getLogoUrl(): string {
    return `${this.frontendUrl}/logos/email-logo.png`;
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

  async sendParticipantWelcomeEmail(params: ParticipantWelcomeEmailParams): Promise<void> {
    const { to, firstName, participantId, portalUrl } = params;

    const subject = "Welcome to ATF AI Challenge";
    const html = this.getParticipantWelcomeTemplate(firstName, participantId, portalUrl);

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
    // Try Resend first (primary email provider)
    if (this.resendClient) {
      try {
        const resendFromName = this.configService.get<string>("RESEND_FROM_NAME", this.fromName);
        
        await this.resendClient.emails.send({
          from: `${resendFromName} <${this.resendFromEmail}>`,
          to: [to],
          subject,
          html,
          text,
        });

        this.logger.log(`Email sent via Resend to ${to}`);
        return;
      } catch (error) {
        this.logger.warn(`Resend failed, trying next provider: ${error}`);
      }
    }

    // Try SMTP second (for local development with Mailpit or as fallback)
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
        this.logger.warn(`SMTP failed, trying Mailchimp: ${error}`);
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

  private getParticipantWelcomeTemplate(firstName: string, participantId: string, portalUrl: string): string {
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
                      Hi ${firstName},
                    </p>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      You have been registered as a participant in the ATF AI Challenge. We&apos;re excited to have you on board!
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      To access your account, use your <strong>email address</strong> and your <strong>Participant ID</strong> as your initial password.
                    </p>
                    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Your Participant ID:</p>
                      <p style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">${participantId}</p>
                    </div>
                    <p style="margin: 0 0 24px 0; color: #dc2626; font-size: 14px; line-height: 1.6;">
                      <strong>Important:</strong> You will be required to change your password on first login.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Login to Your Account
                          </a>
                        </td>
                      </tr>
                    </table>
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

  // ============ Mentor Welcome Email ============

  async sendMentorWelcomeEmail(params: MentorWelcomeEmailParams): Promise<boolean> {
    const { to, firstName, lastName, cohortName, portalUrl } = params;

    const subject = "Welcome to ATF AI Challenge - Mentor Portal";
    const html = this.getMentorWelcomeTemplate(firstName, lastName, cohortName, portalUrl);
    const text = `
Welcome to ATF AI Challenge!

Hi ${firstName},

You have been registered as a mentor for the ATF AI Challenge${cohortName ? ` (${cohortName})` : ""}. We're excited to have you on board!

As a mentor, you'll have the opportunity to guide and support teams as they work on their innovative projects.

To access your mentor portal, use your email address (${to}) and click "Request Login Code" to receive a verification code.

Access your portal: ${portalUrl}/mentor/login

What's Next?
- Set your availability for mentorship sessions
- Browse and claim teams you'd like to mentor
- Schedule sessions with your assigned teams

The ATF Team

© ${new Date().getFullYear()} African Technology Forum. All rights reserved.
    `;

    try {
      await this.sendEmail(to, subject, html, text);
      this.logger.log(`Mentor welcome email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send mentor welcome email to ${to}`, error);
      return false;
    }
  }

  private getMentorWelcomeTemplate(
    firstName: string,
    lastName: string,
    cohortName: string | undefined,
    portalUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ATF AI Challenge - Mentor Portal</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">Welcome, ${firstName}!</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Hi ${firstName},
                    </p>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      You have been registered as a <strong>mentor</strong> for the ATF AI Challenge${cohortName ? ` (${cohortName})` : ""}. We&apos;re excited to have you on board!
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      As a mentor, you&apos;ll have the opportunity to guide and support teams as they work on their innovative projects across Africa.
                    </p>
                    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                      <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600;">What&apos;s Next?</p>
                      <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                        <li>Set your availability for mentorship sessions</li>
                        <li>Browse and claim teams you&apos;d like to mentor</li>
                        <li>Schedule sessions with your assigned teams</li>
                      </ul>
                    </div>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Click the button below to access your mentor portal:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}/mentor/login" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Access Mentor Portal
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      Use your email address to log in. Click &quot;Request Login Code&quot; and you&apos;ll receive a verification code to access your account.
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

  /**
   * Send team invitation email to the invited participant
   */
  async sendTeamInvitationEmail(params: {
    to: string;
    invitedFirstName: string;
    inviterName: string;
    teamName: string;
    message?: string;
  }): Promise<boolean> {
    const { to, invitedFirstName, inviterName, teamName, message } = params;
    const portalUrl = this.frontendUrl;

    try {
      const html = this.getTeamInvitationTemplate(invitedFirstName, inviterName, teamName, message, portalUrl);
      await this.sendEmail(to, `You've been invited to join "${teamName}"`, html);
      this.logger.log(`Team invitation email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send team invitation email to ${to}`, error);
      return false;
    }
  }

  /**
   * Send confirmation email to the inviter that invitation was sent
   */
  async sendTeamInvitationConfirmation(params: {
    to: string;
    inviterFirstName: string;
    invitedName: string;
    teamName: string;
  }): Promise<boolean> {
    const { to, inviterFirstName, invitedName, teamName } = params;
    const portalUrl = this.frontendUrl;

    try {
      const html = this.getTeamInvitationConfirmationTemplate(inviterFirstName, invitedName, teamName, portalUrl);
      await this.sendEmail(to, `Invitation sent to ${invitedName}`, html);
      this.logger.log(`Team invitation confirmation email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send team invitation confirmation email to ${to}`, error);
      return false;
    }
  }

  private getTeamInvitationTemplate(
    invitedFirstName: string,
    inviterName: string,
    teamName: string,
    message: string | undefined,
    portalUrl: string
  ): string {
    const messageSection = message ? `
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: 600;">Message from ${inviterName}:</p>
        <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6; font-style: italic;">"${message}"</p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation - ATF AI Challenge</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">Team Invitation</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Hi ${invitedFirstName},
                    </p>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      <strong>${inviterName}</strong> has invited you to join their team <strong>"${teamName}"</strong> for the ATF AI Challenge!
                    </p>
                    ${messageSection}
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Log in to your participant portal to view the invitation and accept or decline.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}/app/team" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            View Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      This invitation will expire in 7 days. If you have any questions, please contact your team lead.
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

  private getTeamInvitationConfirmationTemplate(
    inviterFirstName: string,
    invitedName: string,
    teamName: string,
    portalUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation Sent - ATF AI Challenge</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">Invitation Sent!</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Hi ${inviterFirstName},
                    </p>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Your invitation to <strong>${invitedName}</strong> to join <strong>"${teamName}"</strong> has been sent successfully!
                    </p>
                    <div style="background: #ecfdf5; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #10b981;">
                      <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
                        <strong>${invitedName}</strong> has received an email notification and will see the invitation when they log in. The invitation will expire in 7 days.
                      </p>
                    </div>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      You can view all pending invitations in your team management page.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}/app/team" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            View Team
                          </a>
                        </td>
                      </tr>
                    </table>
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

  /**
   * Send email to team leads/co-leads when someone requests to join their team
   */
  async sendTeamJoinRequestEmail(params: {
    to: string;
    leaderFirstName: string;
    requesterName: string;
    teamName: string;
  }): Promise<boolean> {
    const { to, leaderFirstName, requesterName, teamName } = params;
    const portalUrl = this.frontendUrl;

    try {
      const html = this.getTeamJoinRequestTemplate(leaderFirstName, requesterName, teamName, portalUrl);
      await this.sendEmail(to, `${requesterName} wants to join "${teamName}"`, html);
      this.logger.log(`Team join request email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send team join request email to ${to}`, error);
      return false;
    }
  }

  private getTeamJoinRequestTemplate(
    leaderFirstName: string,
    requesterName: string,
    teamName: string,
    portalUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Join Request - ATF AI Challenge</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                ${this.getEmailHeader()}
                <tr>
                  <td style="padding: 0 40px 32px 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600; text-align: center;">New Join Request</h1>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Hi ${leaderFirstName},
                    </p>
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      <strong>${requesterName}</strong> has requested to join your team <strong>"${teamName}"</strong>.
                    </p>
                    <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>Action Required:</strong> Please review this request and approve or decline it from your team management page.
                      </p>
                    </div>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                      Log in to review the request and manage your team members.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}/app/team" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Review Request
                          </a>
                        </td>
                      </tr>
                    </table>
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
