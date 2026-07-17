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

  async sendSaleReceipt(to: string, payload: {
    customerName: string;
    saleDate: string;
    installDate: string | null;
    waterType: string;
    packageName: string;
    financierName: string | null;
    loanOptionLabel: string | null;
    loanAmount: number;
    salesRepName: string;
    commissionsPaid: boolean;
  }): Promise<void> {
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const fmtDate = (d: string | null) =>
      d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
        <h2 style="background:#0f172a;color:#fff;padding:20px 24px;margin:0;border-radius:8px 8px 0 0">
          Sale Receipt — Commission Tracker
        </h2>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p style="margin:0 0 20px;color:#64748b;font-size:13px">
            Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="background:#f8fafc">
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;width:40%">Customer</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${payload.customerName}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Sale Date</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${fmtDate(payload.saleDate)}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Install Date</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${fmtDate(payload.installDate)}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Water Type</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${payload.waterType === 'supreme' ? 'Supreme' : 'Homewater'}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Package</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${payload.packageName}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Financier</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${payload.financierName ?? 'Cash (no financing)'}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Loan Option</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${payload.loanOptionLabel ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Loan Amount</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${fmt(payload.loanAmount)}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Sales Rep</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">${payload.salesRepName}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Commission Status</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0">
                <span style="padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;
                  background:${payload.commissionsPaid ? '#dcfce7' : '#fef9c3'};
                  color:${payload.commissionsPaid ? '#16a34a' : '#a16207'}">
                  ${payload.commissionsPaid ? 'Paid' : 'Due'}
                </span>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center">
            This email was sent automatically by Commission Tracker.
          </p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Commission Tracker" <${this.configService.get<string>('email.user')}>`,
        to,
        subject: `Sale Receipt — ${payload.customerName}`,
        html,
      });
    } catch (err) {
      throw new InternalServerErrorException(`Failed to send email: ${(err as Error).message}`);
    }
  }
}
