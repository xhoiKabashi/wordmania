#!/usr/bin/env node
'use strict';

/**
 * Dictionary verifier for FJALËMANIA LIVE.
 *
 * Run with: npm run check:words
 *
 * Checks every round:
 *  - the golden pool has at least 2 candidates, all in words[] and formable
 *  - every main/bonus word can be formed from the round's 9 letters
 *  - no normalized duplicates (Ë/E and Ç/C are the same guess in-game)
 *  - for every possible golden, at least 6 unique non-golden words <= 6 letters
 *  - no words shorter than 3 letters
 */

const path = require('path');
require(path.join(__dirname, '..', 'public', 'words-al.js'));

const DATA = globalThis.ALBANIAN_DATA;
if (!DATA || !Array.isArray(DATA.ROUNDS)) {
  console.error('Could not load ALBANIAN_DATA.ROUNDS');
  process.exit(1);
}

const normalize = (s) =>
  String(s).toUpperCase().replace(/Ë/g, 'E').replace(/Ç/g, 'C').replace(/[^A-Z]/g, '');

function canForm(word, letters) {
  const pool = {};
  for (const ch of letters) {
    const n = normalize(ch);
    if (n) pool[n] = (pool[n] || 0) + 1;
  }
  for (const ch of normalize(word)) {
    if (!pool[ch]) return false;
    pool[ch] -= 1;
  }
  return true;
}

let problems = 0;
const fail = (msg) => {
  problems += 1;
  console.log(`   ! ${msg}`);
};

function goldensOf(round) {
  if (Array.isArray(round.goldens) && round.goldens.length) return round.goldens;
  return round.golden ? [round.golden] : [];
}

function reportRound(round) {
  const goldens = goldensOf(round);
  const goldenNorms = new Set(goldens.map(normalize));
  const all = [...round.words, ...round.bonus];

  const unformable = all.filter((w) => !canForm(w, round.letters));
  const badGoldens = goldens.filter((w) => !canForm(w, round.letters));
  const duplicates = [];
  const seen = new Map();
  for (const word of all) {
    const n = normalize(word);
    if (seen.has(n)) duplicates.push(`${seen.get(n)} / ${word}`);
    else seen.set(n, word);
  }

  console.log(
    `R${String(round.id).padStart(2)} ${round.category.padEnd(34)} ` +
      `main=${String(round.words.length).padStart(2)} bonus=${String(round.bonus.length).padStart(2)} ` +
      `goldens=${goldens.length}`
  );

  if (goldens.length < 2) fail('needs at least 2 golden candidates for rotation');
  if (new Set(goldens.map(normalize)).size !== goldens.length) fail('duplicate golden candidates');
  for (const g of goldens) {
    if (!round.words.includes(g)) fail(`golden not in words[]: ${g}`);
    const short = new Set(
      round.words
        .filter((w) => normalize(w) !== normalize(g) && Array.from(w).length <= 6)
        .map(normalize)
    );
    if (short.size < 6) fail(`only ${short.size} short words when golden is ${g}`);
  }

  if (badGoldens.length) fail(`goldens not formable: ${badGoldens.join(', ')}`);
  if (unformable.length) fail(`words not formable from letters: ${unformable.join(', ')}`);
  if (duplicates.length) fail(`normalized duplicates: ${[...new Set(duplicates)].join(', ')}`);
  const tooShort = all.filter((w) => Array.from(w).length < 3);
  if (tooShort.length) fail(`words shorter than 3 letters: ${tooShort.join(', ')}`);
}

for (const round of DATA.ROUNDS) reportRound(round);

// Lock the forgiving guess normalization (case, trim, Ë=E, Ç=C).
const normalizeInput = DATA.normalizeAlbanian;
const inputCases = [
  ['bukë', 'BUKE'],
  ['buke', 'BUKE'],
  ['BUKË', 'BUKE'],
  ['  Buke!  ', 'BUKE'],
  ['b u k ë', 'BUKE'],
  ['çaj', 'CAJ'],
  ['caj', 'CAJ'],
  ['ÇAJ', 'CAJ'],
  ['shqipëria', 'SHQIPERIA'],
  ['shqiperia', 'SHQIPERIA'],
  ['Peshq', 'PESHQ'],
  ['buka', 'BUKA'],
  ['   ', '']
];
for (const [input, expected] of inputCases) {
  if (normalizeInput(input) !== expected) {
    fail(`normalize(${JSON.stringify(input)}) should be ${expected}, got ${normalizeInput(input)}`);
  }
}
console.log(`Input: ${inputCases.length} case/trim/Ë-Ç normalization checks`);

const main = DATA.ROUNDS.reduce((n, r) => n + r.words.length, 0);
const bonus = DATA.ROUNDS.reduce((n, r) => n + r.bonus.length, 0);
const goldens = DATA.ROUNDS.reduce((n, r) => n + goldensOf(r).length, 0);

console.log(`\nTOTAL: ${DATA.ROUNDS.length} topics, ${main} main + ${bonus} bonus = ${main + bonus} words, ${goldens} goldens`);
if (problems) {
  console.log(`${problems} problem(s) found`);
  process.exitCode = 1;
} else {
  console.log('ALL WORD CHECKS PASSED');
}
