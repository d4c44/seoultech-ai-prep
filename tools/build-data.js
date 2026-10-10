#!/usr/bin/env node
/**
 * Парсер: текстовая выгрузка (Word) + tools/answers.json -> data.js
 *
 * Структура data.js:
 *   window.SUBJECTS = [ { slug, name, ruName, modules: [ { id, title, questions: [ { n, kz, ru, answers, answer } ] } ] } ]
 *   window.EXAMS    = [ { id, title, subtitle, subjects: [slug,...], perSubject, total, variants } ]
 *
 * Запуск: node tools/build-data.js <путь к текстовой выгрузке>
 */
const fs = require('fs');
const path = require('path');

const src = process.argv[2] || 'module.txt';
const raw = fs.readFileSync(src, 'utf8');
const lines = raw.split(/[\r\n]+/);

const SUBJECTS_META = [
  { match: /Саясаттану/, slug: 'politology', name: 'Саясаттану', ruName: 'Политология' },
  { match: /Мәдениеттану/, slug: 'culturology', name: 'Мәдениеттану', ruName: 'Культурология' },
  { match: /Психология/, slug: 'psychology', name: 'Психология', ruName: 'Психология' },
  { match: /Әлеуметтану/, slug: 'sociology', name: 'Әлеуметтану', ruName: 'Социология' },
];

// Конфиг экзаменов (добавляйте новые сюда)
const EXAMS = [
  {
    id: 'rk-m1',
    title: 'Рубежный контроль',
    subtitle: '1-модуль · 1-семестр (2026)',
    subjects: SUBJECTS_META.map(m => m.slug),
    perSubject: 5,
    total: 20,
    variants: 4,
  },
];

const answersPath = path.join(__dirname, 'answers.json');
const ANSWERS = fs.existsSync(answersPath) ? JSON.parse(fs.readFileSync(answersPath, 'utf8')) : {};

const subjects = [];
let current = null;
let pending = null;

function flush() {
  if (!pending || !current) return;
  const text = pending.text.trim();
  if (text) {
    // <questionN> — количество правильных ответов (N=1..3)
    const tagMatch = text.match(/^<(question\d*)>/);
    let answers = 1;
    let clean = text;
    if (tagMatch) {
      answers = parseInt(tagMatch[1].replace('question', ''), 10) || 1;
      clean = text.replace(/^<question\d*>/, '');
    }
    clean = clean.replace(/\s+/g, ' ').trim();
    let kz = clean, ru;
    const slash = clean.indexOf('/');
    if (slash > 0) {
      kz = clean.slice(0, slash).trim();
      ru = clean.slice(slash + 1).trim();
      if (!ru) ru = undefined;
    }
    if (!kz) kz = ru;
    const n = current.questions.length + 1;
    current.questions.push({ n, kz, ru, answers, answer: ANSWERS[`${current.slug}-${n}`] || null });
  }
  pending = null;
}

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) { flush(); continue; }

  const headerMatch = SUBJECTS_META.find(m => m.match.test(trimmed) && /сұрақтар|Вопросы/.test(trimmed));
  if (headerMatch) {
    flush();
    current = { slug: headerMatch.slug, name: headerMatch.name, ruName: headerMatch.ruName, questions: [] };
    subjects.push(current);
    continue;
  }
  if (!current) continue;

  const isTagged = /^<question\d*>/.test(trimmed);
  const isContinuation = current.slug === 'psychology' && !isTagged && pending !== null;

  if (isContinuation) {
    pending.text += ' ' + trimmed;
  } else {
    flush();
    pending = { text: trimmed };
  }
}
flush();

for (const s of subjects) {
  if (!s.questions.length) throw new Error(`Нет вопросов: ${s.slug}`);
}

// Ручные аннотации «N ответов» (когда количество читается из текста)
const ANNOTATIONS = { culturology: { 13: 2, 15: 2, 21: 3, 22: 3 } };
for (const s of subjects) {
  const ann = ANNOTATIONS[s.slug] || {};
  for (const q of s.questions) if (ann[q.n]) q.answers = ann[q.n];
}

// Финальная структура: предметы -> модули
const finalSubjects = subjects.map(s => ({
  slug: s.slug,
  name: s.name,
  ruName: s.ruName,
  modules: [
    { id: 'm1', title: '1-модуль', questions: s.questions },
  ],
}));

const out =
  `// Сгенерировано: node tools/build-data.js — не редактировать руками\n` +
  `window.SUBJECTS = ${JSON.stringify(finalSubjects, null, 2)};\n` +
  `window.EXAMS = ${JSON.stringify(EXAMS, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'data.js'), out, 'utf8');

for (const s of finalSubjects) {
  const qs = s.modules[0].questions;
  const withAns = qs.filter(q => q.answer).length;
  const multi = qs.filter(q => q.answers > 1).length;
  console.log(`${s.name} (${s.ruName}): ${qs.length} вопросов, ответов: ${withAns}/${qs.length}, многоответных: ${multi}`);
}
console.log(`Итого: ${finalSubjects.reduce((a, s) => a + s.modules[0].questions.length, 0)} вопросов`);
