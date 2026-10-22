import { Person, ReceiptItem, PersonBreakdown, SplitState } from '../types';

export function formatMoney(amount: number | null | undefined, currency = '$'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  // Round safely to 2 decimals
  const rounded = Math.round(amount * 100) / 100;
  return `${currency}${rounded.toFixed(2)}`;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate)}%`;
}

export const PERSON_PALETTES = [
  {
    color: '#059669', // Emerald
    bgLight: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderCol: 'border-emerald-500',
    textCol: 'text-emerald-700',
  },
  {
    color: '#2563eb', // Blue
    bgLight: 'bg-blue-50 text-blue-800 border-blue-200',
    borderCol: 'border-blue-500',
    textCol: 'text-blue-700',
  },
  {
    color: '#d97706', // Amber
    bgLight: 'bg-amber-50 text-amber-800 border-amber-200',
    borderCol: 'border-amber-500',
    textCol: 'text-amber-700',
  },
  {
    color: '#7c3aed', // Purple
    bgLight: 'bg-purple-50 text-purple-800 border-purple-200',
    borderCol: 'border-purple-500',
    textCol: 'text-purple-700',
  },
  {
    color: '#db2777', // Pink
    bgLight: 'bg-pink-50 text-pink-800 border-pink-200',
    borderCol: 'border-pink-500',
    textCol: 'text-pink-700',
  },
  {
    color: '#0891b2', // Cyan
    bgLight: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    borderCol: 'border-cyan-500',
    textCol: 'text-cyan-700',
  },
  {
    color: '#4f46e5', // Indigo
    bgLight: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    borderCol: 'border-indigo-500',
    textCol: 'text-indigo-700',
  },
  {
    color: '#ea580c', // Orange
    bgLight: 'bg-orange-50 text-orange-800 border-orange-200',
    borderCol: 'border-orange-500',
    textCol: 'text-orange-700',
  },
];

export function getPersonPalette(index: number) {
  return PERSON_PALETTES[index % PERSON_PALETTES.length];
}

/**
 * Calculates item totals, proportional tax, tip allocation, and grand totals
 */
export function calculateSplitBreakdown(state: SplitState): {
  breakdowns: PersonBreakdown[];
  unassignedItems: ReceiptItem[];
  itemsSum: number;
  tipAmount: number;
  totalWithTaxAndTip: number;
} {
  const { items, people, tax, tipRate, customTipAmount, tipType, tipIncluded, subtotal } = state;

  const itemsSum = items.reduce((acc, it) => acc + (Number(it.price) || 0), 0);
  const effectiveSubtotal = itemsSum > 0 ? itemsSum : (subtotal || 0);

  // Tip calculation
  let tipAmount = 0;
  if (tipIncluded && tipIncluded > 0) {
    tipAmount = tipIncluded;
  } else if (tipType === 'percent') {
    tipAmount = Math.max(0, (effectiveSubtotal * tipRate) / 100);
  } else {
    tipAmount = Math.max(0, customTipAmount || 0);
  }

  const unassignedItems: ReceiptItem[] = [];

  // Track raw person totals
  const personTotalsMap = new Map<string, {
    itemsList: Array<{ item: ReceiptItem; shareRatio: number; shareAmount: number }>;
    itemsTotal: number;
  }>();

  for (const p of people) {
    personTotalsMap.set(p.id, { itemsList: [], itemsTotal: 0 });
  }

  for (const item of items) {
    const assigned = item.assignedTo.filter((id) => people.some((p) => p.id === id));
    if (assigned.length === 0) {
      unassignedItems.push(item);
    } else {
      const splitFraction = 1 / assigned.length;
      const sharePrice = (item.price || 0) * splitFraction;

      for (const personId of assigned) {
        const pData = personTotalsMap.get(personId);
        if (pData) {
          pData.itemsList.push({
            item,
            shareRatio: splitFraction,
            shareAmount: sharePrice,
          });
          pData.itemsTotal += sharePrice;
        }
      }
    }
  }

  // Calculate assigned items total sum
  const assignedSum = Array.from(personTotalsMap.values()).reduce((sum, p) => sum + p.itemsTotal, 0);

  const breakdowns: PersonBreakdown[] = people.map((person) => {
    const pData = personTotalsMap.get(person.id) || { itemsList: [], itemsTotal: 0 };
    const personItemSum = pData.itemsTotal;

    // Proportional tax allocation based on assigned items
    let taxShare = 0;
    if (assignedSum > 0 && tax > 0) {
      taxShare = (personItemSum / assignedSum) * tax;
    } else if (people.length > 0 && tax > 0) {
      taxShare = tax / people.length;
    }

    // Proportional tip allocation based on assigned items
    let tipShare = 0;
    if (assignedSum > 0 && tipAmount > 0) {
      tipShare = (personItemSum / assignedSum) * tipAmount;
    } else if (people.length > 0 && tipAmount > 0) {
      tipShare = tipAmount / people.length;
    }

    const total = personItemSum + taxShare + tipShare;

    return {
      person,
      items: pData.itemsList,
      itemsTotal: personItemSum,
      taxShare,
      tipShare,
      total,
    };
  });

  const totalWithTaxAndTip = itemsSum + (tax || 0) + tipAmount;

  return {
    breakdowns,
    unassignedItems,
    itemsSum,
    tipAmount,
    totalWithTaxAndTip,
  };
}
