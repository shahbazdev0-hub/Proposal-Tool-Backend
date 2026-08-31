import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { SettingsService } from '../settings/settings.service';
import { ProposalDocument } from './schemas/proposal.schema';

// This renderer is a deliberate 1:1 port of the print stylesheet in
// frontend/src/app/(protected)/proposals/[id]/page.tsx, so "Print" and
// "Download PDF" produce the same document. Any change to one must be
// mirrored in the other — the measurements below map directly to that CSS.

const CM = 28.3465; // 1cm in PostScript points
const PAGE_W = 612; // LETTER
const PAGE_H = 792;
const MARGIN = { top: 1.5 * CM, bottom: 1.5 * CM, left: 2 * CM, right: 2 * CM };
const CW = PAGE_W - MARGIN.left - MARGIN.right; // content width

// Palette lifted from the print CSS
const INK = '#1a1a1a';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_600 = '#475569';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const GREY_666 = '#666666';
const HAIRLINE = '#e2e8f0';
const HAIRLINE_SOFT = '#f1f5f9';
const BOX_BG = '#f8fafc';
const TOTAL_BG = '#f1f5f9';

const SERIF = 'Times-Roman';
const SERIF_BOLD = 'Times-Bold';
const SERIF_ITALIC = 'Times-Italic';

// Matches `$${n.toLocaleString()}` in the print template — no forced decimals.
const money = (n: number): string => '$' + n.toLocaleString('en-US');

const money2 = (n: number): string =>
  '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const WATER_TYPE_LABELS: Record<string, string> = {
  supreme: 'Supreme Water',
  homewater: 'Homewater',
  h2pros: 'H2Pros',
};

interface PriceRow {
  label: string;
  value: string;
  kind: 'normal' | 'total' | 'sub';
}

/** Shape of a proposal after ProposalsService POPULATE has run. */
interface PopulatedProposal {
  // Populated references: Mongoose yields null when the target was deleted.
  customer: { name: string; address: string; phone?: string; email?: string } | null;
  salesRep: { name: string; email: string } | null;
  waterType: string;
  package: { name: string; price: number; inclusions: string[]; imageUrl: string | null } | null;
  adders: { name: string; price: number }[];
  addersTotal: number;
  salesMargin: number;
  cashPrice: number;
  financier: { name: string } | null;
  loanOptionLabel: string | null;
  dealerFeePercent: number;
  dealerFee: number;
  financedAmount: number;
  monthlyPayment: number | null;
  loanTerm: number | null;
  interestRate: number | null;
  createdAt: Date;
}

@Injectable()
export class ProposalPdfService {
  private readonly logger = new Logger(ProposalPdfService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Remote images (logo, product shot) are configured as URLs, but PDFKit needs
   * bytes. A broken or slow URL must never fail the whole download, so every
   * fetch is time-boxed and failures fall through to "no image".
   */
  private async fetchImage(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      // PDFKit only understands JPEG and PNG.
      if (!/image\/(jpeg|jpg|png)/i.test(type)) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.warn(`Could not load image ${url}: ${(err as Error).message}`);
      return null;
    }
  }

