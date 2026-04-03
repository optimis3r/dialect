const nlpService = require('./nlpService');
const { createTextResponse, getModel, isConfigured, parseJsonResponse } = require('./openaiService');
const REPORT_PROVIDER = String(process.env.AI_REPORT_PROVIDER || process.env.AI_PROVIDER || 'local-nlp').trim().toLowerCase();

const REPORT_MODEL = process.env.OPENAI_REPORT_MODEL || getModel();

function clampScore(value, fallback = 50) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }
  return fallback;
}

function cleanText(value, fallback = '') {
  const text = String(value || fallback || '').trim();
  return text;
}

function cleanList(value, fallback = [], maxItems = 4) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function serializeTranscript(transcriptA, transcriptB) {
  return [...transcriptA, ...transcriptB]
    .sort((left, right) => new Date(left.timestamp || 0) - new Date(right.timestamp || 0))
    .map((message) => ({
      round: message.round || 1,
      side: message.side || (message.isAI ? 'B' : 'A'),
      alias: message.alias || '',
      isAI: Boolean(message.isAI),
      content: cleanText(message.content)
    }))
    .filter((message) => message.content);
}

function buildFallback(localReport, errorMessage = '') {
  return {
    report: {
      ...localReport,
      provider: 'local-nlp',
      model: '',
      fallbackUsed: true,
      fallbackReason: cleanText(errorMessage) || 'External AI report generation unavailable',
      reportVersion: '2.0',
      overallSummary: localReport.verdictReason,
      argumentQualityA: Math.max(35, Math.min(95, localReport.vocabScoreA)),
      argumentQualityB: Math.max(35, Math.min(95, localReport.vocabScoreB)),
      rebuttalQualityA: Math.max(30, Math.min(95, localReport.vocabScoreA - 4)),
      rebuttalQualityB: Math.max(30, Math.min(95, localReport.vocabScoreB - 4)),
      clarityA: Math.max(35, Math.min(95, localReport.lexicalDiversityA + 8)),
      clarityB: Math.max(35, Math.min(95, localReport.lexicalDiversityB + 8)),
      persuasivenessA: Math.max(35, Math.min(95, localReport.vocabScoreA - 2)),
      persuasivenessB: Math.max(35, Math.min(95, localReport.vocabScoreB - 2)),
      evidenceUseA: Math.max(25, Math.min(90, localReport.vocabScoreA - 8)),
      evidenceUseB: Math.max(25, Math.min(90, localReport.vocabScoreB - 8)),
      weakPointsA: cleanList(localReport.weakWordsA.map((word) => `Replace overused wording such as "${word}" with more precise evidence-led phrasing.`)),
      weakPointsB: cleanList(localReport.weakWordsB.map((word) => `Replace overused wording such as "${word}" with more precise evidence-led phrasing.`)),
      actionPlanA: cleanList(localReport.improvementTipsA),
      actionPlanB: cleanList(localReport.improvementTipsB),
      coachingA: cleanList(localReport.improvementTipsA).join(' '),
      coachingB: cleanList(localReport.improvementTipsB).join(' '),
      argumentFeedbackA: localReport.summaryA,
      argumentFeedbackB: localReport.summaryB,
      rebuttalFeedbackA: 'The free local report detected the main themes and rebuttals without using a paid model.',
      rebuttalFeedbackB: 'The free local report detected the main themes and rebuttals without using a paid model.',
      clarityFeedbackA: localReport.summaryA,
      clarityFeedbackB: localReport.summaryB,
      persuasivenessFeedbackA: localReport.verdictReason,
      persuasivenessFeedbackB: localReport.verdictReason,
      compositeScoreA: localReport.vocabScoreA,
      compositeScoreB: localReport.vocabScoreB
    },
    usedFallback: true,
    error: cleanText(errorMessage)
  };
}

function decideWinner(scoreA, scoreB, fallbackWinner = 'draw') {
  if (scoreA >= scoreB + 3) return 'A';
  if (scoreB >= scoreA + 3) return 'B';
  return fallbackWinner === 'A' || fallbackWinner === 'B' ? 'draw' : fallbackWinner;
}

