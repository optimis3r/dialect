const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen2.5:3b';

function cleanText(value, fallback = '') {
  return String(value || fallback || '').trim();
}

function getBaseUrl() {
  return cleanText(process.env.OLLAMA_BASE_URL, DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getModel(override) {
  return cleanText(override, process.env.OLLAMA_MODEL || DEFAULT_MODEL);
}

function isEnabled() {
  const provider = cleanText(process.env.AI_PROVIDER, 'ollama').toLowerCase();
  return provider === 'ollama';
}

function extractMessageText(payload) {
  return cleanText(payload?.message?.content || payload?.response || '');
}

async function parseResponseJson(response) {
  return response.json().catch(() => null);
}

async function createChatResponse({
  model,
  system,
  messages = [],
  temperature = 0.7,
  timeoutMs = 60000
}) {
  if (!isEnabled()) {
    throw new Error('Ollama provider is disabled');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(`${getBaseUrl()}/api/chat`, {
      method: 'POST',
      signal: controller?.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getModel(model),
        stream: false,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages
        ],
        options: {
          temperature
        }
      })
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const data = await parseResponseJson(response);
  if (!response.ok) {
    const detail = cleanText(data?.error, response.statusText || 'Unknown Ollama error');
    throw new Error(`Ollama request failed (${response.status}): ${detail}`);
  }

  const text = extractMessageText(data);
  if (!text) {
    throw new Error('Ollama returned an empty response');
  }

  return {
    model: cleanText(data?.model, getModel(model)),
    text,
    raw: data
  };
}

module.exports = {
  createChatResponse,
  getModel,
  isEnabled
};
