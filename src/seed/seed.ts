import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/role.enum';
import { WaterType } from '../common/enums/water-type.enum';
import { Package, PackageDocument } from '../packages/schemas/package.schema';
import { Adder, AdderDocument } from '../adders/schemas/adder.schema';

// Supreme overrides confirmed from the client's spec. Bronze's regular
// (non-Nick) override split was never given — seeded as 0 until confirmed.
const SUPREME_PACKAGES = [
  {
    name: 'Diamond',
    price: 5200,
    overrides: { directRecruiter: 200, teamLead: 300, regional: 350, partner: 150 },
    nickOverride: 300,
  },
  {
    name: 'Gold',
    price: 4200,
    overrides: { directRecruiter: 150, teamLead: 200, regional: 250, partner: 100 },
    nickOverride: 200,
  },
  {
    name: 'Silver',
    price: 4000,
    overrides: { directRecruiter: 150, teamLead: 200, regional: 250, partner: 100 },
    nickOverride: 200,
  },
  {
    name: 'Bronze',
    price: 3300,
    overrides: { directRecruiter: 0, teamLead: 0, regional: 0, partner: 0 },
    nickOverride: 100,
  },
];

const H2PROS_PACKAGES = [
  {
    name: 'Starter Package',
    price: 2500,
    overrides: { directRecruiter: 0, teamLead: 0, regional: 0, partner: 0 },
    nickOverride: 0,
  },
];

// Homewater: flat rep commission, override paid to Direct Recruiter only.
// Nick's "Silver XL"/"Silver" labels are mapped to Base XL/Base L here —
// that mapping is an assumption, flagged to the user, not yet confirmed.
const HOMEWATER_PACKAGES = [
  { name: 'Platinum XL', price: 500, repCommissionFlat: 500, directRecruiterOverride: 100, nickOverride: 50 },
  { name: 'Platinum L', price: 450, repCommissionFlat: 450, directRecruiterOverride: 90, nickOverride: 45 },
  { name: 'Gold XL', price: 425, repCommissionFlat: 425, directRecruiterOverride: 85, nickOverride: 43 },
  { name: 'Gold L', price: 375, repCommissionFlat: 375, directRecruiterOverride: 75, nickOverride: 38 },
  { name: 'Base XL', price: 275, repCommissionFlat: 275, directRecruiterOverride: 55, nickOverride: 28 },
  { name: 'Base L', price: 250, repCommissionFlat: 250, directRecruiterOverride: 50, nickOverride: 25 },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const configService = app.get(ConfigService);
    const usersService = app.get(UsersService);
    const packageModel = app.get<Model<PackageDocument>>(getModelToken(Package.name));
    const adderModel = app.get<Model<AdderDocument>>(getModelToken(Adder.name));

    const adminEmail = configService.get<string>('seedAdmin.email');
    const adminPassword = configService.get<string>('seedAdmin.password');
    const adminName = configService.get<string>('seedAdmin.name');

    if (!adminEmail || !adminPassword) {
      console.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin user seed.');
    } else {
      const existingAdmin = await usersService.findByEmailWithPassword(adminEmail);
      if (existingAdmin) {
        console.log(`Admin user ${adminEmail} already exists — skipping.`);
      } else {
        await usersService.create({
          name: adminName ?? 'Admin',
          email: adminEmail,
          password: adminPassword,
          role: Role.ADMIN,
        });
        console.log(`Created admin user: ${adminEmail}`);
      }
    }

    for (const pkg of SUPREME_PACKAGES) {
      const exists = await packageModel.findOne({ waterType: WaterType.SUPREME, name: pkg.name });
      if (exists) {
        console.log(`Supreme package "${pkg.name}" already exists — skipping.`);
        continue;
      }
      await packageModel.create({
        waterType: WaterType.SUPREME,
        name: pkg.name,
        price: pkg.price,
        repCommissionFlat: null,
        overrides: pkg.overrides,
        nickOverride: pkg.nickOverride,
      });
      console.log(`Seeded Supreme package "${pkg.name}".`);
    }

    for (const pkg of HOMEWATER_PACKAGES) {
      const exists = await packageModel.findOne({ waterType: WaterType.HOMEWATER, name: pkg.name });
      if (exists) {
        console.log(`Homewater package "${pkg.name}" already exists — skipping.`);
        continue;
      }
      await packageModel.create({
        waterType: WaterType.HOMEWATER,
        name: pkg.name,
        price: pkg.price,
        repCommissionFlat: pkg.repCommissionFlat,
        overrides: { directRecruiter: pkg.directRecruiterOverride, teamLead: 0, regional: 0, partner: 0 },
        nickOverride: pkg.nickOverride,
      });
      console.log(`Seeded Homewater package "${pkg.name}".`);
    }

    for (const pkg of H2PROS_PACKAGES) {
      const exists = await packageModel.findOne({ waterType: WaterType.H2PROS, name: pkg.name });
      if (exists) {
        console.log(`H2Pros package "${pkg.name}" already exists — skipping.`);
        continue;
      }
      await packageModel.create({
        waterType: WaterType.H2PROS,
        name: pkg.name,
        price: pkg.price,
        repCommissionFlat: null,
        overrides: pkg.overrides,
        nickOverride: pkg.nickOverride,
      });
      console.log(`Seeded H2Pros package "${pkg.name}".`);
    }

    // Default adders
    const DEFAULT_ADDERS = [
      { name: 'Reverse Osmosis', price: 400 },
      { name: 'UV Light', price: 350 },
      { name: 'Filter Upgrade', price: 250 },
      { name: 'Softener Upgrade', price: 500 },
    ];
    for (const adder of DEFAULT_ADDERS) {
      const exists = await adderModel.findOne({ name: adder.name });
      if (exists) {
        console.log(`Adder "${adder.name}" already exists — skipping.`);
        continue;
      }
      await adderModel.create(adder);
      console.log(`Seeded adder "${adder.name}".`);
    }

    console.log('\nSeed complete. Bronze (Supreme) overrides and the Nick-override Homewater');
    console.log('tier mapping are placeholders — confirm and update via the admin Products screen.');
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
