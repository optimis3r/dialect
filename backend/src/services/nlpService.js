const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const WEAK_WORDS = new Set([
  'good','bad','nice','big','small','very','really','just','many','few',
  'a lot','thing','stuff','get','got','make','do','use','used','said','say',
  'like','okay','ok','fine','great','cool','awesome','terrible','horrible'
]);

const STRONG_ALTERNATIVES = {
  good: ['exemplary','commendable','meritorious','proficient'],
  bad: ['detrimental','deleterious','pernicious','adverse'],
  nice: ['laudable','admirable','praiseworthy','commendable'],
  big: ['substantial','considerable','extensive','monumental'],
  small: ['minuscule','negligible','diminutive','marginal'],
  very: ['exceedingly','remarkably','substantially','considerably'],
  really: ['genuinely','evidently','demonstrably','verifiably'],
  just: ['merely','solely','exclusively','simply'],
  many: ['numerous','multitudinous','abundant','plentiful'],
  few: ['scant','sparse','limited','minimal'],
  thing: ['element','aspect','component','factor'],
  stuff: ['material','substance','content','matter'],
  get: ['obtain','acquire','achieve','attain'],
  make: ['construct','formulate','generate','produce'],
  like: ['similar to','akin to','analogous to','comparable to'],
  great: ['outstanding','exceptional','distinguished','remarkable'],
  cool: ['innovative','sophisticated','compelling','noteworthy'],
  awesome: ['extraordinary','remarkable','impressive','astounding'],
  terrible: ['deplorable','abysmal','egregious','catastrophic'],
  horrible: ['atrocious','appalling','dreadful','execrable'],
  okay: ['acceptable','adequate','sufficient','satisfactory'],
  fine: ['adequate','satisfactory','acceptable','reasonable']
};

const WORD_INSIGHTS = {
  good: { definition: 'A broad positive adjective that often feels vague in formal debate.', example: 'That policy yields measurable public-health gains.' },
  bad: { definition: 'A broad negative adjective that benefits from concrete impact language.', example: 'That proposal creates harmful long-term incentives.' },
  nice: { definition: 'An informal adjective better replaced with evidence-based praise.', example: 'The proposal is beneficial for rural access.' },
  big: { definition: 'A size adjective that can be made more precise.', example: 'The reform would have a substantial fiscal impact.' },
  small: { definition: 'A size adjective that can be made more precise.', example: 'The effect is marginal compared with the cost.' },
  thing: { definition: 'A placeholder noun that weakens clarity.', example: 'The central factor is implementation capacity.' },
  stuff: { definition: 'An informal placeholder noun.', example: 'The relevant evidence concerns labor-market outcomes.' },
  get: { definition: 'A generic verb that often hides causality.', example: 'Citizens obtain faster access to care.' },
  make: { definition: 'A generic verb that can be replaced with a more specific action.', example: 'This policy generates higher compliance.' }
};

const STOP_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'will', 'their',
  'they', 'there', 'would', 'about', 'which', 'should', 'could', 'because',
  'while', 'where', 'when', 'been', 'being', 'into', 'than', 'then', 'also',
  'them', 'your', 'just', 'very', 'really', 'many', 'some', 'more', 'most',
  'such', 'much', 'only', 'over', 'under', 'between', 'after', 'before'
]);

