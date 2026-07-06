import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Financier, FinancierDocument } from './schemas/financier.schema';
import { CreateFinancierDto } from './dto/create-financier.dto';
import { UpdateFinancierDto } from './dto/update-financier.dto';
import { LoanOptionDto } from './dto/loan-option.dto';

@Injectable()
export class FinanciersService {
  constructor(
    @InjectModel(Financier.name) private readonly financierModel: Model<FinancierDocument>,
  ) {}

  create(dto: CreateFinancierDto): Promise<FinancierDocument> {
    return this.financierModel.create(dto);
  }

  findAll(): Promise<FinancierDocument[]> {
    return this.financierModel.find().sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<FinancierDocument> {
    const financier = await this.financierModel.findById(id).exec();
    if (!financier) {
      throw new NotFoundException('Financier not found');
    }
    return financier;
  }

  async update(id: string, dto: UpdateFinancierDto): Promise<FinancierDocument> {
    const financier = await this.financierModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!financier) {
      throw new NotFoundException('Financier not found');
    }
    return financier;
  }

  async remove(id: string): Promise<void> {
    const result = await this.financierModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Financier not found');
    }
  }

  async addLoanOption(id: string, dto: LoanOptionDto): Promise<FinancierDocument> {
    const financier = await this.findById(id);
    financier.loanOptions.push(dto);
    return financier.save();
  }

  async updateLoanOption(
    id: string,
    loanOptionId: string,
    dto: LoanOptionDto,
  ): Promise<FinancierDocument> {
    const financier = await this.findById(id);
    const loanOption = financier.loanOptions.find((lo) => lo._id?.toString() === loanOptionId);
    if (!loanOption) {
      throw new NotFoundException('Loan option not found');
    }
    loanOption.label = dto.label;
    loanOption.dealerFeePercent = dto.dealerFeePercent;
    return financier.save();
  }

  async removeLoanOption(id: string, loanOptionId: string): Promise<FinancierDocument> {
    const financier = await this.findById(id);
    financier.loanOptions = financier.loanOptions.filter(
      (lo) => lo._id?.toString() !== loanOptionId,
    ) as typeof financier.loanOptions;
    return financier.save();
  }
}
