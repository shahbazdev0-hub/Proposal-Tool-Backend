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
import { Role } from '../common/enums/role.enum';
import { WaterType } from '../common/enums/water-type.enum';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import { CreateSaleDto } from '../sales/dto/create-sale.dto';

const PASSWORD = 'Password123!';

async function seedTest() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const usersService = app.get(UsersService);
    const salesService = app.get(SalesService);
    const packagesService = app.get(PackagesService);
    const financiersService = app.get(FinanciersService);
    const saleModel = app.get<Model<SaleDocument>>(getModelToken(Sale.name));

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

    console.log('\n=== Done — log in to verify dashboard numbers ===');
    console.log('  rep1@example.com         → sees 3 sales + own commissions');
    console.log('  recruiter@example.com    → sees 3 sales (override on all 3)');
    console.log('  teamlead@example.com     → sees 2 Supreme sales (override)');
    console.log('  regional@example.com     → sees 2 Supreme sales (override)');
    console.log('  partner@example.com      → sees 2 Supreme sales (override)');

  } finally {
    await app.close();
  }
}

seedTest().catch((err) => {
  console.error('Test seed failed:', err);
  process.exit(1);
});
