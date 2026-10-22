import { SplitState } from '../types';
import { calculateSplitBreakdown, formatMoney } from './formatters';

export function encodeSplitToUrl(state: SplitState): string {
  try {
    const compact = {
      r: state.restaurant,
      c: state.currency,
      i: state.items.map((it) => ({
        id: it.id,
        n: it.name,
        p: it.price,
        q: it.quantity,
        a: it.assignedTo,
      })),
      s: state.subtotal,
      t: state.tax,
      ti: state.tipIncluded,
      tr: state.tipRate,
      cta: state.customTipAmount,
      tt: state.tipType,
      p: state.people.map((p) => ({
        id: p.id,
        n: p.name,
        c: p.color,
      })),
    };

    const jsonStr = JSON.stringify(compact);
    // Base64 encoding compatible with UTF-8
    const base64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));

    const url = new URL(window.location.href);
    url.hash = `split=${encodeURIComponent(base64)}`;
    return url.toString();
  } catch (err) {
    console.error('Failed to encode split state to URL:', err);
    return window.location.href;
  }
}

export function decodeSplitFromUrl(): SplitState | null {
  try {
    const hash = window.location.hash;
    if (!hash || !hash.includes('split=')) return null;

    const match = hash.match(/split=([^&]+)/);
    if (!match || !match[1]) return null;

    const base64 = decodeURIComponent(match[1]);
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const parsed = JSON.parse(jsonStr);

    return {
      restaurant: parsed.r || 'Restaurant',
      currency: parsed.c || '$',
      items: (parsed.i || []).map((it: any) => ({
        id: it.id || Math.random().toString(36).substring(2, 9),
        name: it.n || 'Item',
        price: Number(it.p) || 0,
        quantity: Number(it.q) || 1,
        assignedTo: Array.isArray(it.a) ? it.a : [],
      })),
      subtotal: Number(parsed.s) || 0,
      tax: Number(parsed.t) || 0,
      tipIncluded: Number(parsed.ti) || 0,
      tipRate: Number(parsed.tr) || 18,
      customTipAmount: Number(parsed.cta) || 0,
      tipType: parsed.tt === 'amount' ? 'amount' : 'percent',
      confidence: 'high',
      people: (parsed.p || []).map((p: any, idx: number) => ({
        id: p.id || `p-${idx + 1}`,
        name: p.n || `Friend ${idx + 1}`,
        color: p.c || '#059669',
        bgLight: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        borderCol: 'border-emerald-500',
        textCol: 'text-emerald-700',
      })),
    };
  } catch (err) {
    console.error('Failed to parse split from URL hash:', err);
    return null;
  }
}

export function generateBreakdownText(state: SplitState): string {
  const { breakdowns, itemsSum, tipAmount, totalWithTaxAndTip } = calculateSplitBreakdown(state);
  const cur = state.currency || '$';

  let text = `🧾 Split It — ${state.restaurant || 'Bill Summary'}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const b of breakdowns) {
    text += `👤 ${b.person.name}: ${formatMoney(b.total, cur)}\n`;
    if (b.items.length > 0) {
      for (const it of b.items) {
        const shareNote = it.shareRatio < 1 ? ` (${Math.round(it.shareRatio * 100)}%)` : '';
        text += `   • ${it.item.name}${shareNote}: ${formatMoney(it.shareAmount, cur)}\n`;
      }
    }
    if (b.taxShare > 0 || b.tipShare > 0) {
      text += `   • Tax: ${formatMoney(b.taxShare, cur)} | Tip: ${formatMoney(b.tipShare, cur)}\n`;
    }
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Subtotal: ${formatMoney(itemsSum, cur)}\n`;
  if (state.tax > 0) text += `Tax: ${formatMoney(state.tax, cur)}\n`;
  if (tipAmount > 0) text += `Tip: ${formatMoney(tipAmount, cur)}\n`;
  text += `Total: ${formatMoney(totalWithTaxAndTip, cur)}\n\n`;
  text += `Calculated with Split It ✨`;

  return text;
}
