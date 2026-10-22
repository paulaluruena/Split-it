import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Sparkles, Receipt, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SAMPLE_RECEIPTS } from '../utils/sampleReceipts';
import { RawReceiptResponse } from '../types';

interface StartScreenProps {
  onFileSelected: (file: File) => void;
  onSelectSample: (sample: RawReceiptResponse) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onFileSelected,
  onSelectSample,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = ''; // Reset for re-capturing
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-5 pt-8 pb-10 justify-between">
      {/* Hidden file inputs: direct camera and gallery fallback */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
        id="camera-input"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryChange}
        className="hidden"
        id="gallery-input"
      />

      {/* Top Branding */}
      <div className="pt-4 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-5 ring-4 ring-emerald-50">
          <Receipt className="w-8 h-8 stroke-[2.2]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>AI-Powered Bill Splitter</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 mb-2">
          Split It
        </h1>
        <p className="text-stone-600 text-base max-w-xs font-medium leading-relaxed">
          Snap the receipt. Tap who had what. Done.
        </p>

        {/* Feature Highlights */}
        <div className="w-full mt-8 space-y-2.5 text-left">
          <div className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-stone-200/80 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">Instant OCR Scan</p>
              <p className="text-xs text-stone-500">Detects items, prices, tax, and auto-gratuity</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-stone-200/80 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">One-Tap Assignments</p>
              <p className="text-xs text-stone-500">Share items 50/50 or any way with friends</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="w-full space-y-3 pt-8">
        {/* Large Scan Receipt Button (Directly triggers environment camera) */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="w-full min-h-[56px] h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 cursor-pointer"
        >
          <Camera className="w-6 h-6 stroke-[2.2]" />
          <span>Scan receipt</span>
        </button>

        {/* Fallback: Choose from photos */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="w-full min-h-[48px] h-12 bg-white hover:bg-stone-50 active:scale-[0.98] transition-all text-stone-700 font-semibold text-sm rounded-2xl border border-stone-300/80 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <ImageIcon className="w-4 h-4 text-stone-500" />
          <span>Choose from photos</span>
        </button>

        {/* Try a demo receipt */}
        <div className="pt-4 border-t border-stone-200">
          <p className="text-xs text-center text-stone-400 font-medium mb-2.5">
            Don't have a receipt right now?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_RECEIPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectSample(sample.data)}
                className="p-3 bg-stone-50 hover:bg-stone-100 active:scale-[0.98] border border-stone-200 rounded-xl text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-stone-800 truncate">
                    {sample.name}
                  </span>
                  <ArrowRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-stone-500 leading-tight line-clamp-1">
                  {sample.data.items.length} items • ${sample.data.total?.toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
