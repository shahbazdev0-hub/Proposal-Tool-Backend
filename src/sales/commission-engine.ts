import { WaterType } from '../common/enums/water-type.enum';

// waterType is a free-form string; only "homewater" triggers the flat model.
export interface CommissionPackageInput {
  price: number;
  pricingMode?: 'static' | 'dynamic';
  repCommissionType?: 'flat' | 'percent';
  repCommissionValue?: number | null;
  // Deprecated — superseded by repCommissionType/repCommissionValue, read
  // only as a fallback for packages saved before those fields existed.
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
  /** Cash price of this specific sale — needed to resolve a percent-based
   *  Static commission, which is a % of what this sale actually cost. */
  cashPrice: number;
}

export interface CommissionBreakdown {
  salesRep: number;
  directRecruiter: number;
  teamLead: number;
  regional: number;
  partner: number;
  nickOverride: number;
}

export function calculateCommission(
  input: CommissionInput,
): CommissionBreakdown {
  const {
    waterType,
    package: pkg,
    loanAmount,
    dealerFeePercent,
    addersTotal,
    cashPrice,
  } = input;

  // Static pricing overrides the water-type formula entirely, regardless of
  // water type — the client's ask was "this option should populate in all
  // [water type] options", not just Homewater.
  if (pkg.pricingMode === 'static') {
    const salesRep =
      pkg.repCommissionValue != null
        ? pkg.repCommissionType === 'percent'
          ? (cashPrice * pkg.repCommissionValue) / 100
          : pkg.repCommissionValue
        : (pkg.repCommissionFlat ?? 0);
    return {
      salesRep,
      directRecruiter: pkg.overrides.directRecruiter,
      teamLead: waterType === WaterType.HOMEWATER ? 0 : pkg.overrides.teamLead,
      regional: waterType === WaterType.HOMEWATER ? 0 : pkg.overrides.regional,
      partner: waterType === WaterType.HOMEWATER ? 0 : pkg.overrides.partner,
      nickOverride: pkg.nickOverride,
    };
  }

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

  if (waterType === 'h2pros') {
    // 10% of loan amount minus $285, plus 20% of adders (upgrades).
    // Upline overrides and Nick's override follow the Supreme package structure.
    const salesRep = loanAmount * 0.1 - 285 + addersTotal * 0.2;
    return {
      salesRep,
      directRecruiter: pkg.overrides.directRecruiter,
      teamLead: pkg.overrides.teamLead,
      regional: pkg.overrides.regional,
      partner: pkg.overrides.partner,
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
