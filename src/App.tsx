/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StartScreen } from './components/StartScreen';
import { PreviewScreen } from './components/PreviewScreen';
import { ScanningScreen } from './components/ScanningScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { SplittingScreen } from './components/SplittingScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { ProcessedImage, processReceiptImage } from './utils/imageUtils';
import { RawReceiptResponse, ReceiptItem, SplitState } from './types';
import { getPersonPalette } from './utils/formatters';
import { decodeSplitFromUrl } from './utils/shareUtils';

type Screen = 'start' | 'preview' | 'scanning' | 'error' | 'review' | 'splitting' | 'summary';

const DEFAULT_STATE: SplitState = {
  restaurant: 'Restaurant',
  currency: '$',
  items: [],
  subtotal: 0,
  tax: 0,
  tipIncluded: 0,
  tipRate: 18,
  customTipAmount: 0,
  tipType: 'percent',
  confidence: 'high',
  people: [
    {
      id: 'p-1',
      name: 'Me',
      color: getPersonPalette(0).color,
      bgLight: getPersonPalette(0).bgLight,
      borderCol: getPersonPalette(0).borderCol,
      textCol: getPersonPalette(0).textCol,
    },
    {
      id: 'p-2',
      name: 'Friend 2',
      color: getPersonPalette(1).color,
      bgLight: getPersonPalette(1).bgLight,
      borderCol: getPersonPalette(1).borderCol,
      textCol: getPersonPalette(1).textCol,
    },
  ],
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [splitState, setSplitState] = useState<SplitState>(DEFAULT_STATE);
  const [errorType, setErrorType] = useState<'not_a_receipt' | 'network_error'>('network_error');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [technicalError, setTechnicalError] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Check if opened from a shared link with encoded data in URL hash
  useEffect(() => {
    const sharedData = decodeSplitFromUrl();
    if (sharedData && sharedData.items.length > 0) {
      setSplitState(sharedData);
      setCurrentScreen('summary');
    }
  }, []);

  // When user selects a file from Camera or Photo Library
  const handleFileSelected = async (file: File) => {
    try {
      const processed = await processReceiptImage(file);
      setProcessedImage(processed);
      setCurrentScreen('preview');
    } catch (err: any) {
      setErrorType('network_error');
      setErrorMessage(err?.message || 'Unable to process the image file.');
      setTechnicalError(err?.message || String(err));
      setCurrentScreen('error');
    }
  };

  // Convert raw API response or sample into active SplitState
  const loadReceiptResponse = (data: RawReceiptResponse) => {
    if (!data.items || data.items.length === 0) {
      setErrorType('not_a_receipt');
      setErrorMessage("We couldn't detect any line items or prices.");
      setTechnicalError('No items found in OCR response.');
      setCurrentScreen('error');
      return;
    }

    const itemsSum = data.items.reduce((s, it) => s + (Number(it.price) || 0), 0);
    const subtotal = data.subtotal && data.subtotal > 0 ? data.subtotal : itemsSum;

    const receiptItems: ReceiptItem[] = data.items.map((it, idx) => ({
      id: `it-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name: it.name || `Item ${idx + 1}`,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      assignedTo: [], // Initially unassigned for friend tagging
    }));

    setSplitState((prev) => ({
      ...prev,
      restaurant: data.restaurant || 'Restaurant Bill',
      currency: data.currency || '$',
      items: receiptItems,
      subtotal: subtotal,
      tax: Number(data.tax) || 0,
      tipIncluded: Number(data.tip_included) || 0,
      confidence: data.confidence || 'high',
      tipRate: 18,
      tipType: 'percent',
      customTipAmount: 0,
    }));

    setCurrentScreen('review');
  };

  // Helper function to call OCR endpoint with 60s timeout
  const executeScanRequest = async (img: ProcessedImage) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000); // 60-second timeout

    try {
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: img.base64,
          mimeType: img.mimeType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMessage = '';
        try {
          const errJson = await res.json();
          errMessage = errJson.message || errJson.error || '';
        } catch {
          // ignore
        }
        const error = new Error(errMessage || `Server returned HTTP ${res.status}`);
        (error as any).serverMessage = errMessage;
        throw error;
      }

      const result: RawReceiptResponse = await res.json();
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  // Send photo to Gemini OCR API with 60s timeout and automatic 1-time retry
  const handleScanConfirmed = async () => {
    if (!processedImage) return;

    setCurrentScreen('scanning');
    setIsRetrying(false);

    try {
      // First attempt
      const result = await executeScanRequest(processedImage);

      if (!result.items || result.items.length === 0) {
        setErrorType('not_a_receipt');
        setErrorMessage("We couldn't detect any line items or prices.");
        setTechnicalError('Gemini OCR returned empty items array.');
        setCurrentScreen('error');
        return;
      }

      loadReceiptResponse(result);
    } catch (firstErr: any) {
      console.warn('Initial scan attempt failed, retrying once...', firstErr);

      // Auto-retry once before showing the error screen
      setIsRetrying(true);

      try {
        // Brief 800ms pause before retrying
        await new Promise((resolve) => setTimeout(resolve, 800));

        const retryResult = await executeScanRequest(processedImage);

        if (!retryResult.items || retryResult.items.length === 0) {
          setErrorType('not_a_receipt');
          setErrorMessage("We couldn't detect any line items or prices.");
          setTechnicalError('Gemini OCR returned empty items array on retry.');
          setCurrentScreen('error');
          return;
        }

        loadReceiptResponse(retryResult);
      } catch (retryErr: any) {
        console.error('Retry scan attempt failed:', retryErr);
        setErrorType('network_error');
        if (retryErr?.name === 'AbortError') {
          setErrorMessage('This is taking too long — check your connection and try again.');
          setTechnicalError('No response from server after 60 seconds (upload may have failed)');
        } else {
          setErrorMessage(
            'We encountered a problem while processing the receipt. Please make sure the photo is clear and try again.'
          );
          const serverMsg =
            retryErr?.serverMessage ||
            retryErr?.message ||
            firstErr?.serverMessage ||
            firstErr?.message ||
            String(retryErr);
          setTechnicalError(serverMsg);
        }
        setCurrentScreen('error');
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const handleManualEntry = () => {
    setSplitState((prev) => ({
      ...prev,
      restaurant: 'Manual Bill',
      items: [
        {
          id: `it-${Date.now()}`,
          name: 'First Item',
          price: 10.0,
          quantity: 1,
          assignedTo: [],
        },
      ],
      subtotal: 10.0,
      tax: 0.8,
      confidence: 'high',
    }));
    setCurrentScreen('review');
  };

  const handleStartNew = () => {
    setProcessedImage(null);
    setIsRetrying(false);
    // Clear URL hash
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setSplitState(DEFAULT_STATE);
    setCurrentScreen('start');
  };

  return (
    <div className="min-h-screen bg-stone-100/90 text-stone-900 selection:bg-emerald-100 selection:text-emerald-900">
      {currentScreen === 'start' && (
        <StartScreen
          onFileSelected={handleFileSelected}
          onSelectSample={loadReceiptResponse}
        />
      )}

      {currentScreen === 'preview' && processedImage && (
        <PreviewScreen
          processedImage={processedImage}
          onConfirm={handleScanConfirmed}
          onRetake={() => setCurrentScreen('start')}
        />
      )}

      {currentScreen === 'scanning' && (
        <ScanningScreen
          processedImage={processedImage}
          isRetrying={isRetrying}
        />
      )}

      {currentScreen === 'error' && (
        <ErrorScreen
          type={errorType}
          errorMessage={errorMessage}
          technicalError={technicalError}
          onTryAgain={() => setCurrentScreen('start')}
          onEnterManually={handleManualEntry}
        />
      )}

      {currentScreen === 'review' && (
        <ReviewScreen
          state={splitState}
          onUpdateState={setSplitState}
          onNext={() => setCurrentScreen('splitting')}
          onBack={() => setCurrentScreen('start')}
        />
      )}

      {currentScreen === 'splitting' && (
        <SplittingScreen
          state={splitState}
          onUpdateState={setSplitState}
          onNext={() => setCurrentScreen('summary')}
          onBack={() => setCurrentScreen('review')}
        />
      )}

      {currentScreen === 'summary' && (
        <SummaryScreen
          state={splitState}
          onEditSplit={() => setCurrentScreen('splitting')}
          onStartNew={handleStartNew}
        />
      )}
    </div>
  );
}
