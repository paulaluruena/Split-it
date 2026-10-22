import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  UserPlus,
  Users,
  Check,
  Percent,
  DollarSign,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { Person, ReceiptItem, SplitState } from '../types';
import { formatMoney, getPersonPalette, calculateSplitBreakdown } from '../utils/formatters';

interface SplittingScreenProps {
  state: SplitState;
  onUpdateState: (updater: (prev: SplitState) => SplitState) => void;
  onNext: () => void;
  onBack: () => void;
}

export const SplittingScreen: React.FC<SplittingScreenProps> = ({
  state,
  onUpdateState,
  onNext,
  onBack,
}) => {
  const [newPersonName, setNewPersonName] = useState('');
  const [showAddPersonInput, setShowAddPersonInput] = useState(false);
  const [customTipInput, setCustomTipInput] = useState(
    state.customTipAmount ? state.customTipAmount.toString() : ''
  );

  const { unassignedItems } = calculateSplitBreakdown(state);

  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPersonName.trim();
    if (!trimmed) return;

    const palette = getPersonPalette(state.people.length);
    const newPerson: Person = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      color: palette.color,
      bgLight: palette.bgLight,
      borderCol: palette.borderCol,
      textCol: palette.textCol,
    };

    onUpdateState((prev) => ({
      ...prev,
      people: [...prev.people, newPerson],
    }));

    setNewPersonName('');
    setShowAddPersonInput(false);
  };

  const handleRemovePerson = (personId: string) => {
    if (state.people.length <= 1) return; // Keep at least one person

    onUpdateState((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== personId),
      items: prev.items.map((it) => ({
        ...it,
        assignedTo: it.assignedTo.filter((id) => id !== personId),
      })),
    }));
  };

  const toggleItemPerson = (itemId: string, personId: string) => {
    onUpdateState((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const isAssigned = item.assignedTo.includes(personId);
        const updatedAssigned = isAssigned
          ? item.assignedTo.filter((id) => id !== personId)
          : [...item.assignedTo, personId];
        return {
          ...item,
          assignedTo: updatedAssigned,
        };
      }),
    }));
  };

  const handleSplitItemWithAll = (itemId: string) => {
    const allPersonIds = state.people.map((p) => p.id);
    onUpdateState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, assignedTo: allPersonIds } : item
      ),
    }));
  };

  const handleSplitUnassignedWithAll = () => {
    const allPersonIds = state.people.map((p) => p.id);
    onUpdateState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.assignedTo.length === 0 ? { ...item, assignedTo: allPersonIds } : item
      ),
    }));
  };

  const handleSplitEverythingEvenly = () => {
    const allPersonIds = state.people.map((p) => p.id);
    onUpdateState((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, assignedTo: allPersonIds })),
    }));
  };

  const handleSetTipPreset = (rate: number) => {
    onUpdateState((prev) => ({
      ...prev,
      tipType: 'percent',
      tipRate: rate,
      customTipAmount: 0,
    }));
  };

  const handleSetCustomTip = (val: string) => {
    setCustomTipInput(val);
    const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
    onUpdateState((prev) => ({
      ...prev,
      tipType: 'amount',
      customTipAmount: num,
    }));
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-4 pb-28">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
          title="Back to Review"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Step 2 of 3: Tap who had what
        </span>
        <div className="w-8"></div>
      </div>

      {/* Friends Section */}
      <div className="my-4 bg-white rounded-2xl border border-stone-200/80 p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              People Splitting ({state.people.length})
            </h2>
          </div>
          {!showAddPersonInput && (
            <button
              type="button"
              onClick={() => setShowAddPersonInput(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add person</span>
            </button>
          )}
        </div>

        {/* Add Person Inline Input */}
        {showAddPersonInput && (
          <form onSubmit={handleAddPerson} className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="Enter name (e.g. Jordan)"
              className="flex-1 h-10 px-3 text-sm rounded-xl border border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
              autoFocus
            />
            <button
              type="submit"
              className="h-10 px-4 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-emerald-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddPersonInput(false)}
              className="h-10 w-10 flex items-center justify-center text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Friends Badges */}
        <div className="flex flex-wrap gap-2">
          {state.people.map((person) => (
            <div
              key={person.id}
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full border text-xs font-semibold ${person.bgLight}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: person.color }}
              />
              <span>{person.name}</span>
              {state.people.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemovePerson(person.id)}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-stone-300/40 text-stone-400 hover:text-stone-700 ml-0.5 cursor-pointer"
                  title={`Remove ${person.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Bulk Actions */}
      <div className="flex items-center gap-2 mb-3">
        {unassignedItems.length > 0 && (
          <button
            type="button"
            onClick={handleSplitUnassignedWithAll}
            className="flex-1 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Split {unassignedItems.length} unassigned with all</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleSplitEverythingEvenly}
          className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          Split all evenly
        </button>
      </div>

      {/* Items list with tap assignments */}
      <div className="space-y-3 mb-6">
        {state.items.map((item) => {
          const assignedCount = item.assignedTo.length;
          const sharePrice = assignedCount > 0 ? item.price / assignedCount : item.price;
          const isUnassigned = assignedCount === 0;

          return (
            <div
              key={item.id}
              className={`p-3.5 bg-white rounded-2xl border transition-all shadow-xs ${
                isUnassigned ? 'border-amber-300 ring-2 ring-amber-100' : 'border-stone-200/80'
              }`}
            >
              {/* Item Info Header */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  {item.quantity > 1 && (
                    <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 font-bold text-[10px] rounded-md font-mono-num">
                      {item.quantity}×
                    </span>
                  )}
                  <span className="font-bold text-sm text-stone-900">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono-num font-bold text-sm text-stone-900">
                    {formatMoney(item.price, state.currency)}
                  </span>
                  {assignedCount > 1 && (
                    <p className="text-[10px] text-emerald-600 font-semibold font-mono-num">
                      {formatMoney(sharePrice, state.currency)} each ({assignedCount} ways)
                    </p>
                  )}
                </div>
              </div>

              {/* Tappable People Buttons for this Item */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {state.people.map((person) => {
                  const isSelected = item.assignedTo.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleItemPerson(item.id, person.id)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                        isSelected
                          ? `${person.bgLight} ring-2 ring-emerald-500/30 shadow-xs font-bold`
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200/70 border border-transparent'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: person.color }}
                      />
                      <span>{person.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  );
                })}

                {/* Quick Split All Button for this Item */}
                {assignedCount < state.people.length && (
                  <button
                    type="button"
                    onClick={() => handleSplitItemWithAll(item.id)}
                    className="min-h-[40px] px-2.5 py-1.5 text-[11px] font-bold text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Everyone
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip Selection Section */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Tip / Gratuity
          </span>
          {state.tipIncluded > 0 && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              ✓ Auto-gratuity included ({formatMoney(state.tipIncluded, state.currency)})
            </span>
          )}
        </div>

        {state.tipIncluded > 0 ? (
          <p className="text-xs text-stone-500">
            The receipt already includes a tip of {formatMoney(state.tipIncluded, state.currency)}. It
            will be shared fairly among everyone.
          </p>
        ) : (
          <div>
            <div className="grid grid-cols-5 gap-1.5 mb-2.5">
              {[0, 15, 18, 20, 25].map((rate) => {
                const isActive = state.tipType === 'percent' && state.tipRate === rate;
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleSetTipPreset(rate)}
                    className={`min-h-[44px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {rate}%
                  </button>
                );
              })}
            </div>

            {/* Custom Tip Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-stone-500">Or custom:</span>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">
                  {state.currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customTipInput}
                  onChange={(e) => handleSetCustomTip(e.target.value)}
                  placeholder="Custom tip amount"
                  className="w-full h-9 pl-6 pr-3 text-xs rounded-lg border border-stone-300 focus:border-emerald-500 font-mono-num outline-hidden"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-stone-200/80 p-4 pb-safe z-40">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={onNext}
            className="w-full min-h-[52px] h-[52px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <span>See the breakdown</span>
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
