import React from 'react';
import { RefreshCw, Check, Image as ImageIcon, Zap } from 'lucide-react';
import { ProcessedImage } from '../utils/imageUtils';

interface PreviewScreenProps {
  processedImage: ProcessedImage;
  onConfirm: () => void;
  onRetake: () => void;
}

export const PreviewScreen: React.FC<PreviewScreenProps> = ({
  processedImage,
  onConfirm,
  onRetake,
}) => {
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-5 pt-6 pb-8 justify-between">
      {/* Top Header */}
      <div className="text-center pt-2">
        <h2 className="text-xl font-bold text-stone-900">Check your photo</h2>
        <p className="text-xs text-stone-500 mt-1">
          Make sure items and prices are clear and legible
        </p>
      </div>

      {/* Thumbnail Card */}
      <div className="my-auto py-4">
        <div className="relative bg-stone-900 rounded-3xl overflow-hidden shadow-xl ring-1 ring-stone-900/10 flex items-center justify-center max-h-[60vh]">
          <img
            src={processedImage.dataUrl}
            alt="Receipt preview"
            className="w-full h-auto max-h-[58vh] object-contain rounded-2xl"
          />

          {/* Quick badge showing compression/size stats */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 bg-stone-900/80 backdrop-blur-md rounded-xl text-[11px] text-stone-200 border border-white/10">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Optimized ({processedImage.width}×{processedImage.height})</span>
            </span>
            <span className="text-stone-400 font-mono-num">
              {processedImage.compressedSizeKB} KB
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons: Min 48px height for mobile touch target */}
      <div className="w-full space-y-3">
        <button
          type="button"
          onClick={onConfirm}
          className="w-full min-h-[52px] h-[52px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>Use photo</span>
        </button>

        <button
          type="button"
          onClick={onRetake}
          className="w-full min-h-[48px] h-12 bg-white hover:bg-stone-50 active:scale-[0.98] transition-all text-stone-700 font-semibold text-sm rounded-2xl border border-stone-300/80 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-4 h-4 text-stone-500" />
          <span>Retake</span>
        </button>
      </div>
    </div>
  );
};
