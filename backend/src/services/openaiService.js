const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getBaseUrl() {
  return String(process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getModel(override) {
  return override || process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = [];
  const output = Array.isArray(payload?.output) ? payload.output : [];
  output.forEach((item) => {
    if (Array.isArray(item?.content)) {
      item.content.forEach((content) => {
        if (typeof content?.text === 'string') parts.push(content.text);
        if (typeof content?.output_text === 'string') parts.push(content.output_text);
      });
    }
  });

  return parts.join('\n').trim();
}

function parseJsonResponse(text = '') {
  const raw = String(text || '').trim();
  const withoutFence = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Model response did not contain valid JSON');
  }

  return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
}

function ensureFetchSupport() {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable in this Node runtime');
  }
}

function buildAuthHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    ...extra
  };
}

async function parseResponseJson(response) {
  return response.json().catch(() => null);
}

async function createTextResponse({ model, instructions, input, maxOutputTokens = 1400, temperature, timeoutMs = 30000 }) {
  if (!isConfigured()) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  ensureFetchSupport();

  const resolvedModel = getModel(model);
  const payload = {
    model: resolvedModel,
    instructions,
    input,
    max_output_tokens: maxOutputTokens
  };

  if (typeof temperature === 'number') {
    payload.temperature = temperature;
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(`${getBaseUrl()}/responses`, {
      method: 'POST',
      signal: controller?.signal,
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const data = await parseResponseJson(response);
  if (!response.ok) {
    const detail = data?.error?.message || response.statusText || 'Unknown OpenAI error';
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  return {
    model: data?.model || resolvedModel,
    text: extractOutputText(data),
    raw: data
  };
}

async function createSpeechAudio({
  model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
  voice = process.env.OPENAI_TTS_VOICE || 'coral',
  input,
  instructions = '',
  responseFormat = 'mp3',
  timeoutMs = 30000
}) {
  if (!isConfigured()) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  ensureFetchSupport();

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(`${getBaseUrl()}/audio/speech`, {
      method: 'POST',
      signal: controller?.signal,
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model,
        voice,
        input,
        instructions,
        response_format: responseFormat
      })
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await parseResponseJson(response);
    const detail = errorBody?.error?.message || response.statusText || 'Unknown OpenAI error';
    throw new Error(`OpenAI speech request failed (${response.status}): ${detail}`);
  }

  const mimeType = response.headers.get('content-type') || `audio/${responseFormat}`;
  const arrayBuffer = await response.arrayBuffer();

  return {
    model,
    voice,
    mimeType,
    buffer: Buffer.from(arrayBuffer)
  };
}

async function transcribeAudio({
  buffer,
  filename = 'audio.webm',
  mimeType = 'audio/webm',
  model = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
  language = '',
  prompt = '',
  responseFormat = 'json',
  timeoutMs = 45000
}) {
  if (!isConfigured()) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  ensureFetchSupport();
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Audio buffer is required for transcription');
  }
  if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('FormData or Blob is unavailable in this Node runtime');
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  form.append('model', model);
  form.append('response_format', responseFormat);
  if (language) form.append('language', language);
  if (prompt) form.append('prompt', prompt);

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(`${getBaseUrl()}/audio/transcriptions`, {
      method: 'POST',
      signal: controller?.signal,
      headers: buildAuthHeaders(),
      body: form
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await parseResponseJson(response);
    const detail = errorBody?.error?.message || response.statusText || 'Unknown OpenAI error';
    throw new Error(`OpenAI transcription request failed (${response.status}): ${detail}`);
  }

  if (responseFormat === 'text') {
    const text = (await response.text()).trim();
    return { model, text, raw: text };
  }

  const data = await parseResponseJson(response);
  return {
    model,
    text: String(data?.text || '').trim(),
    raw: data
  };
}

module.exports = {
  createTextResponse,
  createSpeechAudio,
  getModel,
  isConfigured,
  parseJsonResponse,
  transcribeAudio
};