  async generate(proposal: ProposalDocument): Promise<Buffer> {
    const p = proposal.toObject() as unknown as PopulatedProposal;

    // Populated references come back null when the referenced document was
    // deleted. Every section below dereferences these, so fail with a clear
    // 400 rather than a 500 from a null property read.
    if (!p.customer || !p.package || !p.salesRep) {
      const missing = [
        !p.customer ? 'customer' : null,
        !p.package ? 'package' : null,
        !p.salesRep ? 'sales rep' : null,
      ].filter((x): x is string => x !== null);
      throw new BadRequestException(
        `This proposal refers to a ${missing.join(' and ')} that no longer exists, so a PDF cannot be generated.`,
      );
    }

    const settings = await this.settingsService.get();
    const accent = settings.primaryColor || '#1e293b';

    const [logo, productImage] = await Promise.all([
      this.fetchImage(settings.logoUrl),
      this.fetchImage(p.package?.imageUrl),
    ]);

    const doc = new PDFDocument({ size: 'LETTER', margins: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));

    const L = MARGIN.left;
    const R = MARGIN.left + CW;
    let y = MARGIN.top;

    /** Start a new page when the next block would overflow the bottom margin. */
    const ensure = (needed: number): void => {
      if (y + needed > PAGE_H - MARGIN.bottom) {
        doc.addPage();
        y = MARGIN.top;
      }
    };

    const hr = (yy: number, color: string, width: number): void => {
      doc.moveTo(L, yy).lineTo(R, yy).lineWidth(width).strokeColor(color).stroke();
    };

    // ── Header ────────────────────────────────────────────────────────────────
    const headerTop = y;
    let companyX = L;
    if (logo) {
      try {
        doc.image(logo, L, headerTop, { fit: [110, 50] });
        companyX = L + 110 + 0.5 * CM;
      } catch {
        /* undecodable — fall back to the wordmark alone */
      }
    }

    const titleW = 200;
    const titleX = R - titleW;

    // Company name + tagline (left/centre)
    doc
      .font(SERIF_BOLD)
      .fontSize(18)
      .fillColor(INK)
      .text(settings.companyName, companyX, headerTop + 2, {
        width: titleX - companyX - 10,
        lineBreak: false,
      });
    let companyBottom = doc.y;
    if (settings.companyTagline) {
      doc
        .font(SERIF_ITALIC)
        .fontSize(10)
        .fillColor(GREY_666)
        .text(settings.companyTagline, companyX, companyBottom + 2, {
          width: titleX - companyX - 10,
        });
      companyBottom = doc.y;
    }

    // Title + date (right)
    doc
      .font(SERIF_BOLD)
      .fontSize(14)
      .fillColor(INK)
      .text('Water Treatment Proposal', titleX, headerTop + 4, {
        width: titleW,
        align: 'right',
      });
    doc
      .font(SERIF)
      .fontSize(9)
      .fillColor(GREY_666)
      .text(
        new Date(p.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        titleX,
        doc.y + 4,
        { width: titleW, align: 'right' },
      );

    y = Math.max(companyBottom, doc.y, headerTop + (logo ? 50 : 0));

    // ── Accent divider ────────────────────────────────────────────────────────
    y += 0.4 * CM;
    doc.roundedRect(L, y, CW, 3, 1.5).fillColor(accent).fill();
    y += 3 + 0.6 * CM;

    /** Accent uppercase heading with a hairline rule underneath. */
    const sectionTitle = (label: string): void => {
      ensure(40);
      doc
        .font(SERIF_BOLD)
        .fontSize(11)
        .fillColor(accent)
        .text(label.toUpperCase(), L, y, { width: CW, characterSpacing: 0.55 });
      y = doc.y + 3;
      hr(y, HAIRLINE, 1);
      y += 0.3 * CM;
    };

    // ── Prepared For ──────────────────────────────────────────────────────────
    sectionTitle('Prepared For');
    {
      const padX = 0.5 * CM;
      const padY = 0.3 * CM;
      const boxW = CW * 0.55;
      const innerW = boxW - padX * 2;

      const lines: { text: string; font: string; size: number; color: string }[] = [
        { text: p.customer.name, font: SERIF_BOLD, size: 13, color: INK },
        { text: p.customer.address, font: SERIF, size: 11, color: SLATE_600 },
      ];
      if (p.customer.phone)
        lines.push({ text: p.customer.phone, font: SERIF, size: 10, color: SLATE_500 });
      if (p.customer.email)
        lines.push({ text: p.customer.email, font: SERIF, size: 10, color: SLATE_500 });

      let boxH = padY * 2;
      for (const ln of lines) {
        doc.font(ln.font).fontSize(ln.size);
        boxH += doc.heightOfString(ln.text, { width: innerW }) + 2;
      }

      ensure(boxH + 10);
      doc
        .roundedRect(L, y, boxW, boxH, 6)
        .fillAndStroke(BOX_BG, HAIRLINE);

      let ty = y + padY;
      for (const ln of lines) {
        doc.font(ln.font).fontSize(ln.size).fillColor(ln.color);
        doc.text(ln.text, L + padX, ty, { width: innerW });
        ty = doc.y + 2;
      }
      y += boxH + 0.6 * CM;
    }

    // ── Your System ───────────────────────────────────────────────────────────
    sectionTitle('Your System');

    if (productImage) {
      try {
        const imgH = 5 * CM;
        ensure(imgH + 12);
        doc.image(productImage, L, y, { fit: [CW, imgH], align: 'center' });
        y += imgH + 0.4 * CM;
      } catch {
        /* ignore undecodable image */
      }
    }

    {
      // Two-column label/value grid
      const colW = CW / 2;
      const cells: [string, string][] = [
        ['Water Type', WATER_TYPE_LABELS[p.waterType] ?? p.waterType],
        ['Package', p.package.name],
      ];
      ensure(34);
      const gridTop = y;
      cells.forEach(([label, value], i) => {
        const x = L + colW * i;
        doc
          .font(SERIF)
          .fontSize(8)
          .fillColor(SLATE_500)
          .text(label.toUpperCase(), x, gridTop, { width: colW - 10, characterSpacing: 0.35 });
        doc
          .font(SERIF_BOLD)
          .fontSize(11)
          .fillColor(INK)
          .text(value, x, doc.y + 1, { width: colW - 10 });
      });
      y = doc.y + 0.3 * CM;
    }

    /** Small bold uppercase label used above sub-lists. */
    const subLabel = (label: string): void => {
      ensure(24);
      y += 0.2 * CM;
      doc
        .font(SERIF_BOLD)
        .fontSize(9)
        .fillColor(SLATE_600)
        .text(label.toUpperCase(), L, y, { width: CW, characterSpacing: 0.35 });
      y = doc.y + 0.15 * CM;
    };

    if (p.package.inclusions?.length) {
      subLabel("What's Included");
      // Two balanced bullet columns, mirroring `columns: 2` in the print CSS.
      const half = Math.ceil(p.package.inclusions.length / 2);
      const columns = [p.package.inclusions.slice(0, half), p.package.inclusions.slice(half)];
      const colW = (CW - 1 * CM) / 2;
      const top = y;
      let lowest = y;
      columns.forEach((items, ci) => {
        if (!items.length) return;
        const x = L + ci * (colW + 1 * CM);
        doc.font(SERIF).fontSize(10).fillColor(SLATE_700);
        let cy = top;
        for (const item of items) {
          const h = doc.heightOfString(item, { width: colW - 12 });
          doc.text('•', x, cy, { width: 8 });
          doc.text(item, x + 12, cy, { width: colW - 12 });
          cy += h + 2;
        }
        lowest = Math.max(lowest, cy);
      });
      y = lowest + 0.15 * CM;
    }

    if (p.adders?.length) {
      subLabel('Add-ons');
      doc.font(SERIF).fontSize(10);
      for (const a of p.adders) {
        ensure(20);
        doc.fillColor(SLATE_700).text(a.name, L, y + 2, { width: CW * 0.7 });
        doc.text(money(a.price), L, y + 2, { width: CW, align: 'right' });
        const rowBottom = y + 2 + doc.currentLineHeight() + 2;
        hr(rowBottom, HAIRLINE_SOFT, 1);
        y = rowBottom;
      }
      y += 0.15 * CM;
    }

    y += 0.6 * CM;

    // ── Investment Summary ────────────────────────────────────────────────────
    sectionTitle('Investment Summary');
    {
      const rows: PriceRow[] = [
        { label: 'Package Base', value: money(p.package.price), kind: 'normal' },
      ];
      if (p.addersTotal > 0)
        rows.push({ label: 'Add-ons', value: money(p.addersTotal), kind: 'normal' });
      if (p.salesMargin > 0)
        rows.push({ label: 'Additional', value: money(p.salesMargin), kind: 'normal' });
      rows.push({ label: 'Cash Price', value: money(p.cashPrice), kind: 'total' });

      if (p.financier) {
        rows.push({
          label: `Dealer Fee (${p.dealerFeePercent}%)`,
          value: money2(p.dealerFee),
          kind: 'sub',
        });
        rows.push({
          label: 'Financed Amount',
          value: money2(p.financedAmount),
          kind: 'total',
        });
      }

      const padX = 12;
      const rowH = (r: PriceRow) => (r.kind === 'total' ? 11 : 10) * 1.35 + 10;
      const boxH = rows.reduce((sum, r) => sum + rowH(r), 0);

      ensure(boxH + 16);
      const boxTop = y;

      // overflow: hidden — clip the alternating row fills to the rounded border
      doc.save();
      doc.roundedRect(L, boxTop, CW, boxH, 6).clip();

      let ry = boxTop;
      rows.forEach((r, i) => {
        const h = rowH(r);
        if (r.kind === 'total') {
          doc.rect(L, ry, CW, h).fillColor(TOTAL_BG).fill();
          doc.moveTo(L, ry).lineTo(R, ry).lineWidth(2).strokeColor(HAIRLINE).stroke();
        } else if (i % 2 === 1) {
          doc.rect(L, ry, CW, h).fillColor(BOX_BG).fill();
        }
        ry += h;
      });
      doc.restore();

      // Text on top of the fills
      ry = boxTop;
      for (const r of rows) {
        const h = rowH(r);
        const size = r.kind === 'total' ? 11 : 10;
        const font = r.kind === 'total' ? SERIF_BOLD : r.kind === 'sub' ? SERIF_ITALIC : SERIF;
        const color =
          r.kind === 'total' ? SLATE_900 : r.kind === 'sub' ? SLATE_500 : SLATE_600;
        doc.font(font).fontSize(size).fillColor(color);
        doc.text(r.label, L + padX, ry + 5, { width: CW - padX * 2, lineBreak: false });
        doc.text(r.value, L + padX, ry + 5, {
          width: CW - padX * 2,
          align: 'right',
          lineBreak: false,
        });
        ry += h;
      }

      doc.roundedRect(L, boxTop, CW, boxH, 6).lineWidth(1).strokeColor(HAIRLINE).stroke();
      y = boxTop + boxH;

      // Monthly payment banner
      if (p.financier && p.monthlyPayment != null) {
        y += 6;
        const bannerH = 8 * 2 + 18 * 1.2;
        ensure(bannerH + 10);
        doc.roundedRect(L, y, CW, bannerH, 4).fillColor(accent).fill();
        doc
          .font(SERIF_BOLD)
          .fontSize(11)
          .fillColor('#ffffff')
          .text('Monthly Payment', L + 12, y + bannerH / 2 - 6, {
            width: CW - 24,
            lineBreak: false,
          });
        doc
          .font(SERIF_BOLD)
          .fontSize(18)
          .fillColor('#ffffff')
          .text(`${money2(p.monthlyPayment)}/mo`, L + 12, y + bannerH / 2 - 11, {
            width: CW - 24,
            align: 'right',
            lineBreak: false,
          });
        y += bannerH;
      }

      if (p.financier && p.loanOptionLabel) {
        const note =
          `${p.financier.name} · ${p.loanOptionLabel}` +
          (p.loanTerm ? ` · ${p.loanTerm}-Month Term` : '') +
          (p.interestRate != null ? ` · ${p.interestRate}% APR` : '');
        ensure(20);
        doc
          .font(SERIF_ITALIC)
          .fontSize(8)
          .fillColor(SLATE_400)
          .text(note, L + 12, y + 4, { width: CW - 24 });
        y = doc.y;
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    y += 0.8 * CM;
    ensure(30);
    hr(y, accent, 2);
    y += 0.3 * CM;
    doc.font(SERIF).fontSize(8).fillColor(SLATE_500);
    doc.text(settings.companyName, L, y, { width: CW / 3, lineBreak: false });
    doc.text(`Prepared by ${p.salesRep.name}`, L + CW / 3, y, {
      width: CW / 3,
      align: 'center',
      lineBreak: false,
    });
    doc.text(new Date().toLocaleDateString('en-US'), L, y, {
      width: CW,
      align: 'right',
      lineBreak: false,
    });

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }
}
