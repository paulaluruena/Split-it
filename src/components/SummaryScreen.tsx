import React, { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SplitState } from '../types';
import { calculateSplitBreakdown, formatMoney } from '../utils/formatters';
import { encodeSplitToUrl, generateBreakdownText } from '../utils/shareUtils';

interface SummaryScreenProps {
  state: SplitState;
  onEditSplit: () => void;
  onStartNew: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  state,
  onEditSplit,
  onStartNew,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const {
    breakdowns,
    unassignedItems,
    itemsSum,
    tipAmount,
    totalWithTaxAndTip,
  } = calculateSplitBreakdown(state);

  const cur = state.currency || '$';

  const handleShareLink = async () => {
    const shareUrl = encodeSplitToUrl(state);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Split It — ${state.restaurant || 'Bill Split'}`,
          text: `Check out your share of the bill at ${state.restaurant || 'the restaurant'}:`,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        // Fallback to clipboard if user dismissed or unsupported
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Legacy fallback
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyText = async () => {
    const text = generateBreakdownText(state);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-4 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
        <button
          type="button"
          onClick={onEditSplit}
          className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
          title="Edit assignments"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Step 3 of 3: Summary
        </span>
        <button
          type="button"
          onClick={onStartNew}
          className="text-xs font-bold text-stone-500 hover:text-stone-800 p-2 cursor-pointer flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Bill Overview Card */}
      <div className="mt-4 mb-4 bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {state.restaurant || 'Bill Summary'}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {state.people.length} people
          </span>
        </div>

        <div className="text-3xl font-extrabold font-mono-num tracking-tight mt-1 mb-3">
          {formatMoney(totalWithTaxAndTip, cur)}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-xs">
          <div>
            <span className="text-stone-400 block text-[10px] uppercase font-bold">Subtotal</span>
            <span className="font-mono-num font-semibold text-stone-200">
              {formatMoney(itemsSum, cur)}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px] uppercase font-bold">Tax</span>
            <span className="font-mono-num font-semibold text-stone-200">
              {formatMoney(state.tax, cur)}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px] uppercase font-bold">Tip</span>
            <span className="font-mono-num font-semibold text-stone-200">
              {formatMoney(tipAmount, cur)}
            </span>
          </div>
        </div>

        {/* Unassigned Warning if any */}
        {unassignedItems.length > 0 && (
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-amber-300">
            <span>⚠️ {unassignedItems.length} item(s) unassigned</span>
            <button
              onClick={onEditSplit}
              className="underline font-bold text-amber-200 hover:text-white cursor-pointer"
            >
              Assign now
            </button>
          </div>
        )}
      </div>

      {/* Person Breakdowns */}
      <div className="mb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2.5">
          Each Person's Share
        </h2>

        <div className="space-y-3">
          {breakdowns.map((b) => {
            const isExpanded = expandedPersonId === b.person.id;

            return (
              <div
                key={b.person.id}
                className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden transition-all"
              >
                {/* Person Header / Main Share Bar */}
                <div
                  onClick={() =>
                    setExpandedPersonId(isExpanded ? null : b.person.id)
                  }
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-stone-50/60 active:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-xs"
                      style={{ backgroundColor: b.person.color }}
                    >
                      {b.person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 text-base">{b.person.name}</h3>
                      <p className="text-xs text-stone-400">
                        {b.items.length} {b.items.length === 1 ? 'item' : 'items'} • Tap for breakdown
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-lg font-bold font-mono-num text-stone-900">
                        {formatMoney(b.total, cur)}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-stone-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-400" />
                    )}
                  </div>
                </div>

                {/* Collapsible Itemized Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-stone-100 bg-stone-50/50 space-y-2">
                    <div className="space-y-1.5 pt-2">
                      {b.items.map(({ item, shareRatio, shareAmount }) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs text-stone-700"
                        >
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className="text-stone-400">•</span>
                            <span className="truncate">{item.name}</span>
                            {shareRatio < 1 && (
                              <span className="text-[10px] text-stone-400 shrink-0 font-medium">
                                ({Math.round(shareRatio * 100)}%)
                              </span>
                            )}
                          </div>
                          <span className="font-mono-num font-medium shrink-0">
                            {formatMoney(shareAmount, cur)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-stone-200/60 space-y-1 text-[11px] text-stone-500">
                      <div className="flex justify-between">
                        <span>Items share:</span>
                        <span className="font-mono-num">{formatMoney(b.itemsTotal, cur)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax share:</span>
                        <span className="font-mono-num">{formatMoney(b.taxShare, cur)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tip share:</span>
                        <span className="font-mono-num">{formatMoney(b.tipShare, cur)}</span>
                      </div>
                    </div>

                    {/* Quick Venmo / Payment Link Helper for this person */}
                    <div className="pt-2 flex gap-2">
                      <a
                        href={`https://venmo.com/?txn=charge&amount=${b.total.toFixed(2)}&note=${encodeURIComponent(
                          `Split It: ${state.restaurant || 'Meal'}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold text-center flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>Request on Venmo</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Share & Copy Actions */}
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={handleCopyText}
          className="w-full min-h-[48px] h-12 bg-white hover:bg-stone-50 active:scale-[0.98] transition-all text-stone-700 font-semibold text-sm rounded-2xl border border-stone-300/80 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          {copiedText ? (
            <>
              <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span className="text-emerald-700 font-bold">Breakdown copied to clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-stone-500" />
              <span>Copy text breakdown for iMessage / WhatsApp</span>
            </>
          )}
        </button>
      </div>

      {/* Sticky Bottom Bar with Share Link Button */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-stone-200/80 p-4 pb-safe z-40">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={handleShareLink}
            className="w-full min-h-[52px] h-[52px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>Link copied to clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5 stroke-[2.5]" />
                <span>Share link with friends</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