function tokenize(text = '') {
  return text.toLowerCase().match(/\b[a-z][a-z']{2,}\b/g) || [];
}

function splitSentences(text = '') {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function calculateLexicalDiversity(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;
  const unique = new Set(tokens);
  const ttr = unique.size / tokens.length;
  return Math.round(Math.min(ttr * 150, 100));
}

function findWeakWords(text) {
  const tokens = tokenize(text);
  const counts = new Map();
  tokens.forEach(t => {
    if (WEAK_WORDS.has(t)) counts.set(t, (counts.get(t) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function getSuggestions(weakWords) {
  return weakWords.map(w => {
    const alts = STRONG_ALTERNATIVES[w];
    if (alts) return `Instead of "${w}", try: ${alts.slice(0, 2).join(', ')}`;
    return `Consider a stronger alternative for "${w}"`;
  });
}

function analyzeSentiment(text) {
  const result = sentiment.analyze(text);
  if (result.score > 3) return 'positive';
  if (result.score < -3) return 'negative';
  if (result.score > 0) return 'slightly positive';
  if (result.score < 0) return 'slightly negative';
  return 'neutral';
}

function getWordCloud(text) {
  const counts = new Map();
  tokenize(text).forEach(token => {
    if (!STOP_WORDS.has(token)) counts.set(token, (counts.get(token) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

function getWordInsights(weakWords) {
  return weakWords.map(word => ({
    word,
    replacements: STRONG_ALTERNATIVES[word] || ['Use a more specific term'],
    definition: WORD_INSIGHTS[word]?.definition || 'A broad word that could be made more precise in formal argument.',
    example: WORD_INSIGHTS[word]?.example || `Try replacing "${word}" with a more specific claim grounded in evidence.`
  }));
}

function getStrengths({ lexicalDiversity, sentimentLabel, topTerms, evidenceMarkers }) {
  const strengths = [];
  if (lexicalDiversity >= 65) strengths.push('Your vocabulary showed strong variety across the debate.');
  if (sentimentLabel === 'positive' || sentimentLabel === 'slightly positive') strengths.push('Your tone stayed constructive and persuasive.');
  if (evidenceMarkers >= 2) strengths.push('You used evidence-style language that helped your argument feel grounded.');
  if (topTerms.length > 0) strengths.push(`Your strongest repeated themes were ${topTerms.slice(0, 3).map(item => item.word).join(', ')}.`);
  return strengths.slice(0, 3);
}

function getImprovementTips({ weakWords, lexicalDiversity, sentenceCount, totalWords, speakingShare, mode }) {
  const tips = [];
  if (weakWords.length > 0) {
    tips.push(`Replace filler words like ${weakWords.slice(0, 3).join(', ')} with sharper, evidence-led alternatives.`);
  }
  if (lexicalDiversity < 50) {
    tips.push('Introduce more varied nouns and verbs to make your claims sound less repetitive.');
  }
  if (sentenceCount > 0 && totalWords / sentenceCount > 26) {
    tips.push('Break long claims into shorter sentences so each argument lands more clearly.');
  }
  if ((mode === 'voice' || mode === 'video') && speakingShare < 40) {
    tips.push('Take the floor more decisively in spoken rounds so your strongest arguments are fully developed.');
  }
  if (tips.length === 0) {
    tips.push('Keep reinforcing your claims with specific examples and rebuttals to maintain this level.');
  }
  return tips.slice(0, 3);
}

function generateSummary(text, weakWords, lexScore, topTerms) {
  const wordCount = tokenize(text).length;
  const grade = lexScore >= 70 ? 'strong' : lexScore >= 45 ? 'moderate' : 'developing';
  const weakNote = weakWords.length > 0
    ? ` Watch out for overused words: ${weakWords.slice(0, 3).join(', ')}.`
    : ' Excellent vocabulary variety!';
  const themeNote = topTerms.length > 0 ? ` Key themes: ${topTerms.slice(0, 3).map(item => item.word).join(', ')}.` : '';
  return `You used ${wordCount} words with a ${grade} lexical diversity score of ${lexScore}/100.${weakNote}${themeNote}`;
}

function calculateSpeakingShare(secondsA, secondsB, wordsA, wordsB) {
  const fallbackTotal = wordsA + wordsB;
  if (secondsA + secondsB > 0) {
    const total = secondsA + secondsB;
    return {
      speakingShareA: Math.round((secondsA / total) * 100),
      speakingShareB: Math.round((secondsB / total) * 100)
    };
  }
  if (fallbackTotal > 0) {
    return {
      speakingShareA: Math.round((wordsA / fallbackTotal) * 100),
      speakingShareB: Math.round((wordsB / fallbackTotal) * 100)
    };
  }
  return { speakingShareA: 50, speakingShareB: 50 };
}

function countEvidenceMarkers(text) {
  const markers = ['because', 'evidence', 'data', 'study', 'research', 'therefore', 'for example', 'for instance', 'according'];
  const lower = text.toLowerCase();
  return markers.reduce((count, marker) => count + (lower.includes(marker) ? 1 : 0), 0);
}

exports.analyzeDebate = async function (transcriptA, transcriptB, context = {}) {
  const textA = transcriptA.map(m => m.content).join(' ');
  const textB = transcriptB.map(m => m.content).join(' ');
  const wordsA = tokenize(textA).length;
  const wordsB = tokenize(textB).length;
  const sentencesA = splitSentences(textA);
  const sentencesB = splitSentences(textB);

  const lexA = calculateLexicalDiversity(textA);
  const lexB = calculateLexicalDiversity(textB);
  const weakA = findWeakWords(textA);
  const weakB = findWeakWords(textB);
  const sentA = analyzeSentiment(textA);
  const sentB = analyzeSentiment(textB);
  const sugA = getSuggestions(weakA);
  const sugB = getSuggestions(weakB);
  const wordCloudA = getWordCloud(textA);
  const wordCloudB = getWordCloud(textB);
  const wordInsightsA = getWordInsights(weakA);
  const wordInsightsB = getWordInsights(weakB);
  const evidenceMarkersA = countEvidenceMarkers(textA);
  const evidenceMarkersB = countEvidenceMarkers(textB);
  const { speakingShareA, speakingShareB } = calculateSpeakingShare(
    context.speakingTimeA || 0,
    context.speakingTimeB || 0,
    wordsA,
    wordsB
  );

  const vocabScoreA = Math.round((lexA * 0.7) + ((10 - weakA.length) * 3));
  const vocabScoreB = Math.round((lexB * 0.7) + ((10 - weakB.length) * 3));

  let winner = 'draw';
  if (vocabScoreA > vocabScoreB + 5) winner = 'A';
  else if (vocabScoreB > vocabScoreA + 5) winner = 'B';

  const strengthsA = getStrengths({ lexicalDiversity: lexA, sentimentLabel: sentA, topTerms: wordCloudA, evidenceMarkers: evidenceMarkersA });
  const strengthsB = getStrengths({ lexicalDiversity: lexB, sentimentLabel: sentB, topTerms: wordCloudB, evidenceMarkers: evidenceMarkersB });
  const improvementTipsA = getImprovementTips({
    weakWords: weakA,
    lexicalDiversity: lexA,
    sentenceCount: sentencesA.length,
    totalWords: wordsA,
    speakingShare: speakingShareA,
    mode: context.mode
  });
  const improvementTipsB = getImprovementTips({
    weakWords: weakB,
    lexicalDiversity: lexB,
    sentenceCount: sentencesB.length,
    totalWords: wordsB,
    speakingShare: speakingShareB,
    mode: context.mode
  });

  const verdictReason = winner === 'draw'
    ? 'Both debaters performed within a narrow vocabulary range, so the result was recorded as a draw.'
    : winner === 'A'
      ? `Debater A gained the edge through a stronger vocabulary score (${vocabScoreA} vs ${vocabScoreB}) and clearer language variety.`
      : `Debater B gained the edge through a stronger vocabulary score (${vocabScoreB} vs ${vocabScoreA}) and clearer language variety.`;

  return {
    generatedAt: new Date(),
    provider: 'local-nlp',
    topic: context.topic || '',
    language: context.language || 'English',
    lexicalDiversityA: lexA,
    lexicalDiversityB: lexB,
    sentimentA: sentA,
    sentimentB: sentB,
    vocabScoreA,
    vocabScoreB,
    totalWordsA: wordsA,
    totalWordsB: wordsB,
    weakWordsA: weakA,
    weakWordsB: weakB,
    suggestionsA: sugA,
    suggestionsB: sugB,
    wordCloudA,
    wordCloudB,
    wordInsightsA,
    wordInsightsB,
    strengthsA,
    strengthsB,
    improvementTipsA,
    improvementTipsB,
    summaryA: generateSummary(textA, weakA, lexA, wordCloudA),
    summaryB: generateSummary(textB, weakB, lexB, wordCloudB),
    speakingTimeA: context.speakingTimeA || 0,
    speakingTimeB: context.speakingTimeB || 0,
    speakingShareA,
    speakingShareB,
    debateHighlights: [
      `Debater A leaned on ${wordCloudA[0]?.word || 'focused'} themes throughout the exchange.`,
      `Debater B leaned on ${wordCloudB[0]?.word || 'focused'} themes throughout the exchange.`,
      verdictReason
    ],
    verdictReason,
    winner
  };
};

exports.filterProfanity = function (text) {
  const profanityList = ['fuck','shit','damn','crap','ass','bitch','bastard','idiot','stupid','moron'];
  let filtered = text;
  profanityList.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  const wasFiltered = filtered !== text;
  return { filtered, wasFiltered };
};

exports.calculateEloChange = function (winnerRating, loserRating) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const winnerChange = Math.round(K * (1 - expected));
  const loserChange = Math.round(K * (0 - expected));
  return { winnerChange, loserChange };
};
