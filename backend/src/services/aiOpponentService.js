const nlpService = require('./nlpService');
const { createTextResponse, getModel, isConfigured, parseJsonResponse } = require('./openaiService');
const { createChatResponse, getModel: getOllamaModel, isEnabled: isOllamaEnabled } = require('./ollamaService');

const OPPONENT_MODEL = process.env.OPENAI_AI_OPPONENT_MODEL || getModel();
const OPPONENT_PROVIDER = String(process.env.AI_OPPONENT_PROVIDER || process.env.AI_PROVIDER || 'ollama').trim().toLowerCase();
const OPPONENT_OLLAMA_MODEL = process.env.OLLAMA_AI_OPPONENT_MODEL || getOllamaModel();
const PERSONA_PRESETS = {
  analyst: 'calm, evidence-heavy, and methodical',
  challenger: 'assertive, quick to expose weak assumptions, and punchy',
  mentor: 'respectful, explanatory, and focused on teaching through rebuttal'
};

const DIFFICULTY_PRESETS = {
  easy: { sentenceLimit: 3, style: 'use straightforward reasoning and light evidence', temperature: 0.8 },
  medium: { sentenceLimit: 4, style: 'use balanced reasoning with one concrete example or impact', temperature: 0.7 },
  hard: { sentenceLimit: 5, style: 'use layered reasoning, crisp rebuttal, and stronger framing', temperature: 0.6 }
};

const TOPIC_KITS = {
  technology: {
    thesis: [
      'AI tools should be adopted with strong accountability rather than rejected outright.',
      'The better policy is governed innovation, not blanket restriction.',
      'Technology creates the most value when transparency and safety rules evolve alongside it.'
    ],
    evidence: [
      'Productivity gains matter only if institutions can audit bias, privacy risks, and misuse.',
      'A ban would slow beneficial uses in education, medicine, and accessibility without eliminating the risks globally.',
      'The strongest framework combines innovation incentives with clear liability when systems cause harm.'
    ],
    rebuttal: [
      'Fear alone is not a policy standard because every major technology introduces both upside and risk.',
      'If you focus only on danger, you ignore the cost of delaying tools that improve public services and research.',
      'The issue is governance quality, not whether the technology exists at all.'
    ]
  },
  climate: {
    thesis: [
      'Climate policy has to be aggressive enough to cut emissions while still staying politically and economically durable.',
      'The strongest climate strategy is one that changes incentives at scale rather than relying only on symbolism.',
      'Long-term climate credibility depends on policies that survive elections, price shocks, and industry pressure.'
    ],
    evidence: [
      'Clean-energy investment, grid modernization, and carbon pricing each work best when paired with transition support.',
      'A policy that looks bold on paper but collapses politically in two years is weaker than a durable reform.',
      'The costs of inaction compound through extreme weather, health burdens, and infrastructure damage.'
    ],
    rebuttal: [
      'Economic caution is valid, but it cannot become an excuse for indefinite delay.',
      'If your plan ignores implementation, it risks creating backlash that slows climate progress even more.',
      'The realistic question is how to distribute transition costs fairly, not whether the transition should happen.'
    ]
  },
  education: {
    thesis: [
      'Education reform should prioritize teaching quality, accountability, and equitable access at the same time.',
      'The strongest education policy is the one that improves classroom outcomes instead of just changing slogans.',
      'Reform works when incentives, teacher support, and student outcomes are aligned.'
    ],
    evidence: [
      'Curriculum updates fail if schools are under-resourced or teachers are not trained to deliver them well.',
      'Access gaps widen when reform is announced centrally but implementation quality varies across regions.',
      'Good reform measures outcomes, supports teachers, and targets the students most likely to be left behind.'
    ],
    rebuttal: [
      'A principle-driven reform still fails if schools do not have the staff and resources to carry it out.',
      'If your model sounds ideal but ignores classroom constraints, it is not yet persuasive.',
      'The benchmark is measurable student improvement, not just a cleaner policy headline.'
    ]
  },
  economy: {
    thesis: [
      'Economic policy should be judged by incentives, trade-offs, and long-term resilience rather than short-term applause.',
      'The strongest economic plan balances growth, stability, and fairness instead of maximizing only one target.',
      'A persuasive economic policy has to work under real budget and political constraints.'
    ],
    evidence: [
      'Policies that ignore incentives often create hidden costs, shortages, or reduced investment.',
      'Short-term relief can be justified, but it should not undermine long-run productivity and fiscal stability.',
      'Distribution matters because growth without broad gains weakens social and political legitimacy.'
    ],
    rebuttal: [
      'If your argument treats all costs as temporary, it understates the risk of structural side effects.',
      'A popular policy can still be weak if it shifts burdens into the future.',
      'The real test is whether the policy still works when incentives and budget pressure are taken seriously.'
    ]
  },
  ethics: {
    thesis: [
      'Ethical arguments are strongest when principle and consequence reinforce each other.',
      'A moral claim becomes persuasive when it can survive real-world edge cases and not just ideal conditions.',
      'The better ethical position is the one that protects rights while remaining workable in practice.'
    ],
    evidence: [
      'Pure principle can sound elegant but fail once duties conflict or incentives change.',
      'Consequences matter because ethics cannot ignore who bears the costs of a policy or action.',
      'A serious ethical framework should explain both the rule and why society should trust its application.'
    ],
    rebuttal: [
      'If your case relies only on moral language, it still needs a method for resolving competing duties.',
      'A principle is not enough unless you show how it applies under pressure, not just in theory.',
      'The argument improves when you connect the value claim to a credible decision rule.'
    ]
  },
  healthcare: {
    thesis: [
      'Healthcare policy should optimize access, quality, and sustainability together rather than sacrificing one blindly.',
      'The strongest healthcare system is the one that expands treatment without creating unmanageable inefficiency.',
      'Healthcare reform succeeds when patient outcomes and delivery incentives move in the same direction.'
    ],
    evidence: [
      'Coverage alone is insufficient if wait times, staffing, or affordability still block real access.',
      'Payment design matters because bad incentives can increase cost without improving outcomes.',
      'Preventive care and primary care access often reduce downstream strain on the whole system.'
    ],
    rebuttal: [
      'If your plan talks about fairness without delivery capacity, it is missing the implementation core.',
      'Cost control matters, but it should be evaluated against actual patient outcomes rather than headline savings alone.',
      'The persuasive case is the one that improves both access and system performance.'
    ]
  },
  general: {
    thesis: [
      'The stronger side is the one that combines principle, implementation, and likely consequences.',
      'A persuasive debate case has to survive practical scrutiny, not just sound confident.',
      'The better argument is the one that explains both why the idea is attractive and where it could fail.'
    ],
    evidence: [
      'Good claims need examples, causal logic, and an explanation of trade-offs.',
      'A position becomes credible when it addresses costs, incentives, and second-order effects.',
      'The clearest arguments show how the proposal works in practice, not just in theory.'
    ],
    rebuttal: [
      'Your framing still needs a stronger implementation story.',
      'Confidence is not enough unless the reasoning survives real-world constraints.',
      'The missing piece is how the claim holds up once trade-offs are examined.'
    ]
  }
};

