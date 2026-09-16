import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
  ) {}

  create(dto: CreateCustomerDto, createdById: string): Promise<CustomerDocument> {
    return this.customerModel.create({ ...dto, createdBy: createdById });
  }

  findAll(requestingUserId: string, role: Role): Promise<CustomerDocument[]> {
    // Admins and OPS see all; reps only see their own.
    const filter =
      role === Role.ADMIN || role === Role.OPS ? {} : { createdBy: requestingUserId };
    return this.customerModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .exec();
  }

  async findById(id: string): Promise<CustomerDocument> {
    const customer = await this.customerModel
      .findById(id)
      .populate('createdBy', 'name email')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerDocument> {
    const customer = await this.customerModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('createdBy', 'name email')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async remove(id: string): Promise<void> {
    const result = await this.customerModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Customer not found');
  }
}
