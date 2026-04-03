const { createSpeechAudio, isConfigured, transcribeAudio } = require('./openaiService');
const VOICE_PROVIDER = String(process.env.AI_VOICE_PROVIDER || process.env.AI_PROVIDER || 'browser').trim().toLowerCase();

const DEFAULT_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const DEFAULT_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'coral';
const DEFAULT_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

const PERSONA_VOICE_MAP = {
  analyst: 'alloy',
  challenger: 'ash',
  mentor: 'coral'
};

const PERSONA_INSTRUCTIONS = {
  analyst: 'Speak with calm confidence, crisp pacing, and an evidence-first tone.',
  challenger: 'Speak with sharper cadence, skeptical emphasis, and energetic debate pressure.',
  mentor: 'Speak warmly, clearly, and supportively while still sounding like a real debate opponent.'
};

function cleanText(value, fallback = '') {
  return String(value || fallback || '').trim();
}

function parseAudioDataUrl(audioDataUrl) {
  const raw = cleanText(audioDataUrl);
  const match = raw.match(/^data:(?<mime>audio\/[-+.a-zA-Z0-9]+);base64,(?<data>.+)$/);
  if (!match?.groups?.mime || !match?.groups?.data) {
    throw new Error('Audio payload must be a base64 data URL');
  }

  return {
    mimeType: match.groups.mime,
    buffer: Buffer.from(match.groups.data, 'base64')
  };
}

async function synthesizeOpponentSpeech({
  text,
  language = 'English',
  persona = 'analyst',
  difficulty = 'medium'
}) {
  const content = cleanText(text);
  if (!content) {
    return { audio: null, error: 'No text was provided for speech synthesis' };
  }

  if (VOICE_PROVIDER !== 'openai') {
    return {
      audio: null,
      provider: 'browser',
      model: '',
      voice: 'browser',
      fallbackUsed: true,
      error: ''
    };
  }

  if (!isConfigured()) {
    return {
      audio: null,
      provider: 'disabled',
      model: '',
      voice: '',
      fallbackUsed: true,
      error: 'OPENAI_API_KEY is not configured'
    };
  }

  const voice = process.env.OPENAI_TTS_VOICE || PERSONA_VOICE_MAP[persona] || DEFAULT_TTS_VOICE;
  const instructions = [
    PERSONA_INSTRUCTIONS[persona] || PERSONA_INSTRUCTIONS.analyst,
    `Speak in ${language}.`,
    `Match a ${difficulty} collegiate debate intensity and keep natural pacing.`,
    'Do not add extra content beyond the provided turn.'
  ].join(' ');

  try {
    const response = await createSpeechAudio({
      model: DEFAULT_TTS_MODEL,
      voice,
      input: content,
      instructions,
      responseFormat: 'mp3'
    });

    return {
      audio: {
        mimeType: response.mimeType,
        dataUrl: `data:${response.mimeType};base64,${response.buffer.toString('base64')}`
      },
      provider: 'openai',
      model: response.model,
      voice: response.voice,
      fallbackUsed: false,
      error: ''
    };
  } catch (error) {
    return {
      audio: null,
      provider: 'openai',
      model: DEFAULT_TTS_MODEL,
      voice,
      fallbackUsed: true,
      error: error.message
    };
  }
}

async function transcribeDebateAudio({
  audioDataUrl,
  language = 'English'
}) {
  if (VOICE_PROVIDER !== 'openai') {
    throw new Error('Server transcription is disabled in free mode. Use browser voice input instead.');
  }

  if (!isConfigured()) {
    throw new Error('Speech transcription requires OPENAI_API_KEY');
  }

  const { buffer, mimeType } = parseAudioDataUrl(audioDataUrl);
  const extension = mimeType.split('/')[1] || 'webm';
  const response = await transcribeAudio({
    buffer,
    filename: `debate-input.${extension}`,
    mimeType,
    model: DEFAULT_TRANSCRIBE_MODEL,
    language,
    prompt: `This is a concise collegiate debate response in ${language}. Preserve punctuation when obvious.`,
    responseFormat: 'json'
  });

  return {
    transcript: cleanText(response.text),
    provider: 'openai',
    model: response.model
  };
}

module.exports = {
  synthesizeOpponentSpeech,
  transcribeDebateAudio
};
