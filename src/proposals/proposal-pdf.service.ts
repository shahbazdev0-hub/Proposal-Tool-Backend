import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { SettingsService } from '../settings/settings.service';
import { ProposalDocument } from './schemas/proposal.schema';

// A deliberate 1:1 port of the print stylesheet in
// frontend/src/app/(protected)/proposals/[id]/page.tsx, so "Print" and
// "Download PDF" produce the same document. Change one, change the other —
// the measurements below map directly to that CSS.

const CM = 28.3465; // 1cm in PostScript points
const PAGE_W = 612; // LETTER
const PAGE_H = 792;
const GUTTER = 1.6 * CM; // matches the CSS side padding
const CW = PAGE_W - GUTTER * 2;
const BOTTOM = 1.2 * CM;

// Palette
const INK = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_600 = '#475569';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_300 = '#cbd5e1';
const HAIRLINE = '#eef2f6';
const RULE = '#e2e8f0';
const FAINT = '#b0bac6';
const WHITE = '#ffffff';

// Modern & clean: sans-serif throughout, replacing the previous serif.
const SANS = 'Helvetica';
const SANS_BOLD = 'Helvetica-Bold';
const SANS_OBLIQUE = 'Helvetica-Oblique';

const money = (n: number): string => '$' + n.toLocaleString('en-US');

const money2 = (n: number): string =>
  '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const WATER_TYPE_LABELS: Record<string, string> = {
  supreme: 'Supreme Water',
  homewater: 'Homewater',
  h2pros: 'H2Pros',
};

/** Shape of a proposal after ProposalsService POPULATE has run. */
interface PopulatedProposal {
  // Populated references: Mongoose yields null when the target was deleted.
  customer: { name: string; address: string; phone?: string; email?: string } | null;
  salesRep: { name: string; email: string } | null;
  waterType: string;
  package: {
    name: string;
    price: number;
    inclusions: string[];
    imageUrl: string | null;
  } | null;
  adders: { name: string; price: number; imageUrl: string | null }[];
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

/**
 * Intrinsic pixel dimensions from a PNG or JPEG header. PDFKit's own
 * `openImage` is not in its type definitions, and the header is trivial to
 * read for the only two formats uploads accepts.
 */
function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: IHDR width/height are big-endian uint32 at bytes 16 and 20.
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: walk the segment markers to the first SOFn frame header.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      // SOF0-SOF15, excluding DHT (c4), JPG (c8) and DAC (cc).
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }

  return null;
}

@Injectable()
export class ProposalPdfService {
  private readonly logger = new Logger(ProposalPdfService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Remote images are configured as URLs but PDFKit needs bytes. A broken or
   * slow URL must never fail the whole download, so every fetch is time-boxed
   * and failures fall through to "no image".
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

  /** Stored paths are relative; the PDF runs server-side so make them absolute. */
  private absolute(url: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const port = process.env.PORT ?? '4000';
    return `http://127.0.0.1:${port}${url.startsWith('/') ? '' : '/'}${url}`;
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
    const accent = settings.primaryColor || '#0d9488';

    const [logo, productImage] = await Promise.all([
      this.fetchImage(this.absolute(settings.logoUrl)),
      this.fetchImage(this.absolute(p.package.imageUrl)),
    ]);

    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));

    const L = GUTTER;
    const R = GUTTER + CW;
    let y = 0;

    const ensure = (needed: number): void => {
      if (y + needed > PAGE_H - BOTTOM) {
        doc.addPage();
        y = GUTTER;
      }
    };

    // ── Header band ───────────────────────────────────────────────────────────
    const bandH = 2.1 * CM;
    doc.rect(0, 0, PAGE_W, bandH).fillColor(accent).fill();

    let textX = L;
    if (logo) {
      try {
        doc.image(logo, L, (bandH - 40) / 2, { fit: [110, 40] });
        textX = L + 110 + 0.4 * CM;
      } catch {
        /* undecodable — fall back to the wordmark alone */
      }
    }

