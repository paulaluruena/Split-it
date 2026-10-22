import React, { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
  ChevronRight,
  Store,
  Edit2,
  ArrowLeft,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { ReceiptItem, SplitState } from '../types';
import { formatMoney } from '../utils/formatters';
import { ItemEditModal } from './ItemEditModal';

interface ReviewScreenProps {
  state: SplitState;
  onUpdateState: (updater: (prev: SplitState) => SplitState) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  state,
  onUpdateState,
  onNext,
  onBack,
}) => {
  const [editingItem, setEditingItem] = useState<ReceiptItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [isEditingRestaurant, setIsEditingRestaurant] = useState(false);
  const [restaurantInput, setRestaurantInput] = useState(state.restaurant);
  const [taxInput, setTaxInput] = useState(state.tax.toFixed(2));

  // Calculate sum of item prices
  const itemsSum = state.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const printedSubtotal = state.subtotal > 0 ? state.subtotal : itemsSum;
  const difference = Math.abs(itemsSum - printedSubtotal);
  const hasMismatch = difference > 0.05;
  const showWarningBanner = hasMismatch || state.confidence === 'low';

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ReceiptItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = (savedItem: ReceiptItem) => {
    onUpdateState((prev) => {
      const exists = prev.items.some((it) => it.id === savedItem.id);
      let updatedItems: ReceiptItem[];
      if (exists) {
        updatedItems = prev.items.map((it) => (it.id === savedItem.id ? savedItem : it));
      } else {
        updatedItems = [...prev.items, savedItem];
      }
      return {
        ...prev,
        items: updatedItems,
      };
    });
  };

  const handleDeleteItem = (id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== id),
    }));
  };

  const handleSyncSubtotal = () => {
    onUpdateState((prev) => ({
      ...prev,
      subtotal: itemsSum,
    }));
  };

  const handleSaveTax = () => {
    const val = parseFloat(taxInput.replace(/[^0-9.]/g, '')) || 0;
    onUpdateState((prev) => ({
      ...prev,
      tax: val,
    }));
    setIsEditingTax(false);
  };

  const handleSaveRestaurant = () => {
    onUpdateState((prev) => ({
      ...prev,
      restaurant: restaurantInput.trim() || 'Restaurant',
    }));
    setIsEditingRestaurant(false);
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-4 pb-28">
      {/* Top Bar with Back and Title */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
          title="Back to start"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Step 1 of 3: Review Receipt
        </span>
        <div className="w-8"></div>
      </div>

      {/* Restaurant Header */}
      <div className="mt-4 mb-3">
        {isEditingRestaurant ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={restaurantInput}
              onChange={(e) => setRestaurantInput(e.target.value)}
              className="flex-1 px-3 py-1.5 text-lg font-bold border border-emerald-500 rounded-xl outline-hidden"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRestaurant()}
            />
            <button
              onClick={handleSaveRestaurant}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingRestaurant(true)}
            className="flex items-center gap-2 text-left group cursor-pointer"
          >
            <Store className="w-5 h-5 text-emerald-600 shrink-0" />
            <h1 className="text-xl font-bold text-stone-900 group-hover:text-emerald-700 transition-colors truncate">
              {state.restaurant || 'Restaurant Bill'}
            </h1>
            <Edit2 className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* Yellow Warning Banner: If mismatch or confidence low */}
      {showWarningBanner && (
        <div className="mb-4 p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold leading-snug">
                Double-check the items — some prices may be off.
              </p>
              <p className="text-[11px] text-amber-700/90 mt-0.5">
                Sum of items is{' '}
                <strong className="font-mono-num">{formatMoney(itemsSum, state.currency)}</strong>
                {state.subtotal > 0 && (
                  <> (printed subtotal: <span className="font-mono-num">{formatMoney(state.subtotal, state.currency)}</span>)</>
                )}
              </p>
            </div>
          </div>

          {hasMismatch && (
            <button
              type="button"
              onClick={handleSyncSubtotal}
              className="self-start text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Update subtotal to match items ({formatMoney(itemsSum, state.currency)})
            </button>
          )}
        </div>
      )}

      {/* Editable Items List Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-stone-800">
          Receipt Items ({state.items.length})
        </h2>
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add item</span>
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-2 mb-5">
        {state.items.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-stone-200/80">
            <p className="text-sm font-semibold text-stone-600 mb-2">No items listed yet</p>
            <button
              onClick={handleOpenAddModal}
              className="text-xs font-bold text-emerald-600 underline"
            >
              Tap here to add an item
            </button>
          </div>
        ) : (
          state.items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleOpenEditModal(item)}
              className="flex items-center justify-between p-3.5 bg-white hover:bg-stone-50/80 active:bg-stone-100 rounded-2xl border border-stone-200/80 shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex-1 pr-3">
                <div className="flex items-center gap-2">
                  {item.quantity > 1 && (
                    <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 font-bold text-[10px] rounded-md font-mono-num">
                      {item.quantity}×
                    </span>
                  )}
                  <span className="font-semibold text-stone-800 text-sm group-hover:text-emerald-950 transition-colors">
                    {item.name}
                  </span>
                </div>
                <span className="text-[11px] text-stone-400">Tap to edit</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono-num font-bold text-sm text-stone-900">
                  {formatMoney(item.price, state.currency)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(item.id);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Delete item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bill Totals Card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span>Items subtotal</span>
          <span className="font-mono-num font-semibold text-stone-800">
            {formatMoney(itemsSum, state.currency)}
          </span>
        </div>

        {/* Tax (editable) */}
        <div className="flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-1.5">
            <span>Sales Tax / VAT</span>
            <button
              type="button"
              onClick={() => {
                setTaxInput(state.tax.toFixed(2));
                setIsEditingTax(true);
              }}
              className="text-[10px] text-emerald-600 hover:underline font-bold"
            >
              Edit
            </button>
          </div>

          {isEditingTax ? (
            <div className="flex items-center gap-1">
              <span className="text-stone-400">{state.currency}</span>
              <input
                type="text"
                inputMode="decimal"
                value={taxInput}
                onChange={(e) => setTaxInput(e.target.value)}
                onBlur={handleSaveTax}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTax()}
                className="w-16 px-1.5 py-0.5 border border-emerald-500 rounded text-right font-mono-num text-xs outline-hidden"
                autoFocus
              />
            </div>
          ) : (
            <span className="font-mono-num font-semibold text-stone-800">
              {formatMoney(state.tax, state.currency)}
            </span>
          )}
        </div>

        {/* Tip included note if detected */}
        {state.tipIncluded > 0 && (
          <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 p-2 rounded-xl">
            <span className="font-medium">Auto-Gratuity Included</span>
            <span className="font-mono-num font-bold">
              {formatMoney(state.tipIncluded, state.currency)}
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
          <span className="font-bold text-sm text-stone-900">Total</span>
          <span className="font-mono-num font-bold text-base text-stone-900">
            {formatMoney(itemsSum + (state.tax || 0) + (state.tipIncluded || 0), state.currency)}
          </span>
        </div>
      </div>

      {/* Sticky Bottom Bar with "Next: who's splitting?" button */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-stone-200/80 p-4 pb-safe z-40">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={onNext}
            disabled={state.items.length === 0}
            className="w-full min-h-[52px] h-[52px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <span>Next: who's splitting?</span>
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Modal for adding/editing items */}
      <ItemEditModal
        item={editingItem}
        currency={state.currency}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
    </div>
  );
};
