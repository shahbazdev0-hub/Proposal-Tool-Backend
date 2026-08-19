/**
 * Test-data seed: creates demo users with a full upline chain, then creates
 * 3 sample sales for rep1 so every role's dashboard shows real numbers.
 *
 * Idempotent: existing users have their upline fields updated in-place;
 * existing sales for rep1 are deleted and recreated so the upline snapshot
 * is always consistent with the current user records.
 *
 * Run: npm run seed:test (backend must NOT be running — ts-node owns the port)
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { SalesService } from '../sales/sales.service';
import { PackagesService } from '../packages/packages.service';
import { FinanciersService } from '../financiers/financiers.service';
import { CustomersService } from '../customers/customers.service';
import { ProposalsService } from '../proposals/proposals.service';
import { Role } from '../common/enums/role.enum';
import { WaterType } from '../common/enums/water-type.enum';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Proposal, ProposalDocument } from '../proposals/schemas/proposal.schema';
import { CreateSaleDto } from '../sales/dto/create-sale.dto';

const PASSWORD = 'Password123!';

async function seedTest() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const usersService = app.get(UsersService);
    const salesService = app.get(SalesService);
    const packagesService = app.get(PackagesService);
    const financiersService = app.get(FinanciersService);
    const customersService = app.get(CustomersService);
    const proposalsService = app.get(ProposalsService);
    const saleModel = app.get<Model<SaleDocument>>(getModelToken(Sale.name));
    const customerModel = app.get<Model<CustomerDocument>>(getModelToken(Customer.name));
    const proposalModel = app.get<Model<ProposalDocument>>(getModelToken(Proposal.name));

    async function getOrCreate(email: string, createData: Parameters<typeof usersService.create>[0]) {
      const existing = await usersService.findByEmailWithPassword(email);
      if (existing) {
        const id = (existing._id as Types.ObjectId).toString();
        const { name: _n, email: _e, role: _r, password: _p, ...uplines } = createData;
        const updated = await usersService.update(id, uplines);
        console.log(`  updated  ${email}`);
        return updated;
      }
      const created = await usersService.create(createData);
      console.log(`  created  ${email}`);
      return created;
    }

    console.log('\n=== Users ===');

    // No upline
    await getOrCreate('ops@example.com', {
      name: 'Ops User',
      email: 'ops@example.com',
      password: PASSWORD,
      role: Role.OPS,
    });

    const partner = await getOrCreate('partner@example.com', {
      name: 'Pat Partner',
      email: 'partner@example.com',
      password: PASSWORD,
      role: Role.PARTNER,
    });
    const partnerId = (partner._id as Types.ObjectId).toString();

    const regional = await getOrCreate('regional@example.com', {
      name: 'Regina Regional',
      email: 'regional@example.com',
      password: PASSWORD,
      role: Role.REGIONAL,
      partner: partnerId,
    });
    const regionalId = (regional._id as Types.ObjectId).toString();

    const teamlead = await getOrCreate('teamlead@example.com', {
      name: 'Tara Teamlead',
      email: 'teamlead@example.com',
      password: PASSWORD,
      role: Role.TEAM_LEAD,
      regional: regionalId,
      partner: partnerId,
    });
    const teamleadId = (teamlead._id as Types.ObjectId).toString();

    const recruiter = await getOrCreate('recruiter@example.com', {
      name: 'Rick Recruiter',
      email: 'recruiter@example.com',
      password: PASSWORD,
      role: Role.DIRECT_RECRUITER,
      teamLead: teamleadId,
      regional: regionalId,
      partner: partnerId,
    });
    const recruiterId = (recruiter._id as Types.ObjectId).toString();

    const rep1 = await getOrCreate('rep1@example.com', {
      name: 'Test Rep',
      email: 'rep1@example.com',
      password: PASSWORD,
      role: Role.SALES_REP,
      directRecruiter: recruiterId,
      teamLead: teamleadId,
      regional: regionalId,
      partner: partnerId,
    });
    const rep1Id = (rep1._id as Types.ObjectId).toString();

    // Wipe and recreate rep1's sales so the upline snapshot is correct.
    const oldCount = await saleModel.countDocuments({ salesRep: rep1._id });
    if (oldCount > 0) {
      await saleModel.deleteMany({ salesRep: rep1._id });
      console.log(`\nDeleted ${oldCount} old sale(s) for rep1 (upline snapshot may have been stale).`);
    }

    console.log('\n=== Packages ===');
    const allPkgs = await packagesService.findAll();
    const supremeGold = allPkgs.find((p) => p.waterType === WaterType.SUPREME && p.name === 'Gold');
    const supremeSilver = allPkgs.find((p) => p.waterType === WaterType.SUPREME && p.name === 'Silver');
    const hwPlatXL = allPkgs.find((p) => p.waterType === WaterType.HOMEWATER && p.name === 'Platinum XL');

    if (!supremeGold || !supremeSilver || !hwPlatXL) {
      throw new Error('Required packages missing — run `npm run seed` first, then retry.');
    }

    const goldId = (supremeGold._id as Types.ObjectId).toString();
    const silverId = (supremeSilver._id as Types.ObjectId).toString();
    const hwPlatXLId = (hwPlatXL._id as Types.ObjectId).toString();

    // Grab a financier + loan option if one exists (for a financed Supreme sale)
    const financiers = await financiersService.findAll();
    const fWithLoan = financiers.find((f) => f.loanOptions.length > 0);

    console.log('\n=== Sales ===');

    // Sale 1: Supreme Gold — financed if a financier exists, otherwise cash
    const sale1Extras: Partial<CreateSaleDto> = fWithLoan
      ? {
          financier: (fWithLoan._id as Types.ObjectId).toString(),
          loanOptionId: (fWithLoan.loanOptions[0]._id as Types.ObjectId).toString(),
        }
      : {};

    const sale1 = await salesService.create({
      customerName: 'John Customer',
      saleDate: '2026-06-01',
      waterType: WaterType.SUPREME,
      salesRep: rep1Id,
      loanAmount: 15000,
      package: goldId,
      adders: [],
      ...sale1Extras,
    } as CreateSaleDto);

    // Sale 2: Homewater Platinum XL — cash
    const sale2 = await salesService.create({
      customerName: 'Jane Customer',
      saleDate: '2026-06-15',
      waterType: WaterType.HOMEWATER,
      salesRep: rep1Id,
      loanAmount: 500,
      package: hwPlatXLId,
      adders: [],
    } as CreateSaleDto);

    // Sale 3: Supreme Silver — cash
    const sale3 = await salesService.create({
      customerName: 'Bob Customer',
      saleDate: '2026-06-20',
      waterType: WaterType.SUPREME,
      salesRep: rep1Id,
      loanAmount: 12000,
      package: silverId,
      adders: [],
    } as CreateSaleDto);

    console.log(`  Sale 1 (Supreme Gold)    rep=$${sale1.commissions.salesRep.toFixed(2)}  recruiter=$${sale1.commissions.directRecruiter}  teamlead=$${sale1.commissions.teamLead}  regional=$${sale1.commissions.regional}  partner=$${sale1.commissions.partner}`);
    console.log(`  Sale 2 (Homewater Plat)  rep=$${sale2.commissions.salesRep.toFixed(2)}  recruiter=$${sale2.commissions.directRecruiter}  teamlead=$${sale2.commissions.teamLead}  regional=$${sale2.commissions.regional}  partner=$${sale2.commissions.partner}`);
    console.log(`  Sale 3 (Supreme Silver)  rep=$${sale3.commissions.salesRep.toFixed(2)}  recruiter=$${sale3.commissions.directRecruiter}  teamlead=$${sale3.commissions.teamLead}  regional=$${sale3.commissions.regional}  partner=$${sale3.commissions.partner}`);

    console.log('\nUpline snapshot on sale 1:');
    console.log('  directRecruiter:', sale1.directRecruiter?.toString());
    console.log('  teamLead:       ', sale1.teamLead?.toString());
    console.log('  regional:       ', sale1.regional?.toString());
    console.log('  partner:        ', sale1.partner?.toString());

    // ── Customers ────────────────────────────────────────────────────────────
    console.log('\n=== Customers ===');

    const CUSTOMERS = [
      { name: 'Michael Johnson', address: '142 Maple Street, Phoenix, AZ 85001', phone: '(602) 555-0101', email: 'michael.johnson@email.com', notes: 'Interested in whole-home filtration. Has well water.' },
      { name: 'Sarah Williams', address: '87 Oak Avenue, Scottsdale, AZ 85251', phone: '(480) 555-0178', email: 'sarah.w@gmail.com', notes: undefined },
      { name: 'David Martinez', address: '310 Desert Rose Blvd, Tempe, AZ 85281', phone: '(480) 555-0234', email: 'david.martinez@hotmail.com', notes: 'City water. Concerned about chlorine taste.' },
      { name: 'Emily Thompson', address: '55 Saguaro Lane, Mesa, AZ 85201', phone: '(480) 555-0310', email: 'emily.t@yahoo.com', notes: undefined },
      { name: 'Robert Garcia', address: '720 Pinnacle Peak Rd, Glendale, AZ 85301', phone: '(623) 555-0445', email: 'rgarcia@outlook.com', notes: 'Family of 5. Hard water issues reported.' },
    ];

    const seededCustomers: CustomerDocument[] = [];
    for (const c of CUSTOMERS) {
      const existing = await customerModel.findOne({ email: c.email });
      if (existing) {
        console.log(`  exists   ${c.name}`);
        seededCustomers.push(existing);
      } else {
        const created = await customersService.create(c, rep1Id);
        console.log(`  created  ${c.name}`);
        seededCustomers.push(created);
      }
    }

    // ── Proposals ────────────────────────────────────────────────────────────
    console.log('\n=== Proposals ===');

    // Delete all existing proposals for rep1 and recreate (same as sales approach)
    const oldProposalCount = await proposalModel.countDocuments({ salesRep: rep1._id });
    if (oldProposalCount > 0) {
      await proposalModel.deleteMany({ salesRep: rep1._id });
      console.log(`  deleted ${oldProposalCount} old proposal(s) for rep1`);
    }

    const [cust1, cust2, cust3, cust4, cust5] = seededCustomers;

    // Grab adders if any exist
    const allAdders = await app.get(require('../adders/adders.service').AddersService).findAll();
    const adderIds = allAdders.slice(0, 2).map((a: any) => (a._id as Types.ObjectId).toString());

    // Proposal 1 — Supreme Diamond, financed, status: sent
    const p1 = await proposalsService.create(
      {
        customerId: (cust1._id as Types.ObjectId).toString(),
        waterType: WaterType.SUPREME,
        packageId: goldId,
        adderIds,
        salesMargin: 500,
        financierId: fWithLoan ? (fWithLoan._id as Types.ObjectId).toString() : undefined,
        loanOptionId: fWithLoan ? (fWithLoan.loanOptions[0]._id as Types.ObjectId).toString() : undefined,
      },
      rep1Id,
    );
    await proposalModel.findByIdAndUpdate(p1._id, { status: 'sent' });
    console.log(`  created  Proposal for ${cust1.name} — Supreme Gold — $${p1.cashPrice} cash — status: sent`);

    // Proposal 2 — Supreme Silver, cash, status: accepted
    const p2 = await proposalsService.create(
      {
        customerId: (cust2._id as Types.ObjectId).toString(),
        waterType: WaterType.SUPREME,
        packageId: silverId,
        adderIds: [],
        salesMargin: 0,
      },
      rep1Id,
    );
    await proposalModel.findByIdAndUpdate(p2._id, { status: 'accepted' });
    console.log(`  created  Proposal for ${cust2.name} — Supreme Silver — $${p2.cashPrice} cash — status: accepted`);

    // Proposal 3 — Homewater Platinum XL, cash, status: draft
    const p3 = await proposalsService.create(
      {
        customerId: (cust3._id as Types.ObjectId).toString(),
        waterType: WaterType.HOMEWATER,
        packageId: hwPlatXLId,
        adderIds: [],
        salesMargin: 0,
      },
      rep1Id,
    );
    console.log(`  created  Proposal for ${cust3.name} — Homewater Platinum XL — $${p3.cashPrice} cash — status: draft`);

    // Proposal 4 — Supreme Gold, financed, status: declined
    const p4 = await proposalsService.create(
      {
        customerId: (cust4._id as Types.ObjectId).toString(),
        waterType: WaterType.SUPREME,
        packageId: goldId,
        adderIds: [],
        salesMargin: 200,
        financierId: fWithLoan ? (fWithLoan._id as Types.ObjectId).toString() : undefined,
        loanOptionId: fWithLoan ? (fWithLoan.loanOptions[0]._id as Types.ObjectId).toString() : undefined,
      },
      rep1Id,
    );
    await proposalModel.findByIdAndUpdate(p4._id, { status: 'declined' });
    console.log(`  created  Proposal for ${cust4.name} — Supreme Gold — $${p4.cashPrice} cash — status: declined`);

    // Proposal 5 — Supreme Silver, financed, status: converted
    const p5 = await proposalsService.create(
      {
        customerId: (cust5._id as Types.ObjectId).toString(),
        waterType: WaterType.SUPREME,
        packageId: silverId,
        adderIds,
        salesMargin: 300,
        financierId: fWithLoan ? (fWithLoan._id as Types.ObjectId).toString() : undefined,
        loanOptionId: fWithLoan ? (fWithLoan.loanOptions[0]._id as Types.ObjectId).toString() : undefined,
      },
      rep1Id,
    );
    await proposalModel.findByIdAndUpdate(p5._id, { status: 'converted' });
    console.log(`  created  Proposal for ${cust5.name} — Supreme Silver — $${p5.cashPrice} cash — status: converted`);

    console.log('\n=== Done — log in to verify dashboard numbers ===');
    console.log('  rep1@example.com         → sees 3 sales + own commissions');
    console.log('  recruiter@example.com    → sees 3 sales (override on all 3)');
    console.log('  teamlead@example.com     → sees 2 Supreme sales (override)');
    console.log('  regional@example.com     → sees 2 Supreme sales (override)');
    console.log('  partner@example.com      → sees 2 Supreme sales (override)');
    console.log('  All roles               → 5 customers + 5 proposals visible to admin');

  } finally {
    await app.close();
  }
}

seedTest().catch((err) => {
  console.error('Test seed failed:', err);
  process.exit(1);
});
