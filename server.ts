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
    const imageSizeKB = Math.round((cleanBase64.length * 3) / 4 / 1024);
    console.log(`[Gemini OCR] Received image: ${imageSizeKB} KB at ${new Date().toLocaleTimeString()}`);

    const systemPrompt = `You are an expert receipt OCR and item parsing engine.
Examine this receipt photo carefully.

Instructions:
1. Detect whether this is a genuine receipt or bill from a restaurant, cafe, bar, grocery store, or shop.
2. If this image is NOT a receipt, return {"restaurant": null, "items": [], "subtotal": null, "tax": null, "tip_included": null, "total": null, "currency": "$", "confidence": "low"}.
3. For genuine receipts, extract and return strictly valid JSON matching this structure:
{
  "restaurant": string or null,
  "items": [{"name": string, "price": number, "quantity": number}],
  "subtotal": number or null,
  "tax": number or null,
  "tip_included": number or null,
  "total": number or null,
  "currency": string,
  "confidence": "high" | "medium" | "low"
}
Rules:
- If an item has quantity > 1, price MUST be the line total (quantity * unit price).
- Do not include tax, tip, or subtotal in "items".
- Discounts can be negative price items.
- Return ONLY the JSON object.`;

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
            responseMimeType: 'application/json',
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
    console.log(`[Gemini OCR] Call completed in ${elapsedSeconds} seconds (Image: ${imageSizeKB} KB)`);

    const outputText = response.text || '';
    if (!outputText.trim()) {
      throw new Error('Empty response from AI model');
    }

    // Strip any ```json or ``` code fences before parsing
    let cleanJson = outputText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    let data: any;
    try {
      data = JSON.parse(cleanJson);
    } catch (parseErr: any) {
      console.error(`[Gemini OCR] JSON parse failed after ${elapsedSeconds}s. Raw reply:`, outputText);
      return res.status(500).json({
        error: 'JSON parse error',
        message: `${outputText} (Image: ${imageSizeKB} KB, ${elapsedSeconds}s)`,
        rawReply: outputText,
        elapsedSeconds: parseFloat(elapsedSeconds),
        items: [],
        confidence: 'low',
      });
    }

    return res.json(data);
  } catch (err: any) {
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    const realErrorText = err?.message || String(err);
    console.error(`[Gemini OCR] Call failed after ${elapsedSeconds} seconds:`, realErrorText);
    return res.status(500).json({
      error: 'Failed to process receipt',
      message: `${realErrorText} (Image: ${req.body?.imageBase64 ? Math.round((req.body.imageBase64.length * 3) / 4 / 1024) : 0} KB, ${elapsedSeconds}s)`,
      elapsedSeconds: parseFloat(elapsedSeconds),
      items: [],
      confidence: 'low',
    });
  }
});

// Tiny 100x100 white JPEG base64 for image endpoint test
const TINY_WHITE_100x100_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCABkAGQBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AKpgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/9k=';

// Test endpoint with image: sends a tiny 100x100 JPEG to Gemini
app.get('/api/test-gemini-image', async (req, res) => {
  const startTime = Date.now();
  const apiKeySet = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const modelName = 'gemini-3.8-flash';

  if (!apiKeySet) {
    const elapsedSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    return res.status(500).json({
      ok: false,
      reply: null,
      elapsedSeconds,
      error: 'GEMINI_API_KEY environment variable is not set.',
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Test image call timed out after 30 seconds'));
    }, 30000);

    let response;
    try {
      response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: TINY_WHITE_100x100_JPEG_BASE64,
              },
            },
            {
              text: 'Describe this image in 3 words',
            },
          ],
          // @ts-ignore
          httpOptions: {
            timeout: 30000,
            signal: controller.signal,
          },
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Test image call timed out after 30 seconds'));
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
    });
  } catch (err: any) {
    const elapsedSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    return res.status(500).json({
      ok: false,
      reply: null,
      elapsedSeconds,
      error: err?.message || String(err),
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
