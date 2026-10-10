/**
 * Smoke-тест: node tools/test/smoke.js
 * Домашняя (нуски + банк), детерминированность нусок, предметный список,
 * отметки + localStorage, экзамен по нуске, бейджи.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dataJs = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log('  ✓ ' + name);
  else { console.error('  ✗ ' + name); failures++; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dom = new JSDOM(html, { url: 'https://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.eval(dataJs);
window.eval(appJs);

const doc = window.document;
const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => Array.from(doc.querySelectorAll(sel));

async function go(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(320); // переход: leave 190ms + рендер
}

(async () => {
  console.log('— Домашняя —');
  assert($$('.vcard').length === 4, '4 нуски на домашней');
  assert($$('.brow').length === 4, '4 предмета в банке');
  assert($('.overall__num').textContent.trim() === '0 / 100', 'общий прогресс 0/100');

  console.log('— Нуски детерминированы —');
  const V = window.__VARIANTS;
  assert(V.length === 4, '4 нуски');
  assert(V.every(v => v.items.length === 20), 'по 20 вопросов в нуске');
  const perSubjOk = V.every(v => {
    const counts = {};
    v.items.forEach(it => { counts[it.subject] = (counts[it.subject] || 0) + 1; });
    return Object.keys(counts).length === 4 && Object.values(counts).every(c => c === 5);
  });
  assert(perSubjOk, 'в каждой нуске ровно 5 вопросов с каждого предмета');
  assert(V[0].items[0].q.kz && V[0].items[0].subject, 'элемент нуски: вопрос + предмет');

  console.log('— Предмет: Саясаттану —');
  await go('#/s/politology');
  assert($$('.q').length === 25, '25 вопросов в списке');
  assert($$('.markbtn').length === 50, 'по 2 кнопки отметки');
  assert($('.q__kz').textContent.length > 10, 'первый вопрос рендерится');

  console.log('— Бейджи сложности —');
  await go('#/s/psychology');
  const badges = $$('.qbadge').map(b => b.textContent.trim());
  assert(badges.length === 12, '12 бейджей в психологии (' + badges.length + ')');
  assert(badges.includes('2 жауап') && badges.includes('3 жауап'), 'бейджи 2/3 жауап');
  await go('#/s/culturology');
  assert($$('.qbadge').length === 4, '4 бейджа в культурологии');

  console.log('— Отметки + localStorage —');
  await go('#/s/politology');
  $$('.markbtn--known')[0].click();
  assert($$('.q')[0].className.includes('q--known'), 'первый вопрос known');
  assert(JSON.parse(window.localStorage.getItem('seoultech-prep:marks:v1'))['politology-1'] === 'known', 'отметка в localStorage');
  $$('.markbtn--known')[0].click();
  $$('.markbtn--known')[0].click(); // вернуть known

  console.log('— Поиск и фильтры —');
  const search = $('#searchInput');
  search.value = 'Вебер';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  const found = $$('.q').length;
  assert(found >= 1 && found < 25, 'поиск "Вебер" сузил список (' + found + ')');
  search.value = '';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  $$('.chip[data-f="known"]')[0].click();
  assert($$('.q').length === 1, 'фильтр "Білінген" показывает 1');
  $$('.chip[data-f="all"]')[0].click();
  $$('.markbtn--known')[0].click(); // снять — чистый лист к экзамену
  assert(!JSON.parse(window.localStorage.getItem('seoultech-prep:marks:v1') || '{}')['politology-1'], 'перед экзаменом отметок нет');

  console.log('— Экзамен: нұсқа 1 —');
  await go('#/v/1');
  assert($('#startExamBtn'), 'экран нуски с кнопкой старта');
  assert($$('.exam-composition li').length === 4, 'состав: 4 предмета');
  $('#startExamBtn').click();
  await sleep(320);
  assert($('.exam-q'), 'вопрос экзамена показан');
  assert($('.exam-meta').textContent.includes('1 / 20'), 'прогресс 1/20');
  assert($('.exam-subj'), 'метка предмета над вопросом');

  for (let i = 0; i < 20; i++) {
    (i < 12 ? $('#answerKnown') : $('#answerUnknown')).click();
    await sleep(30);
  }
  await sleep(320);
  assert($('.result__score').textContent.replace(/\s/g, '').includes('12/20'), 'итог 12/20: ' + $('.result__score').textContent.replace(/\s/g, ' ').trim());
  assert($$('.result__missed .q').length === 8, '8 пропущенных');
  assert($$('.breakdown__row').length === 4, 'разбивка по 4 предметам');
  const stored = JSON.parse(window.localStorage.getItem('seoultech-prep:marks:v1'));
  assert(Object.values(stored).filter(v => v === 'known').length === 12, '12 known в localStorage');
  assert(Object.values(stored).filter(v => v === 'unknown').length === 8, '8 unknown в localStorage');

  console.log('— Возврат на домашнюю —');
  await go('#/');
  assert($('.overall__num').textContent.includes('12 / 100'), 'домашняя: 12/100 — ' + $('.overall__num').textContent.trim());
  assert($$('.vcard')[0].querySelector('.vcard__count').textContent === '12/20', 'прогресс нуски 1: 12/20 — ' + $$('.vcard')[0].querySelector('.vcard__count').textContent);

  console.log(failures === 0 ? '\nВСЕ ТЕСТЫ ПРОШЛИ' : '\nПРОВАЛОВ: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