function mergeReport(localReport, llmReport, meta = {}) {
  const sideA = llmReport?.sideA || {};
  const sideB = llmReport?.sideB || {};

  const argumentQualityA = clampScore(sideA.argumentQuality, localReport.vocabScoreA);
  const argumentQualityB = clampScore(sideB.argumentQuality, localReport.vocabScoreB);
  const rebuttalQualityA = clampScore(sideA.rebuttalQuality, argumentQualityA - 4);
  const rebuttalQualityB = clampScore(sideB.rebuttalQuality, argumentQualityB - 4);
  const clarityA = clampScore(sideA.clarity, localReport.lexicalDiversityA + 6);
  const clarityB = clampScore(sideB.clarity, localReport.lexicalDiversityB + 6);
  const persuasivenessA = clampScore(sideA.persuasiveness, argumentQualityA - 2);
  const persuasivenessB = clampScore(sideB.persuasiveness, argumentQualityB - 2);
  const evidenceUseA = clampScore(sideA.evidenceUse, argumentQualityA - 6);
  const evidenceUseB = clampScore(sideB.evidenceUse, argumentQualityB - 6);

  const compositeScoreA = clampScore(
    (localReport.vocabScoreA * 0.2) +
    (argumentQualityA * 0.25) +
    (rebuttalQualityA * 0.2) +
    (clarityA * 0.2) +
    (persuasivenessA * 0.15),
    localReport.vocabScoreA
  );
  const compositeScoreB = clampScore(
    (localReport.vocabScoreB * 0.2) +
    (argumentQualityB * 0.25) +
    (rebuttalQualityB * 0.2) +
    (clarityB * 0.2) +
    (persuasivenessB * 0.15),
    localReport.vocabScoreB
  );

  const winner = ['A', 'B', 'draw'].includes(llmReport?.winner)
    ? llmReport.winner
    : decideWinner(compositeScoreA, compositeScoreB, localReport.winner);

  return {
    ...localReport,
    provider: 'openai',
    model: meta.model || REPORT_MODEL,
    fallbackUsed: false,
    fallbackReason: '',
    reportVersion: '2.0',
    overallSummary: cleanText(llmReport?.overallSummary, localReport.verdictReason),
    debateHighlights: cleanList(llmReport?.debateHighlights, localReport.debateHighlights, 5),
    verdictReason: cleanText(llmReport?.verdictReason, localReport.verdictReason),
    summaryA: cleanText(sideA.summary, localReport.summaryA),
    summaryB: cleanText(sideB.summary, localReport.summaryB),
    strengthsA: cleanList(sideA.strengths, localReport.strengthsA),
    strengthsB: cleanList(sideB.strengths, localReport.strengthsB),
    improvementTipsA: cleanList(sideA.improvementTips, localReport.improvementTipsA),
    improvementTipsB: cleanList(sideB.improvementTips, localReport.improvementTipsB),
    weakPointsA: cleanList(sideA.weakPoints, localReport.weakWordsA.map((word) => `Tighten up vague wording such as "${word}".`)),
    weakPointsB: cleanList(sideB.weakPoints, localReport.weakWordsB.map((word) => `Tighten up vague wording such as "${word}".`)),
    actionPlanA: cleanList(sideA.actionPlan, localReport.improvementTipsA),
    actionPlanB: cleanList(sideB.actionPlan, localReport.improvementTipsB),
    coachingA: cleanText(sideA.coaching, cleanList(sideA.actionPlan, localReport.improvementTipsA).join(' ')),
    coachingB: cleanText(sideB.coaching, cleanList(sideB.actionPlan, localReport.improvementTipsB).join(' ')),
    argumentFeedbackA: cleanText(sideA.argumentFeedback, localReport.summaryA),
    argumentFeedbackB: cleanText(sideB.argumentFeedback, localReport.summaryB),
    rebuttalFeedbackA: cleanText(sideA.rebuttalFeedback, localReport.verdictReason),
    rebuttalFeedbackB: cleanText(sideB.rebuttalFeedback, localReport.verdictReason),
    clarityFeedbackA: cleanText(sideA.clarityFeedback, localReport.summaryA),
    clarityFeedbackB: cleanText(sideB.clarityFeedback, localReport.summaryB),
    persuasivenessFeedbackA: cleanText(sideA.persuasivenessFeedback, localReport.verdictReason),
    persuasivenessFeedbackB: cleanText(sideB.persuasivenessFeedback, localReport.verdictReason),
    argumentQualityA,
    argumentQualityB,
    rebuttalQualityA,
    rebuttalQualityB,
    clarityA,
    clarityB,
    persuasivenessA,
    persuasivenessB,
    evidenceUseA,
    evidenceUseB,
    compositeScoreA,
    compositeScoreB,
    winner
  };
}

