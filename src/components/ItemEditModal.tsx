import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import { ReceiptItem } from '../types';

interface ItemEditModalProps {
  item: ReceiptItem | null;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ReceiptItem) => void;
  onDelete?: (id: string) => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  item,
  currency,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [quantity, setQuantity] = useState(1);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setName(item.name);
        setPriceStr(item.price ? item.price.toFixed(2) : '');
        setQuantity(item.quantity || 1);
      } else {
        setName('');
        setPriceStr('');
        setQuantity(1);
      }
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'Custom Item';
    const parsedPrice = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

    const savedItem: ReceiptItem = {
      id: item?.id || Math.random().toString(36).substring(2, 9),
      name: cleanName,
      price: parsedPrice,
      quantity: Math.max(1, quantity),
      assignedTo: item?.assignedTo || [],
    };

    onSave(savedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-stone-200 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-900">
            {item ? 'Edit item' : 'Add new item'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Item Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Margherita Pizza"
              className="w-full h-12 px-4 rounded-xl border border-stone-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-base text-stone-900 outline-hidden transition-all"
              required
            />
          </div>

          {/* Price & Quantity Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                Line Price ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                  {currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 pl-8 pr-4 rounded-xl border border-stone-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-base font-mono-num text-stone-900 outline-hidden transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                Quantity
              </label>
              <div className="flex items-center h-12 border border-stone-300 rounded-xl px-2 justify-between">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span className="font-bold text-stone-800 font-mono-num">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 space-y-2">
            <button
              type="submit"
              className="w-full min-h-[50px] h-[50px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Save item</span>
            </button>

            {item && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(item.id);
                  onClose();
                }}
                className="w-full min-h-[44px] h-11 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete item</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
