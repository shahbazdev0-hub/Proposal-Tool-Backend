import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { TransferCustomerDto } from './dto/transfer-customer.dto';
import { Role } from '../common/enums/role.enum';
import { UsersService } from '../users/users.service';

// A populated ref comes back as a full document ({ _id, ...fields }); an
// unpopulated one is a plain ObjectId. Both have a real toString() — this
// just gives TS a concrete type to call it through instead of `unknown`.
function refId(ref: Types.ObjectId | { _id: Types.ObjectId }): string {
  return ('_id' in ref ? ref._id : ref).toString();
}

/** "123 Main St, Austin, TX 78701" — the single string every existing
 *  display (tables, PDF, print template) reads. */
function formatAddress(parts: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): string {
  return `${parts.street}, ${parts.city}, ${parts.state} ${parts.zip}`;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    private readonly usersService: UsersService,
  ) {}

  create(
    dto: CreateCustomerDto,
    createdById: string,
  ): Promise<CustomerDocument> {
    return this.customerModel.create({
      ...dto,
      address: formatAddress(dto),
      createdBy: createdById,
    });
  }

  async findAll(
    requestingUserId: string,
    role: Role,
  ): Promise<CustomerDocument[]> {
    // Admins and OPS see all; a rep sees their own; a rep's Direct
    // Recruiter/Team Lead/Regional/Partner sees that rep's too.
    const filter =
      role === Role.ADMIN || role === Role.OPS
        ? {}
        : {
            createdBy: {
              $in: await this.usersService.visibleSalesRepIds(requestingUserId),
            },
          };
    return this.customerModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .exec();
  }

  /** Internal accessor — no ownership check. Only for use after the caller
   *  has already been authorized some other way (e.g. mid-update). Do not
   *  wire this straight to a controller route; use findByIdForUser. */
  async findById(id: string): Promise<CustomerDocument> {
    const customer = await this.customerModel
      .findById(id)
      .populate('createdBy', 'name email')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** The GET /:id route's accessor — same visibility rule as findAll. */
  async findByIdForUser(
    id: string,
    requestingUserId: string,
    role: Role,
  ): Promise<CustomerDocument> {
    const customer = await this.findById(id);
    if (role === Role.ADMIN || role === Role.OPS) return customer;

    const createdById = refId(customer.createdBy);
    const visibleIds =
      await this.usersService.visibleSalesRepIds(requestingUserId);
    const isVisible = visibleIds.some(
      (visibleId) => visibleId.toString() === createdById,
    );
    if (!isVisible) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerDocument> {
    const patch: UpdateCustomerDto & { address?: string } = { ...dto };

    // Re-derive the combined string whenever any of its parts change —
    // otherwise `address` would silently go stale after an edit. A partial
    // update may only send e.g. `zip`, so the other parts are read from the
    // existing document.
    if (dto.street || dto.city || dto.state || dto.zip) {
      const existing = await this.customerModel.findById(id).exec();
      if (!existing) throw new NotFoundException('Customer not found');
      patch.address = formatAddress({
        street: dto.street ?? existing.street ?? '',
        city: dto.city ?? existing.city ?? '',
        state: dto.state ?? existing.state ?? '',
        zip: dto.zip ?? existing.zip ?? '',
      });
    }

    const customer = await this.customerModel
      .findByIdAndUpdate(id, patch, { new: true })
      .populate('createdBy', 'name email')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** Admin-only ownership transfer (scope: client request). A separate
   *  route from update() so it isn't reachable by whoever can PATCH a
   *  customer's contact details — explicit action for the client's
   *  explicit ask: "only give admins the ability to do so". */
  async transfer(
    id: string,
    dto: TransferCustomerDto,
    role: Role,
  ): Promise<CustomerDocument> {
    if (role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only an admin can transfer a customer to another user.',
      );
    }

    // Throws NotFoundException if the target doesn't exist.
    await this.usersService.findById(dto.ownerId);

    // Mongoose does not reliably auto-cast a hex string to ObjectId on
    // findByIdAndUpdate for a @Prop({ type: Types.ObjectId }) path — cast
    // explicitly, or createdBy gets stored as a plain string and every $in
    // visibility filter elsewhere silently stops matching this customer.
    const customer = await this.customerModel
      .findByIdAndUpdate(id, { createdBy: new Types.ObjectId(dto.ownerId) }, { new: true })
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
