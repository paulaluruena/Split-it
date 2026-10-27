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
 
// ---------- Gemini retry + backup models ----------
// The free Gemini tier allows only a few requests per minute per model (429),
// and the main model is sometimes overloaded (503). So: try the main model,
// retry once only if it is overloaded, then try other Flash models, which
// each have their own separate per-minute limit.
const PRIMARY_MODEL = 'gemini-3.8-flash';
const KNOWN_BACKUPS = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
];
let cachedBackupModels: string[] | null = null;
 
async function listFlashModels(): Promise<string[]> {
  const found: string[] = [];
  const pager: any = await ai.models.list();
  for await (const m of pager) {
    const name = String(m?.name || '').replace(/^models\//, '');
    const actions: string[] = m?.supportedActions || [];
    const canGenerate = actions.length === 0 || actions.includes('generateContent');
    if (
      name &&
      /flash/i.test(name) &&
      !/(image|tts|audio|live|embedding|thinking|preview|exp)/i.test(name) &&
      canGenerate
    ) {
      found.push(name);
    }
  }
  found.sort((x, y) => {
    const lx = /lite/i.test(x) ? 1 : 0;
    const ly = /lite/i.test(y) ? 1 : 0;
    if (lx !== ly) return lx - ly;
    return y.localeCompare(x, undefined, { numeric: true });
  });
  return found;
}
 
async function getBackupModels(): Promise<string[]> {
  if (cachedBackupModels) return cachedBackupModels;
  let listed: string[] = [];
  try {
    listed = await Promise.race([
      listFlashModels(),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 5000)),
    ]);
  } catch (e: any) {
    console.warn('[Gemini OCR] Could not list models:', e?.message || e);
  }
  const all = [...listed, ...KNOWN_BACKUPS].filter((m) => m !== PRIMARY_MODEL);
  cachedBackupModels = Array.from(new Set(all)).slice(0, 6);
  console.log('[Gemini OCR] Backup models:', cachedBackupModels);
  return cachedBackupModels;
}
 
function errorText(err: any): string {
  return String(err?.message || err);
}
function isRateLimit(err: any): boolean {
  return /429|RESOURCE_EXHAUSTED|quota/i.test(errorText(err));
}
function isOverloaded(err: any): boolean {
  return /503|500|UNAVAILABLE|high demand|overloaded|timed out/i.test(errorText(err));
}
function isModelMissing(err: any): boolean {
  return /404|not found|NOT_FOUND|not supported/i.test(errorText(err));
}
 
async function generateWithTimeout(model: string, contents: any, config: any, ms: number): Promise<any> {
  let timer: any;
  try {
    return await Promise.race([
      ai.models.generateContent({ model, contents, config }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${model} timed out after ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
 
async function callGeminiWithFallback(contents: any, config: any): Promise<{ response: any; modelUsed: string }> {
  const deadline = Date.now() + 50000;
  const errors: any[] = [];
 
  // 1) Main model: one try, plus one retry only if it was overloaded (503).
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 3000) break;
    try {
      const response = await generateWithTimeout(PRIMARY_MODEL, contents, config, Math.min(15000, timeLeft));
      return { response, modelUsed: PRIMARY_MODEL };
    } catch (err: any) {
      errors.push(err);
      console.warn(`[Gemini OCR] ${PRIMARY_MODEL} failed:`, errorText(err));
      if (isRateLimit(err)) break; // per-minute limit: retrying the same model won't help
      if (!isOverloaded(err) && !isModelMissing(err)) throw err; // a real error: report it
      if (isModelMissing(err)) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
 
  // 2) Backup models, one try each.
  for (const model of await getBackupModels()) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 3000) break;
    try {
      const response = await generateWithTimeout(model, contents, config, Math.min(12000, timeLeft));
      return { response, modelUsed: model };
    } catch (err: any) {
      if (!isModelMissing(err)) errors.push(err);
      console.warn(`[Gemini OCR] Backup ${model} failed:`, errorText(err));
    }
  }
 
  // 3) Everything failed: give a clear reason.
  const lastError = errors[errors.length - 1];
  const detail = errorText(lastError || 'Unknown error');
  if (errors.length > 0 && errors.every(isRateLimit)) {
    throw new Error(`Gemini is very busy right now — too many scans in the last minute (free limit). Wait about a minute and tap Try again. (${detail})`);
  }
  if (errors.some((e) => isRateLimit(e) || isOverloaded(e))) {
    throw new Error(`Gemini is very busy right now — wait a few seconds and tap Try again. (${detail})`);
  }
  throw lastError || new Error(detail);
}
 
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
 
    const { response, modelUsed } = await callGeminiWithFallback(
      [
        { inlineData: { mimeType: mimeType, data: cleanBase64 } },
        { text: systemPrompt },
      ],
      { responseMimeType: 'application/json' }
    );
    console.log(`[Gemini OCR] Model used: ${modelUsed}`);
 
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