async function requestOpenAIReport(serializedTranscript, localReport, context) {
  const instructions = [
    'You are DIALECT, an expert collegiate debate coach.',
    'Analyze both debaters fairly and return valid JSON only.',
    'Scores must be integers from 0 to 100.',
    'Use specific, actionable coaching and avoid generic praise.',
    'Keep each list concise, with no more than four items.'
  ].join(' ');

  const input = [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: JSON.stringify({
            task: 'Analyze a completed debate and produce a structured coaching report.',
            outputShape: {
              overallSummary: 'string',
              debateHighlights: ['string'],
              verdictReason: 'string',
              winner: 'A | B | draw',
              sideA: {
                summary: 'string',
                strengths: ['string'],
                improvementTips: ['string'],
                weakPoints: ['string'],
                actionPlan: ['string'],
                coaching: 'string',
                argumentFeedback: 'string',
                rebuttalFeedback: 'string',
                clarityFeedback: 'string',
                persuasivenessFeedback: 'string',
                argumentQuality: '0-100 integer',
                rebuttalQuality: '0-100 integer',
                clarity: '0-100 integer',
                persuasiveness: '0-100 integer',
                evidenceUse: '0-100 integer'
              },
              sideB: {
                summary: 'string',
                strengths: ['string'],
                improvementTips: ['string'],
                weakPoints: ['string'],
                actionPlan: ['string'],
                coaching: 'string',
                argumentFeedback: 'string',
                rebuttalFeedback: 'string',
                clarityFeedback: 'string',
                persuasivenessFeedback: 'string',
                argumentQuality: '0-100 integer',
                rebuttalQuality: '0-100 integer',
                clarity: '0-100 integer',
                persuasiveness: '0-100 integer',
                evidenceUse: '0-100 integer'
              }
            },
            context,
            localBaseline: {
              lexicalDiversityA: localReport.lexicalDiversityA,
              lexicalDiversityB: localReport.lexicalDiversityB,
              vocabScoreA: localReport.vocabScoreA,
              vocabScoreB: localReport.vocabScoreB,
              weakWordsA: localReport.weakWordsA,
              weakWordsB: localReport.weakWordsB,
              speakingShareA: localReport.speakingShareA,
              speakingShareB: localReport.speakingShareB,
              winner: localReport.winner,
              verdictReason: localReport.verdictReason
            },
            transcript: serializedTranscript
          }, null, 2)
        }
      ]
    }
  ];

  const response = await createTextResponse({
    model: REPORT_MODEL,
    instructions,
    input,
    maxOutputTokens: 2200,
    temperature: 0.4
  });

  return {
    parsed: parseJsonResponse(response.text),
    model: response.model
  };
}

async function generateDebateReport(transcriptA, transcriptB, context = {}) {
  const localReport = await nlpService.analyzeDebate(transcriptA, transcriptB, context);
  const serializedTranscript = serializeTranscript(transcriptA, transcriptB);

  if (REPORT_PROVIDER !== 'openai') {
    return buildFallback(localReport, 'Using the free local NLP report generator');
  }

  if (!isConfigured()) {
    return buildFallback(localReport, 'OPENAI_API_KEY is not configured');
  }

  try {
    const { parsed, model } = await requestOpenAIReport(serializedTranscript, localReport, {
      topic: context.topic || '',
      language: context.language || 'English',
      mode: context.mode || 'text',
      matchType: context.matchType || 'human-vs-human',
      isRated: context.isRated !== false,
      speakingTimeA: context.speakingTimeA || 0,
      speakingTimeB: context.speakingTimeB || 0,
      aliasA: context.aliasA || 'Debater A',
      aliasB: context.aliasB || 'Debater B'
    });

    return {
      report: mergeReport(localReport, parsed, { model }),
      usedFallback: false,
      error: ''
    };
  } catch (error) {
    return buildFallback(localReport, error.message);
  }
}

module.exports = {
  generateDebateReport
};
