export type DisplayType = "fixed" | "from" | "surcharge" | "consultation";
export type PriceDefinition = {
  key: string;
  category: string;
  service: string;
  index: number | null;
  label: string;
  amountCents: number | null;
  displayType: DisplayType;
  sortOrder: number;
};
export const priceDefinitions: PriceDefinition[];
export const startingPriceKeys: Record<string, string>;
export function priceKeyFor(service: string, index: number): string;
export function formatPrice(amountCents: number | null, displayType: DisplayType): string;