function cleanText(value, fallback = '') {
  return String(value || fallback || '').trim();
}

function recentTranscript(session, take = 8) {
  return (session.transcript || [])
    .slice(-take)
    .map((message) => ({
      round: message.round || 1,
      side: message.side || (message.isAI ? 'B' : 'A'),
      alias: message.alias || '',
      content: cleanText(message.content)
    }))
    .filter((message) => message.content);
}

function normalizeTopicKey(topic = '') {
  const value = cleanText(topic).toLowerCase();
  if (value.includes('technology') || value.includes('ai')) return 'technology';
  if (value.includes('climate')) return 'climate';
  if (value.includes('education')) return 'education';
  if (value.includes('economic')) return 'economy';
  if (value.includes('ethics') || value.includes('philosophy')) return 'ethics';
  if (value.includes('health')) return 'healthcare';
  return 'general';
}

function sentenceLimitForDifficulty(difficulty) {
  return (DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium).sentenceLimit;
}

function aiMessageCount(session) {
  return (session.transcript || []).filter((message) => message.isAI).length;
}

function transcriptHash(session) {
  return (session.transcript || [])
    .map((message) => cleanText(message.content))
    .join('|')
    .length;
}

function pickVariant(list = [], seed = 0) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list[Math.abs(seed) % list.length];
}

function extractLatestHumanMessage(session) {
  return [...(session.transcript || [])]
    .reverse()
    .find((message) => !message.isAI && cleanText(message.content));
}

