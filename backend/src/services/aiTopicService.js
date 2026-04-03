const MOTION_BANK = {
  'Technology & AI': [
    { motion: 'Should governments impose strict regulation on advanced AI systems before wide public deployment?', stance: 'Regulation should come first.' },
    { motion: 'Do the benefits of AI in education outweigh the risks of over-reliance and bias?', stance: 'The benefits outweigh the risks if schools govern usage well.' },
    { motion: 'Should companies be legally liable for harms caused by autonomous AI decisions?', stance: 'Yes, legal liability is necessary for accountability.' }
  ],
  'Climate Change': [
    { motion: 'Should developing countries prioritize rapid industrial growth over aggressive emissions cuts?', stance: 'No, climate resilience and cleaner growth should be built in now.' },
    { motion: 'Is carbon pricing more effective than direct regulation for climate action?', stance: 'Carbon pricing is more scalable when paired with targeted regulation.' },
    { motion: 'Should nuclear power be a core part of modern climate strategy?', stance: 'Yes, it should remain part of the clean-energy mix.' }
  ],
  'Education Reform': [
    { motion: 'Should standardized testing remain a major factor in school evaluation?', stance: 'It should be reduced and balanced with broader outcome measures.' },
    { motion: 'Would extending the school day significantly improve student outcomes?', stance: 'Not by itself; quality of instruction matters more than time alone.' },
    { motion: 'Should university admissions place less weight on entrance exams?', stance: 'Yes, admissions should assess broader evidence of readiness.' }
  ],
  'Economic Policy': [
    { motion: 'Should governments aggressively cap prices during periods of high inflation?', stance: 'No, broad price caps create distortions and shortages.' },
    { motion: 'Is universal basic income a stronger policy than targeted welfare expansion?', stance: 'Targeted welfare is more efficient than universal basic income in most cases.' },
    { motion: 'Should large corporations face substantially higher taxation to reduce inequality?', stance: 'Yes, but only with a design that protects investment and compliance.' }
  ],
  'Ethics & Philosophy': [
    { motion: 'Is it ethical to limit some free speech in order to reduce harmful misinformation?', stance: 'Yes, limited intervention can be justified when harm is concrete and safeguards exist.' },
    { motion: 'Should individual privacy ever be sacrificed for collective security?', stance: 'Only under narrow, accountable, and proportionate conditions.' },
    { motion: 'Is moral responsibility reduced when people act under strong social pressure?', stance: 'It can be reduced, but not erased.' }
  ],
  Healthcare: [
    { motion: 'Should healthcare be treated as a universal public right funded primarily by the state?', stance: 'Yes, universal access should be guaranteed as a core public obligation.' },
    { motion: 'Do market incentives improve healthcare quality more than centralized public planning?', stance: 'Only partially; healthcare still needs strong public coordination.' },
    { motion: 'Should governments mandate vaccines during major public health emergencies?', stance: 'Yes, mandates can be justified when the public-health risk is severe.' }
  ],
  General: [
    { motion: 'Should governments prioritize long-term stability over short-term public popularity when making policy?', stance: 'Yes, durable policy matters more than short-lived applause.' },
    { motion: 'Is technological progress usually a net benefit for society?', stance: 'Yes, but only when institutions adapt to manage the harms.' },
    { motion: 'Should difficult policy decisions be driven more by expert consensus than public opinion?', stance: 'Expert consensus should guide decisions, while democratic oversight still matters.' }
  ]
};

const TOPIC_ORDER = Object.keys(MOTION_BANK);

function normalizeCategory(topic = '') {
  const value = String(topic || '').trim();
  if (MOTION_BANK[value]) return value;
  return 'General';
}

function createSeed(input = '') {
  return String(input)
    .split('')
    .reduce((total, char, index) => total + (char.charCodeAt(0) * (index + 1)), 0);
}

function pickFromList(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function buildAiDebateTopic({ requestedTopic, userId, difficulty, persona }) {
  const chosenCategory = requestedTopic === 'General'
    ? pickFromList(TOPIC_ORDER, createSeed(`${userId}:${difficulty}:${persona}`))
    : normalizeCategory(requestedTopic);
  const motions = MOTION_BANK[chosenCategory] || MOTION_BANK.General;
  const choice = pickFromList(motions, createSeed(`${userId}:${chosenCategory}:${difficulty}:${persona}`));

  return {
    category: chosenCategory,
    motion: choice.motion,
    stance: choice.stance
  };
}

module.exports = {
  buildAiDebateTopic
};
