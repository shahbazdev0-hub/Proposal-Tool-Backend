import { WaterType } from '../common/enums/water-type.enum';

// waterType is a free-form string; only "homewater" triggers the flat model.
export interface CommissionPackageInput {
  price: number;
  repCommissionFlat: number | null;
  overrides: {
    directRecruiter: number;
    teamLead: number;
    regional: number;
    partner: number;
  };
  nickOverride: number;
}

export interface CommissionInput {
  waterType: string;
  package: CommissionPackageInput;
  loanAmount: number;
  dealerFeePercent: number;
  addersTotal: number;
}

export interface CommissionBreakdown {
  salesRep: number;
  directRecruiter: number;
  teamLead: number;
  regional: number;
  partner: number;
  nickOverride: number;
}

export function calculateCommission(input: CommissionInput): CommissionBreakdown {
  const { waterType, package: pkg, loanAmount, dealerFeePercent, addersTotal } = input;

  if (waterType === WaterType.HOMEWATER) {
    // Flat pricing — no loan-amount math at all. Only Direct Recruiter gets an override.
    return {
      salesRep: pkg.repCommissionFlat ?? 0,
      directRecruiter: pkg.overrides.directRecruiter,
      teamLead: 0,
      regional: 0,
      partner: 0,
      nickOverride: pkg.nickOverride,
    };
  }

  // Supreme — dynamic waterfall. A cash sale has dealerFeePercent 0, which
  // collapses this to "amount sold above base package price" automatically.
  const afterDealerFee = loanAmount * (1 - dealerFeePercent / 100);
  const afterAdders = afterDealerFee - addersTotal;
  const salesRep = afterAdders - pkg.price;

  return {
    salesRep,
    directRecruiter: pkg.overrides.directRecruiter,
    teamLead: pkg.overrides.teamLead,
    regional: pkg.overrides.regional,
    partner: pkg.overrides.partner,
    nickOverride: pkg.nickOverride,
  };
}
