import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProposalsService } from './proposals.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly pdfService: ProposalPdfService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
  ) {}

  @Post()
  create(@Body() dto: CreateProposalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.proposalsService.create(dto, user.userId, user.role);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.proposalsService.findAll(user.userId, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proposalsService.findById(id);
  }

  /** Renders the proposal as a real PDF file the rep can save or hand over. */
  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const proposal = await this.proposalsService.findById(id);
    const pdf = await this.pdfService.generate(proposal);

    const customerName = (proposal.customer as unknown as { name?: string })?.name ?? 'customer';
    const slug = customerName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="proposal-${slug || 'customer'}.pdf"`,
      'Content-Length': String(pdf.length),
    });
    res.end(pdf);
  }

  /** Emails the proposal to the customer with the PDF attached. */
  @Post(':id/send')
  async send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const proposal = await this.proposalsService.findById(id);
    const customer = proposal.customer as unknown as { name?: string; email?: string };

    if (!customer?.email) {
      throw new BadRequestException(
        'This customer has no email address on file. Add one before sending.',
      );
    }

    const [pdf, settings] = await Promise.all([
      this.pdfService.generate(proposal),
      this.settingsService.get(),
    ]);

    await this.emailService.sendProposal(customer.email, {
      customerName: customer.name ?? 'there',
      companyName: settings.companyName,
      primaryColor: settings.primaryColor,
      packageName:
        (proposal.package as unknown as { name?: string })?.name ?? 'Your system',
      cashPrice: proposal.cashPrice,
      monthlyPayment: proposal.monthlyPayment,
      pdf,
    });

    // Advance a draft once the mail actually goes out, but never regress a
    // proposal the customer has already accepted or declined.
    if (proposal.status === 'draft') {
      return this.proposalsService.update(id, { status: 'sent' }, user.role);
    }
    return this.proposalsService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proposalsService.update(id, dto, user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.proposalsService.remove(id);
  }
}
