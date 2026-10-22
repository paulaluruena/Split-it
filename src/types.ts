export interface RawReceiptResponse {
  restaurant: string | null;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number | null;
  tax: number | null;
  tip_included: number | null;
  total: number | null;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number; // Line total
  quantity: number;
  assignedTo: string[]; // Person IDs who share this item
}

export interface Person {
  id: string;
  name: string;
  color: string;
  bgLight: string;
  borderCol: string;
  textCol: string;
}

export interface SplitState {
  restaurant: string;
  currency: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tipIncluded: number;
  tipRate: number; // Percentage, e.g. 18
  customTipAmount: number; // If custom dollar tip
  tipType: 'percent' | 'amount';
  confidence: 'high' | 'medium' | 'low';
  people: Person[];
}

export interface PersonBreakdown {
  person: Person;
  items: Array<{
    item: ReceiptItem;
    shareRatio: number;
    shareAmount: number;
  }>;
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
}
