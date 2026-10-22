import React from 'react';
import { AlertCircle, RefreshCw, PlusCircle, HelpCircle } from 'lucide-react';

interface ErrorScreenProps {
  type: 'not_a_receipt' | 'network_error';
  errorMessage?: string;
  onTryAgain: () => void;
  onEnterManually: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  type,
  errorMessage,
  onTryAgain,
  onEnterManually,
}) => {
  const isNotReceipt = type === 'not_a_receipt';

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-5 pt-12 pb-10 justify-between items-center text-center">
      <div className="w-full flex flex-col items-center my-auto">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5 ring-4 ring-amber-50">
          <AlertCircle className="w-8 h-8 stroke-[2.2]" />
        </div>

        <h2 className="text-2xl font-extrabold text-stone-900 mb-2">
          {isNotReceipt
            ? "That doesn't look like a receipt, try again"
            : "Couldn't read the receipt"}
        </h2>

        <p className="text-stone-600 text-sm max-w-xs font-medium leading-relaxed mb-6">
          {isNotReceipt
            ? "We couldn't detect any line items or prices. Try snapping a closer, well-lit photo of the bill."
            : errorMessage || "The image was too blurry or the connection dipped. Let's give it another shot."}
        </p>

        {/* Helpful tips box */}
        <div className="w-full bg-stone-50 rounded-2xl p-4 border border-stone-200 text-left text-xs text-stone-600 space-y-2 mb-6">
          <div className="flex items-center gap-1.5 font-bold text-stone-800">
            <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
            <span>Tips for a great scan:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-stone-500 pl-1">
            <li>Place the receipt flat on a dark or contrasting table</li>
            <li>Ensure good lighting and avoid heavy shadows</li>
            <li>Hold phone steady directly above the text</li>
          </ul>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full space-y-3">
        <button
          type="button"
          onClick={onTryAgain}
          className="w-full min-h-[52px] h-[52px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
          <span>Try again</span>
        </button>

        <button
          type="button"
          onClick={onEnterManually}
          className="w-full min-h-[48px] h-12 bg-white hover:bg-stone-50 active:scale-[0.98] transition-all text-stone-700 font-semibold text-sm rounded-2xl border border-stone-300/80 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <PlusCircle className="w-4 h-4 text-stone-500" />
          <span>Enter items manually</span>
        </button>
      </div>
    </div>
  );
};
