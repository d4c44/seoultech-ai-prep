#!/usr/bin/env node
/**
 * Парсер: module.txt (выгруз из Word) -> data.js
 * Запуск: node tools/build-data.js <путь к module.txt>
 */
const fs = require('fs');
const path = require('path');

const src = process.argv[2] || 'module.txt';
const raw = fs.readFileSync(src, 'utf8');
const lines = raw.split(/[\r\n]+/);

const SUBJECTS_META = [
  { match: /Саясаттану/, slug: 'politology', name: 'Саясаттану', ruName: 'Политология', icon: '🏛️' },
  { match: /Мәдениеттану/, slug: 'culturology', name: 'Мәдениеттану', ruName: 'Культурология', icon: '🎭' },
  { match: /Психология/, slug: 'psychology', name: 'Психология', ruName: 'Психология', icon: '🧠' },
  { match: /Әлеуметтану/, slug: 'sociology', name: 'Әлеуметтану', ruName: 'Социология', icon: '🌐' },
];

const subjects = [];
let current = null;
let pending = null; // накопитель текущегo вопроса (продолжения строк)

function flush() {
  if (!pending || !current) return;
  const text = pending.text.trim();
  if (text) {
    // убрать теги <question> <question2> <question3>
    const tagMatch = text.match(/^<(question\d*)>/);
    let block;
    let clean = text;
    if (tagMatch) {
      block = parseInt(tagMatch[1].replace('question', ''), 10) || undefined;
      clean = text.replace(/^<question\d*>/, '');
    }
    clean = clean.replace(/\s+/g, ' ').trim();
    // разделить KZ / RU по первому "/"
    let kz = clean, ru;
    const slash = clean.indexOf('/');
    if (slash > 0) {
      kz = clean.slice(0, slash).trim();
      ru = clean.slice(slash + 1).trim();
      if (!ru) ru = undefined;
    }
    if (!kz) kz = ru; // защита от пустой KZ части
    current.questions.push({ n: current.questions.length + 1, kz, ru, block });
  }
  pending = null;
}

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) { flush(); continue; }

  // Заголовок раздела?
  const headerMatch = SUBJECTS_META.find(m => m.match.test(trimmed) && /сұрақтар|Вопросы/.test(trimmed));
  if (headerMatch) {
    flush();
    current = { slug: headerMatch.slug, name: headerMatch.name, ruName: headerMatch.ruName, icon: headerMatch.icon, questions: [] };
    subjects.push(current);
    continue;
  }
  if (!current) continue;

  const isTagged = /^<question\d*>/.test(trimmed);

  // В психологии все вопросы помечены тегом <questionN> —
  // строка без тега это продолжение предыдущего вопроса.
  // В остальных секциях каждая строка — отдельный вопрос.
  const isContinuation = current.slug === 'psychology' && !isTagged && pending !== null;

  if (isContinuation) {
    pending.text += ' ' + trimmed;
  } else {
    flush();
    pending = { n: current.questions.length + 1, text: trimmed };
  }
}
flush();

// Валидация
for (const s of subjects) {
  if (!s.questions.length) throw new Error(`Нет вопросов: ${s.slug}`);
}

const out = `// Сгенерировано: node tools/build-data.js — не редактировать руками
window.SUBJECTS = ${JSON.stringify(subjects, null, 2)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'data.js'), out, 'utf8');

for (const s of subjects) {
  const withRu = s.questions.filter(q => q.ru).length;
  console.log(`${s.icon} ${s.name} (${s.ruName}): ${s.questions.length} вопросов, RU-перевод: ${withRu}`);
}
console.log(`Итого: ${subjects.reduce((a, s) => a + s.questions.length, 0)} вопросов`);
