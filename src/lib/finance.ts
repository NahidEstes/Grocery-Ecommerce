export type FinanceEvent = {
  id: string;
  kind: "reconciliation" | "refund";
  amount: number;
  method: string;
  reference: string;
  note: string;
  staffId: string;
  staffName: string;
  at: string;
  returnId?: string;
};
export type OrderFinance = {
  reference: string;
  version: number;
  basis: string;
  received: number;
  reconciled: boolean;
  events: FinanceEvent[];
};
export const cents = (value: number) => Math.round(value * 100);
export const refundedAmount = (finance: OrderFinance) =>
  finance.events
    .filter((e) => e.kind === "refund")
    .reduce((sum, e) => sum + cents(e.amount), 0) / 100;
