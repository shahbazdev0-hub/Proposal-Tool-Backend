import * as fs from 'fs';
import * as path from 'path';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('email.user');
    const pass = this.configService.get<string>('email.password');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  async sendSaleReceipt(
    to: string,
    payload: {
      customerName: string;
      saleDate: string | null;
      installDate: string | null;
      waterType: string;
      packageName: string;
      financierName: string | null;
      loanOptionLabel: string | null;
      loanAmount: number;
      salesRepName: string;
      commissionAmount: number;
      commissionsPaid: boolean;
    },
  ): Promise<void> {
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const fmtDate = (d: string | null) =>
      d ? new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—';

    // Compute payroll week (Mon–Sun) containing the sale date
    const saleD = payload.saleDate ? new Date(payload.saleDate) : new Date();
    const dayOfWeek = saleD.getDay(); // 0=Sun
    const monday = new Date(saleD);
    monday.setDate(saleD.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekLabel = `${fmtDate(monday.toISOString())} - ${fmtDate(sunday.toISOString())}`;

    // process.cwd() is always the NestJS project root regardless of compiled dist/ output
    const logoPath = path.join(process.cwd(), 'src', 'email', 'logo.png');
    const hasLogo = fs.existsSync(logoPath);

    // ── HTML template ──────────────────────────────────────────────────────────

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">

  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden">

    <!-- Logo header -->
    <div style="padding:32px 40px;text-align:left;border-bottom:1px solid #e2e8f0">
      ${
        hasLogo
          ? `<img src="cid:logo" alt="SupremeHome" style="height:120px;width:auto;max-width:100%;display:block" />`
          : `<span style="font-size:22px;font-weight:700;color:#0f172a">SupremeHome</span>`
      }
    </div>

    <!-- Payroll week banner -->
    <div style="padding:16px 32px;text-align:center;border-bottom:1px solid #e2e8f0">
      <p style="margin:0;font-size:13px;color:#1e293b">Payroll Week</p>
      <p style="margin:4px 0 0;font-size:13px;color:#1e293b">${weekLabel}</p>
    </div>

    <!-- Detail table -->
    <table style="width:100%;border-collapse:collapse">
      <tbody>
        ${row('Sales Rep',    payload.salesRepName)}
        ${row('Customer',     payload.customerName)}
        ${row('Install Date', fmtDate(payload.installDate))}
        ${row('Package',      payload.packageName)}
        ${row('Financier',    payload.financierName ?? 'Cash')}
        ${row('Commission',   fmt(payload.commissionAmount), true)}
      </tbody>
    </table>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">
        This email was sent automatically by Commission Tracker.
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // Build attachments array — only include logo if it exists
    const attachments: nodemailer.SendMailOptions['attachments'] = hasLogo
      ? [{ filename: 'logo.png', path: logoPath, cid: 'logo' }]
      : [];

    try {
      await this.transporter.sendMail({
        from: `"SupremeHome" <${this.configService.get<string>('email.user')}>`,
        to,
        subject: `Sale Receipt — ${payload.customerName}`,
        html,
        attachments,
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to send email: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Sends the customer-facing proposal with the generated PDF attached.
   * Deliberately separate from sendSaleReceipt: different audience (the
   * customer, not internal payroll) and branding comes from company Settings
   * rather than the hard-coded internal template.
   */
  async sendProposal(
    to: string,
    payload: {
      customerName: string;
      companyName: string;
      primaryColor: string;
      packageName: string;
      cashPrice: number;
      monthlyPayment: number | null;
      pdf: Buffer;
    },
  ): Promise<void> {
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const accent = payload.primaryColor || '#1e293b';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
    <div style="padding:20px 32px;background:${accent}">
      <span style="font-size:18px;font-weight:700;color:#fff">${payload.companyName}</span>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 16px;font-size:15px;color:#0f172a">Hi ${payload.customerName},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6">
        Thank you for your time. Your personalised proposal for the
        <strong>${payload.packageName}</strong> is attached as a PDF.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tbody>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b">Total Cash Price</td>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;text-align:right;font-weight:700">${fmt(payload.cashPrice)}</td>
          </tr>
          ${
            payload.monthlyPayment != null
              ? `<tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b">Estimated Monthly Payment</td>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;text-align:right;font-weight:700">${fmt(payload.monthlyPayment)}</td>
          </tr>`
              : ''
          }
        </tbody>
      </table>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
        Please review the attached proposal and reach out with any questions.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">
        This proposal is an estimate. Financing terms are subject to lender approval.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${payload.companyName}" <${this.configService.get<string>('email.user')}>`,
        to,
        subject: `Your proposal from ${payload.companyName}`,
        html,
        attachments: [
          { filename: 'proposal.pdf', content: payload.pdf, contentType: 'application/pdf' },
        ],
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to send proposal email: ${(err as Error).message}`,
      );
    }
  }
}

// ── Helper: table row ─────────────────────────────────────────────────────────

function row(label: string, value: string, bold = false): string {
  return `
    <tr>
      <td style="padding:14px 32px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;width:45%;vertical-align:top">
        ${label}
      </td>
      <td style="padding:14px 32px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;${bold ? 'font-weight:700' : ''}">
        ${value}
      </td>
    </tr>
  `;
}