function isTopicClarifier(text) {
  return /what('?s| is) the topic|which topic|what are we debating/i.test(text);
}

function isThinPrompt(text) {
  const normalized = cleanText(text).toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount <= 4 || /^(why|why not|ok|okay|what|and|so)\??$/.test(normalized);
}

function compressToSentences(parts, limit) {
  return parts
    .filter(Boolean)
    .slice(0, limit)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModelTurn(text = '') {
  const raw = cleanText(text)
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!raw) return '';

  try {
    const parsed = parseJsonResponse(raw);
    const parsedMessage = cleanText(parsed?.message);
    if (parsedMessage) return parsedMessage;
  } catch {
    // Plain-text turns are acceptable; JSON is optional here.
  }

  return raw
    .replace(/^message\s*:\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function fallbackTurn({ session, difficulty = 'medium', persona = 'analyst' }) {
  const latestHumanMessage = extractLatestHumanMessage(session);
  const latestText = cleanText(latestHumanMessage?.content);
  const debateTopic = cleanText(session.aiOpponent?.motion || session.topic, session.topic);
  const topicKey = normalizeTopicKey(session.aiOpponent?.category || session.topic);
  const topicKit = TOPIC_KITS[topicKey] || TOPIC_KITS.general;
  const seed = aiMessageCount(session) + session.currentRound + transcriptHash(session);
  const sentenceLimit = sentenceLimitForDifficulty(difficulty);

  const openerByPersona = {
    analyst: 'I disagree with your framing because it skips the practical test.',
    challenger: 'That sounds neat, but it does not survive pressure.',
    mentor: 'Let me push back carefully, because there is a stronger way to frame this.'
  };

  if (isTopicClarifier(latestText)) {
    return compressToSentences([
      `The motion is: ${debateTopic}.`,
      `My position is that ${pickVariant(topicKit.thesis, seed).toLowerCase()}`,
      pickVariant(topicKit.evidence, seed + 1)
    ], Math.max(2, sentenceLimit));
  }

  if (!latestText) {
    return compressToSentences([
      pickVariant(topicKit.thesis, seed),
      pickVariant(topicKit.evidence, seed + 1),
      persona === 'challenger'
        ? 'If you want to win this debate, you need a case that handles trade-offs directly.'
        : persona === 'mentor'
          ? 'A persuasive reply should explain why the alternative fails in practice.'
          : 'The persuasive standard here is implementation plus impact, not just intent.'
    ], sentenceLimit);
  }

  const rebuttalLead = isThinPrompt(latestText)
    ? pickVariant(topicKit.rebuttal, seed + 2)
    : `${openerByPersona[persona] || openerByPersona.analyst} You said "${latestText.slice(0, 90)}," but that misses the core issue.`;

  const difficultyClose = {
    easy: 'A realistic argument has to explain the trade-off clearly.',
    medium: 'A stronger case ties its principle to real implementation and likely impact.',
    hard: 'The winning case is the one that still works after incentives, second-order effects, and execution risks are tested.'
  }[difficulty] || 'A stronger case ties its principle to real implementation and likely impact.';

  return compressToSentences([
    rebuttalLead,
    pickVariant(topicKit.thesis, seed + 3),
    pickVariant(topicKit.evidence, seed + 4),
    difficultyClose
  ], sentenceLimit);
}

async function requestOpponentTurn({ session, difficulty, persona, latestHumanMessage }) {
  const difficultyConfig = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;
  const personaDescription = PERSONA_PRESETS[persona] || PERSONA_PRESETS.analyst;
  const instructions = [
    'You are the AI opponent in DIALECT, a structured collegiate debate platform.',
    `Debate style: ${personaDescription}.`,
    `Difficulty guidance: ${difficultyConfig.style}.`,
    `Respond in ${session.language || 'English'} and keep the turn within ${difficultyConfig.sentenceLimit} sentences.`,
    'Stay on topic, rebut the latest human point directly, and make one clear claim.',
    'Sound like a real debater, not a template. Avoid repeating stock phrases across turns.',
    'Reply with the debate turn only. Do not use JSON, markdown, bullet points, or speaker labels.'
  ].join(' ');

  const debateState = JSON.stringify({
    topic: session.topic,
    motion: session.aiOpponent?.motion || session.topic,
    category: session.aiOpponent?.category || session.topic,
    language: session.language,
    currentRound: session.currentRound,
    maxRounds: session.maxRounds,
    latestHumanMessage: cleanText(latestHumanMessage?.content),
    transcript: recentTranscript(session, 8)
  }, null, 2);

  let response;
  if (OPPONENT_PROVIDER === 'openai') {
    response = await createTextResponse({
      model: OPPONENT_MODEL,
      instructions,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: debateState
            }
          ]
        }
      ],
      maxOutputTokens: 500,
      temperature: difficultyConfig.temperature
    });
  } else if (isOllamaEnabled()) {
    response = await createChatResponse({
      model: OPPONENT_OLLAMA_MODEL,
      system: instructions,
      messages: [
        {
          role: 'user',
          content: debateState
        }
      ],
      temperature: difficultyConfig.temperature
    });
  } else {
    throw new Error('No free AI provider is enabled');
  }

  const message = normalizeModelTurn(response.text);
  if (!message) {
    throw new Error('AI opponent returned an empty turn');
  }

  const { filtered } = nlpService.filterProfanity(message);
  return {
    message: cleanText(filtered),
    provider: OPPONENT_PROVIDER === 'openai' ? 'openai' : 'ollama',
    model: response.model
  };
}

async function generateOpponentTurn({ session, difficulty = 'medium', persona = 'analyst' }) {
  const latestHumanMessage = [...(session.transcript || [])]
    .reverse()
    .find((message) => !message.isAI && cleanText(message.content));

  if (OPPONENT_PROVIDER === 'openai' && !isConfigured()) {
    return {
      message: fallbackTurn({ session, difficulty, persona }),
      provider: 'local-fallback',
      model: ''
    };
  }

  try {
    return await requestOpponentTurn({ session, difficulty, persona, latestHumanMessage });
  } catch (error) {
    console.warn(`[AI Opponent] Falling back to local template: ${error.message}`);
    return {
      message: fallbackTurn({ session, difficulty, persona }),
      provider: 'local-fallback',
      model: '',
      error: error.message
    };
  }
}

module.exports = {
  generateOpponentTurn
};
