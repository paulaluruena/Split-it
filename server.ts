import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '30mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/parse-receipt', async (req, res) => {
  const startTime = Date.now();
  console.log(`[Gemini OCR] Received receipt parse request at ${new Date().toLocaleTimeString()}`);
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid image data.',
        items: [],
        confidence: 'low',
      });
    }

    // Strip data prefix if present (e.g. data:image/jpeg;base64,)
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');

    const systemPrompt = `You are an expert receipt OCR and item parsing engine.
Examine this receipt photo carefully.

Instructions:
1. Detect whether this is a genuine receipt or bill from a restaurant, cafe, bar, grocery store, or shop.
2. If this image is NOT a receipt (e.g. a person, selfie, scenery, random room, dog, car, screenshot of unrelated text), return items = [], restaurant = null, subtotal = null, tax = null, tip_included = null, total = null, and confidence = "low".
3. For genuine receipts, extract:
   - "restaurant": Name of the establishment (e.g. "Luigi's Pizzeria") or null.
   - "items": Array of purchased items.
     * "name": clean, readable name of the item (fix obvious OCR typos if clear).
     * "quantity": integer count (e.g. 1, 2, 3). Defaults to 1.
     * "price": CRITICAL RULE: If an item has quantity > 1, price MUST be the line total (total charge for all units of that item, e.g. 2 Beers @ $7 = 14.00). Must be a positive floating number with up to 2 decimal places.
     * Do NOT include subtotal, sales tax, tip, payment line, change, or card summary as items!
     * Discounts/coupons: if there is a discount, you may represent it as a negative price item or reduce the related item.
   - "subtotal": The subtotal before tax and tip. If not explicitly listed, calculate the sum of items.
   - "tax": The sales tax or VAT amount.
   - "tip_included": Any gratuity/tip or service charge that is ALREADY included on the bill (e.g. 18% auto-gratuity for large parties). If none or zero, set null.
   - "total": The grand total charged.
   - "currency": The currency symbol or code (e.g. "$", "€", "£", "CAD", "USD"). Default to "$".
   - "confidence": "high" if receipt is sharp and all numbers are unambiguous; "medium" if slightly faded, handwritten, or partially obscured; "low" if very blurry, unreadable, or not a receipt.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Gemini API call timed out after 40 seconds'));
    }, 40000);

    let response;
    try {
      response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64,
              },
            },
            {
              text: systemPrompt,
            },
          ],
          config: {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                restaurant: { type: Type.STRING, nullable: true },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      quantity: { type: Type.NUMBER },
                    },
                    required: ['name', 'price', 'quantity'],
                  },
                },
                subtotal: { type: Type.NUMBER, nullable: true },
                tax: { type: Type.NUMBER, nullable: true },
                tip_included: { type: Type.NUMBER, nullable: true },
                total: { type: Type.NUMBER, nullable: true },
                currency: { type: Type.STRING },
                confidence: {
                  type: Type.STRING,
                  enum: ['high', 'medium', 'low'],
                },
              },
              required: ['items', 'currency', 'confidence'],
            },
          },
          // @ts-ignore
          httpOptions: {
            timeout: 40000,
            signal: controller.signal,
          },
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Gemini generateContent timed out after 40 seconds'));
          });
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Gemini OCR] Call completed in ${elapsedSeconds} seconds`);

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Empty response from AI model');
    }

    const data = JSON.parse(outputText);
    return res.json(data);
  } catch (err: any) {
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    const realErrorText = err?.message || String(err);
    console.error(`[Gemini OCR] Call failed after ${elapsedSeconds} seconds:`, realErrorText);
    return res.status(500).json({
      error: 'Failed to process receipt',
      message: `${realErrorText} (${elapsedSeconds}s)`,
      elapsedSeconds: parseFloat(elapsedSeconds),
      items: [],
      confidence: 'low',
    });
  }
});

// Test endpoint: sends Gemini the text "Reply with the word OK" (no image)
app.get('/api/test-gemini', async (req, res) => {
  const startTime = Date.now();
  const apiKeySet = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const modelName = 'gemini-3.8-flash';

  if (!apiKeySet) {
    const elapsedSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    return res.status(500).json({
      ok: false,
      reply: null,
      elapsedSeconds,
      modelName,
      apiKeySet: false,
      error: 'GEMINI_API_KEY environment variable is not set.',
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Test call timed out after 30 seconds'));
    }, 30000);

    let response;
    try {
      response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: 'Reply with the word OK',
          // @ts-ignore
          httpOptions: {
            timeout: 30000,
            signal: controller.signal,
          },
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Test call timed out after 30 seconds'));
          });
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    const elapsedSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    const reply = response.text?.trim() || '';

    return res.json({
      ok: true,
      reply,
      elapsedSeconds,
      modelName,
      apiKeySet: true,
      error: null,
    });
  } catch (err: any) {
    const elapsedSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    return res.status(500).json({
      ok: false,
      reply: null,
      elapsedSeconds,
      modelName,
      apiKeySet: true,
      error: err?.message || String(err),
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Split It' });
});

if (!isProd) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Split It server running on http://0.0.0.0:${PORT}`);
});
