import { Person, ReceiptItem, PersonBreakdown, SplitState } from '../types';

export function formatMoney(amount: number | null | undefined, currency = '$'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  const isNeg = amount < -0.0001;
  const absVal = Math.abs(amount);
  const rounded = Math.round(absVal * 100) / 100;
  return `${isNeg ? '-' : ''}${currency}${rounded.toFixed(2)}`;
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
 * All calculations performed in integer cents with leftover cents distributed
 * to the people with the largest shares so totals equal the bill exactly.
 */
export function calculateSplitBreakdown(state: SplitState): {
  breakdowns: PersonBreakdown[];
  unassignedItems: ReceiptItem[];
  itemsSum: number;
  tipAmount: number;
  totalWithTaxAndTip: number;
} {
  const { items, people, tax, tipRate, customTipAmount, tipType, tipIncluded, subtotal } = state;

  // Convert all master amounts to integer cents
  const totalItemsCents = items.reduce(
    (acc, it) => acc + Math.round((Number(it.price) || 0) * 100),
    0
  );
  const effectiveSubtotalCents =
    totalItemsCents > 0 ? totalItemsCents : Math.round((subtotal || 0) * 100);

  let tipCents = 0;
  if (tipIncluded && tipIncluded > 0) {
    tipCents = Math.round(tipIncluded * 100);
  } else if (tipType === 'percent') {
    tipCents = Math.max(0, Math.round((effectiveSubtotalCents * tipRate) / 100));
  } else {
    tipCents = Math.max(0, Math.round((customTipAmount || 0) * 100));
  }

  const taxCents = Math.round((tax || 0) * 100);
  const billTotalCents = totalItemsCents + taxCents + tipCents;

  const unassignedItems: ReceiptItem[] = [];

  // Track each person's data in integer cents
  const personDataMap = new Map<
    string,
    {
      itemsList: Array<{ item: ReceiptItem; shareRatio: number; shareAmount: number }>;
      itemsCents: number;
      taxCents: number;
      tipCents: number;
      totalCents: number;
    }
  >();

  for (const p of people) {
    personDataMap.set(p.id, {
      itemsList: [],
      itemsCents: 0,
      taxCents: 0,
      tipCents: 0,
      totalCents: 0,
    });
  }

  // 1. Distribute items in integer cents
  for (const item of items) {
    const itemCents = Math.round((Number(item.price) || 0) * 100);
    const assignedIds = item.assignedTo.filter((id) => people.some((p) => p.id === id));

    if (assignedIds.length === 0) {
      unassignedItems.push(item);
    } else {
      const n = assignedIds.length;
      const baseShareCents = Math.trunc(itemCents / n);
      let remainderCents = itemCents - baseShareCents * n;
      const step = remainderCents >= 0 ? 1 : -1;

      assignedIds.forEach((personId, idx) => {
        const extra = idx < Math.abs(remainderCents) ? step : 0;
        const personShareCents = baseShareCents + extra;
        const pData = personDataMap.get(personId);
        if (pData) {
          pData.itemsList.push({
            item,
            shareRatio: 1 / n,
            shareAmount: personShareCents / 100,
          });
          pData.itemsCents += personShareCents;
        }
      });
    }
  }

  const assignedItemsCentsSum = Array.from(personDataMap.values()).reduce(
    (sum, p) => sum + p.itemsCents,
    0
  );

  // Helper to sort person IDs by item shares descending
  const peopleSortedByItemCents = [...people].sort(
    (a, b) => (personDataMap.get(b.id)?.itemsCents || 0) - (personDataMap.get(a.id)?.itemsCents || 0)
  );

  // 2. Proportional Tax in integer cents
  if (taxCents !== 0 && people.length > 0) {
    let allocatedTaxCents = 0;
    for (const p of people) {
      const pData = personDataMap.get(p.id)!;
      let share = 0;
      if (assignedItemsCentsSum > 0) {
        share = Math.round((pData.itemsCents / assignedItemsCentsSum) * taxCents);
      } else {
        share = Math.trunc(taxCents / people.length);
      }
      pData.taxCents = share;
      allocatedTaxCents += share;
    }

    // Distribute leftover tax cents to largest shares
    let leftoverTax = taxCents - allocatedTaxCents;
    const taxStep = leftoverTax > 0 ? 1 : -1;
    let idx = 0;
    while (leftoverTax !== 0 && peopleSortedByItemCents.length > 0) {
      const p = peopleSortedByItemCents[idx % peopleSortedByItemCents.length];
      personDataMap.get(p.id)!.taxCents += taxStep;
      leftoverTax -= taxStep;
      idx++;
    }
  }

  // 3. Proportional Tip in integer cents
  if (tipCents !== 0 && people.length > 0) {
    let allocatedTipCents = 0;
    for (const p of people) {
      const pData = personDataMap.get(p.id)!;
      let share = 0;
      if (assignedItemsCentsSum > 0) {
        share = Math.round((pData.itemsCents / assignedItemsCentsSum) * tipCents);
      } else {
        share = Math.trunc(tipCents / people.length);
      }
      pData.tipCents = share;
      allocatedTipCents += share;
    }

    // Distribute leftover tip cents to largest shares
    let leftoverTip = tipCents - allocatedTipCents;
    const tipStep = leftoverTip > 0 ? 1 : -1;
    let idx = 0;
    while (leftoverTip !== 0 && peopleSortedByItemCents.length > 0) {
      const p = peopleSortedByItemCents[idx % peopleSortedByItemCents.length];
      personDataMap.get(p.id)!.tipCents += tipStep;
      leftoverTip -= tipStep;
      idx++;
    }
  }

  // 4. Calculate total for each person and ensure exact match with assigned total
  for (const p of people) {
    const pData = personDataMap.get(p.id)!;
    pData.totalCents = pData.itemsCents + pData.taxCents + pData.tipCents;
  }

  // Double check if unassignedItems is 0 and adjust any residual discrepancy to largest totals
  if (unassignedItems.length === 0 && people.length > 0) {
    const sumOfTotals = Array.from(personDataMap.values()).reduce(
      (acc, p) => acc + p.totalCents,
      0
    );
    let diff = billTotalCents - sumOfTotals;
    if (diff !== 0) {
      const step = diff > 0 ? 1 : -1;
      let idx = 0;
      while (diff !== 0) {
        const p = peopleSortedByItemCents[idx % peopleSortedByItemCents.length];
        personDataMap.get(p.id)!.totalCents += step;
        diff -= step;
        idx++;
      }
    }
  }

  // Convert back to dollars for output
  const breakdowns: PersonBreakdown[] = people.map((person) => {
    const pData = personDataMap.get(person.id)!;
    return {
      person,
      items: pData.itemsList,
      itemsTotal: pData.itemsCents / 100,
      taxShare: pData.taxCents / 100,
      tipShare: pData.tipCents / 100,
      total: pData.totalCents / 100,
    };
  });

  return {
    breakdowns,
    unassignedItems,
    itemsSum: totalItemsCents / 100,
    tipAmount: tipCents / 100,
    totalWithTaxAndTip: billTotalCents / 100,
  };
}