    const hasTagline = !!settings.companyTagline;
    doc
      .font(SANS_BOLD)
      .fontSize(15)
      .fillColor(WHITE)
      .text(settings.companyName, textX, bandH / 2 - (hasTagline ? 14 : 7), {
        width: CW * 0.55,
        lineBreak: false,
      });
    if (hasTagline) {
      doc
        .font(SANS)
        .fontSize(8.5)
        .fillColor(WHITE)
        .opacity(0.85)
        .text(settings.companyTagline as string, textX, doc.y + 1, {
          width: CW * 0.55,
          lineBreak: false,
        })
        .opacity(1);
    }

    doc
      .font(SANS_BOLD)
      .fontSize(8)
      .fillColor(WHITE)
      .opacity(0.85)
      .text('PROPOSAL', L, bandH / 2 - 13, {
        width: CW,
        align: 'right',
        characterSpacing: 1.6,
      })
      .opacity(1);
    doc
      .font(SANS)
      .fontSize(9)
      .fillColor(WHITE)
      .text(
        new Date(p.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        L,
        doc.y + 2,
        { width: CW, align: 'right' },
      );

    y = bandH + 0.8 * CM;

    // ── Customer + headline figure ────────────────────────────────────────────
    const boxW = 6.2 * CM;
    const boxX = R - boxW;
    const introTop = y;

    doc
      .font(SANS_BOLD)
      .fontSize(7.5)
      .fillColor(SLATE_400)
      .text('PREPARED FOR', L, introTop, { characterSpacing: 1.4 });
    doc
      .font(SANS_BOLD)
      .fontSize(14)
      .fillColor(INK)
      .text(p.customer.name, L, doc.y + 3, { width: CW - boxW - 0.8 * CM });
    doc.font(SANS).fontSize(9.5).fillColor(SLATE_600);
    doc.text(p.customer.address, L, doc.y + 2, { width: CW - boxW - 0.8 * CM });
    if (p.customer.phone) doc.text(p.customer.phone);
    if (p.customer.email) doc.text(p.customer.email);
    const customerBottom = doc.y;

    // Headline: monthly payment when financed, otherwise the cash total.
    const financed = !!p.financier && p.monthlyPayment != null;
    const padY = 10;

    // Measure before drawing: the sub-line wraps on long terms, and a fixed
    // height pushed it outside the border.
    const headLabel = financed ? 'ESTIMATED MONTHLY PAYMENT' : 'TOTAL INVESTMENT';
    const headValue = financed
      ? `${money2(p.monthlyPayment as number)}/mo`
      : money(p.cashPrice);
    const headSub = financed
      ? [
          p.loanTerm ? `${p.loanTerm} months` : 'Financed',
          p.interestRate != null ? `${p.interestRate}% APR` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'Cash purchase';

    const innerW = boxW - 24;
    doc.font(SANS_BOLD).fontSize(7.5);
    const hLabel = doc.heightOfString(headLabel, { width: innerW, characterSpacing: 1 });
    doc.font(SANS_BOLD).fontSize(24);
    const hValue = doc.heightOfString(headValue, { width: innerW });
    doc.font(SANS).fontSize(8.5);
    const hSub = doc.heightOfString(headSub, { width: innerW });
    const boxH = padY * 2 + hLabel + hValue + hSub + 4;

    doc.roundedRect(boxX, introTop, boxW, boxH, 8).lineWidth(1.5).strokeColor(accent).stroke();

    doc
      .font(SANS_BOLD)
      .fontSize(7.5)
      .fillColor(SLATE_500)
      .text(headLabel, boxX + 12, introTop + padY, {
        width: innerW,
        align: 'right',
        characterSpacing: 1,
      });
    doc
      .font(SANS_BOLD)
      .fontSize(24)
      .fillColor(accent)
      .text(headValue, boxX + 12, doc.y + 1, {
        width: innerW,
        align: 'right',
        lineBreak: false,
      });
    doc
      .font(SANS)
      .fontSize(8.5)
      .fillColor(SLATE_500)
      .text(headSub, boxX + 12, doc.y + 1, { width: innerW, align: 'right' });

    y = Math.max(customerBottom, introTop + boxH) + 0.5 * CM;

    /** Section heading with a short accent rule beneath it. */
    const section = (title: string): void => {
      ensure(48);
      doc.font(SANS_BOLD).fontSize(11).fillColor(INK).text(title, L, y);
      y = doc.y + 4;
      doc.roundedRect(L, y, 1.1 * CM, 2.5, 1.25).fillColor(accent).fill();
      y += 2.5 + 0.32 * CM;
    };

    /** Label left, amount right, on one baseline. */
    const line = (
      label: string,
      value: string,
      kind: 'normal' | 'total' | 'muted' = 'normal',
    ): void => {
      const size = kind === 'total' ? 11 : 9.5;
      ensure(size * 2.2);
      if (kind === 'total') {
        doc.moveTo(L, y).lineTo(R, y).lineWidth(1.25).strokeColor(SLATE_300).stroke();
        y += 5;
      }
      const font = kind === 'muted' ? SANS_OBLIQUE : kind === 'total' ? SANS_BOLD : SANS;
      const colour = kind === 'muted' ? SLATE_400 : kind === 'total' ? INK : SLATE_700;
      doc.font(font).fontSize(size).fillColor(colour);
      doc.text(label, L, y, { width: CW * 0.62, lineBreak: false });
      doc.text(value, L, y, { width: CW, align: 'right', lineBreak: false });
      y += size * 1.35;
      if (kind !== 'total') {
        doc.moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(HAIRLINE).stroke();
        y += 4;
      } else {
        y += 3;
      }
    };

    // ── Your system ───────────────────────────────────────────────────────────
    section('Your system');

    // Specs and inclusions occupy a left column; the package image sits to the
    // right. Mirrors .pdf-system-split in the print CSS — it fills the width
    // rather than leaving dead space either side of a centred image.
    const IMG_W = 5.4 * CM;
    const IMG_MAX_H = 5 * CM;
    const GAP = 1 * CM;

    let imgDrawnW = 0;
    let imgDrawnH = 0;
    if (productImage) {
      const dims = imageSize(productImage);
      if (dims) {
        const scale = Math.min(IMG_W / dims.width, IMG_MAX_H / dims.height, 1);
        imgDrawnW = dims.width * scale;
        imgDrawnH = dims.height * scale;
      }
    }

    // The text column narrows only when an image is actually being drawn.
    const textW = imgDrawnW > 0 ? CW - IMG_W - GAP : CW;
    const systemTop = y;

    // Draw the image first so the text column can flow independently below it.
    if (productImage && imgDrawnH > 0) {
      try {
        ensure(imgDrawnH + 12);
        // Right-aligned within its column.
        doc.image(productImage, R - imgDrawnW, systemTop, {
          fit: [imgDrawnW, imgDrawnH],
        });
      } catch {
        imgDrawnH = 0;
      }
    }

    {
      const specs: [string, string][] = [
        ['WATER TYPE', WATER_TYPE_LABELS[p.waterType] ?? p.waterType],
        ['PACKAGE', p.package.name],
      ];
      for (const [label, value] of specs) {
        doc
          .font(SANS_BOLD)
          .fontSize(7.5)
          .fillColor(SLATE_400)
          .text(label, L, y, { width: textW, characterSpacing: 1.2 });
        doc
          .font(SANS_BOLD)
          .fontSize(11)
          .fillColor(INK)
          .text(value, L, doc.y + 1, { width: textW });
        y = doc.y + 0.22 * CM;
      }
    }

    const sublabel = (text: string): void => {
      ensure(26);
      doc
        .font(SANS_BOLD)
        .fontSize(8)
        .fillColor(SLATE_500)
        .text(text, L, y, { characterSpacing: 1.2 });
      y = doc.y + 0.18 * CM;
    };

    if (p.package.inclusions?.length) {
      sublabel("WHAT'S INCLUDED");
      // One column: the text area is narrower now that the image sits beside it.
      {
        const colW = textW;
        let cy = y;
        for (const item of p.package.inclusions) {
          doc.font(SANS).fontSize(9.5).fillColor(SLATE_700);
          const h = doc.heightOfString(item, { width: colW - 14 });
          doc.circle(L + 2.5, cy + 5.5, 2).fillColor(SLATE_300).fill();
          doc.fillColor(SLATE_700).text(item, L + 14, cy, { width: colW - 14 });
          cy += h + 3;
        }
        y = cy + 0.2 * CM;
      }
    }

    // The image sits in its own column, so the next section must clear whichever
    // column ran longer — otherwise a tall image overlaps the upgrades list.
    if (imgDrawnH > 0) {
      y = Math.max(y, systemTop + imgDrawnH + 0.3 * CM);
    }

    if (p.adders?.length) {
      sublabel('SELECTED UPGRADES');

      // Fetch every thumbnail up front so one slow URL doesn't serialise the
      // whole list. Failures resolve to null and the line renders text-only.
      const thumbs = await Promise.all(
        p.adders.map((a) => this.fetchImage(this.absolute(a.imageUrl))),
      );

      const THUMB = 1 * CM;
      // Every row is the same height whether or not it has a thumbnail —
      // mixing line() with the taller image rows made the list look ragged.
      p.adders.forEach((a, i) => {
        const thumb = thumbs[i];
        const rowH = THUMB + 6;
        ensure(rowH + 6);
        const top = y;
        if (thumb) {
          try {
            doc.image(thumb, L, top + 3, { fit: [THUMB, THUMB] });
          } catch {
            /* undecodable — the text still renders */
          }
        }
        // Indent every name equally so the column aligns with or without an image.
        const textX = L + THUMB + 0.25 * CM;
        doc
          .font(SANS)
          .fontSize(9.5)
          .fillColor(SLATE_700)
          .text(a.name, textX, top + THUMB / 2 - 5, {
            width: CW * 0.62 - THUMB,
            lineBreak: false,
          });
        doc.text(money(a.price), L, top + THUMB / 2 - 5, {
          width: CW,
          align: 'right',
          lineBreak: false,
        });
        y = top + rowH;
        doc.moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(HAIRLINE).stroke();
        y += 4;
      });

      y += 0.15 * CM;
    }

    y += 0.35 * CM;

    // ── Investment summary ────────────────────────────────────────────────────
    section('Investment summary');
    line(`${p.package.name} package`, money(p.package.price));
    if (p.addersTotal > 0) line('Upgrades', money(p.addersTotal));
    if (p.salesMargin > 0) line('Options & installation', money(p.salesMargin));
    line('Total cash price', money(p.cashPrice), 'total');

    if (p.financier) {
      line(`Dealer fee (${p.dealerFeePercent}%)`, money2(p.dealerFee), 'muted');
      line('Amount financed', money2(p.financedAmount), 'total');

      const note = [
        p.financier.name,
        p.loanOptionLabel,
        p.loanTerm ? `${p.loanTerm}-month term` : null,
        p.interestRate != null ? `${p.interestRate}% APR` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      ensure(20);
      doc.font(SANS).fontSize(8).fillColor(SLATE_400).text(note, L, y + 4, { width: CW });
      y = doc.y;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    y += 0.9 * CM;
    ensure(46);
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(RULE).stroke();
    y += 0.25 * CM;

    doc.font(SANS).fontSize(8).fillColor(SLATE_500);
    doc.text(settings.companyName, L, y, { width: CW / 3, lineBreak: false });
    doc.text(`Prepared by ${p.salesRep.name}`, L + CW / 3, y, {
      width: CW / 3,
      align: 'center',
      lineBreak: false,
    });
    doc.text(
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      L,
      y,
      { width: CW, align: 'right', lineBreak: false },
    );
    y += 0.22 * CM + 10;

    doc
      .font(SANS)
      .fontSize(7.5)
      .fillColor(FAINT)
      .text(
        'This proposal is an estimate. Financing terms are subject to lender approval and may vary. ' +
          'The monthly payment shown is calculated from the payment factor for the selected program.',
        L,
        y,
        { width: CW },
      );

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }
}
