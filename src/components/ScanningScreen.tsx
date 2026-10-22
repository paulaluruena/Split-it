import React, { useState, useEffect } from 'react';
import { Sparkles, Receipt } from 'lucide-react';
import { ProcessedImage } from '../utils/imageUtils';

interface ScanningScreenProps {
  processedImage?: ProcessedImage | null;
}

const ROTATING_MESSAGES = [
  'Reading the receipt…',
  'Finding the prices…',
  'Extracting items & quantities…',
  'Checking tax and totals…',
  'Polishing your item list…',
];

export const ScanningScreen: React.FC<ScanningScreenProps> = ({ processedImage }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % ROTATING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-5 pt-12 pb-10 justify-between items-center text-center">
      {/* Top indicator */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold animate-pulse">
        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
        <span>Gemini AI Processing</span>
      </div>

      {/* Center visual: receipt preview with animated scanning beam */}
      <div className="relative my-auto w-full max-w-[280px] aspect-[3/4] bg-white rounded-3xl p-3 shadow-2xl border border-stone-200/80 overflow-hidden flex flex-col items-center justify-center">
        {processedImage ? (
          <img
            src={processedImage.dataUrl}
            alt="Scanning receipt"
            className="w-full h-full object-cover rounded-2xl filter brightness-95"
          />
        ) : (
          <div className="w-full h-full bg-stone-50 rounded-2xl flex flex-col items-center justify-center text-stone-400 p-6">
            <Receipt className="w-16 h-16 stroke-1 text-stone-300 mb-2" />
            <div className="w-3/4 h-2 bg-stone-200 rounded mb-2"></div>
            <div className="w-1/2 h-2 bg-stone-200 rounded mb-2"></div>
            <div className="w-2/3 h-2 bg-stone-200 rounded"></div>
          </div>
        )}

        {/* Animated scanning laser line */}
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-[bounce_2.5s_infinite]"></div>

        {/* Ambient overlay */}
        <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none"></div>
      </div>

      {/* Rotating messages container */}
      <div className="w-full space-y-3">
        <div className="h-10 flex items-center justify-center">
          <p
            key={messageIndex}
            className="text-lg font-bold text-stone-800 transition-all duration-300 animate-fadeIn"
          >
            {ROTATING_MESSAGES[messageIndex]}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {ROTATING_MESSAGES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === messageIndex ? 'w-6 bg-emerald-600' : 'w-1.5 bg-stone-300'
              }`}
            />
          ))}
        </div>

        <p className="text-xs text-stone-400">
          This usually takes only 2–4 seconds
        </p>
      </div>
    </div>
  );
};
