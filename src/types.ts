export type Market = 'a' | 'hk' | 'us';

export interface PlanItem {
  id: string;
  price: number;
  qty: number;
}

export interface CalculationResult {
  beforeCost: number;
  costReduce: number;
  totalInvest: number;
  finalQty: number;
  finalCost: number;
  diffPercent: number;
  neededQty: number;
  neededMoney: number;
  isUnreachable: boolean;
  qtyGap: number;
  totalFundsNeeded: number;
  periodicInvestment: number;
  qtyPerPeriod: number;
}
