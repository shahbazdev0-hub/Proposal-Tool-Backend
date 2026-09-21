import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import { SalesQueryDto } from '../sales/dto/sales-query.dto';

export interface PayrollRow {
  repId: string;
  repName: string;
  numberOfSales: number;
  commissionEarned: number;
  commissionPaid: number;
  commissionDue: number;
}

@Injectable()
export class PayrollService {
  constructor(@InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>) {}

  async getReport(query: SalesQueryDto): Promise<PayrollRow[]> {
    const filter: Record<string, unknown> = {};
    if (query.from || query.to) {
      const saleDate: Record<string, Date> = {};
      if (query.from) saleDate.$gte = new Date(query.from);
      if (query.to) saleDate.$lte = new Date(query.to);
      filter.saleDate = saleDate;
    }

    const rows = await this.saleModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$salesRep',
          numberOfSales: { $sum: 1 },
          commissionEarned: { $sum: '$commissions.salesRep' },
          commissionPaid: { $sum: { $cond: ['$commissionsPaid', '$commissions.salesRep', 0] } },
          commissionDue: { $sum: { $cond: ['$commissionsPaid', 0, '$commissions.salesRep'] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'rep' } },
      { $unwind: '$rep' },
      {
        $project: {
          _id: 0,
          repId: '$rep._id',
          repName: '$rep.name',
          numberOfSales: 1,
          commissionEarned: 1,
          commissionPaid: 1,
          commissionDue: 1,
        },
      },
      { $sort: { repName: 1 } },
    ]);

    return rows as PayrollRow[];
  }

  private static readonly CSV_HEADERS = [
    'Rep Name',
    'Number of Sales',
    'Commission Earned',
    'Commission Paid',
    'Commission Due',
  ];

  private static csvEscape(value: string | number): string {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  async exportCsv(query: SalesQueryDto): Promise<string> {
    const rows = await this.getReport(query);
    const lines = [
      PayrollService.CSV_HEADERS.join(','),
      ...rows.map((row) =>
        [row.repName, row.numberOfSales, row.commissionEarned, row.commissionPaid, row.commissionDue]
          .map(PayrollService.csvEscape)
          .join(','),
      ),
    ];
    return lines.join('\n');
  }

  async exportExcel(query: SalesQueryDto): Promise<ExcelJS.Buffer> {
    const rows = await this.getReport(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payroll');
    sheet.columns = [
      { header: 'Rep Name', key: 'repName', width: 28 },
      { header: 'Number of Sales', key: 'numberOfSales', width: 18 },
      { header: 'Commission Earned', key: 'commissionEarned', width: 20 },
      { header: 'Commission Paid', key: 'commissionPaid', width: 20 },
      { header: 'Commission Due', key: 'commissionDue', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));

    return workbook.xlsx.writeBuffer();
  }
}
