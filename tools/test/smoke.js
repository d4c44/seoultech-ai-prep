/**
 * Smoke-тест: node tools/test/smoke.js
 * Проверяет: рендер домашней, список предмета, отметки + localStorage, тест-режим.
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

const dom = new JSDOM(html, { url: 'https://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};

window.eval(dataJs);
window.eval(appJs);

const doc = window.document;
const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => Array.from(doc.querySelectorAll(sel));

console.log('— Домашняя —');
assert($$('.card').length === 4, '4 предмета на домашней');
assert($('.overall__num').textContent.trim() === '0 / 100 (0%)', 'общий прогресс 0/100');
assert($$('.q').length === 0, 'списка вопросов на домашней нет');

console.log('— Предмет: Саясаттану —');
window.location.hash = '#/s/politology';
window.dispatchEvent(new window.Event('hashchange'));
assert($$('.q').length === 25, '25 вопросов в списке');
assert($('.q__kz').textContent.length > 10, 'первый вопрос рендерится');
assert($$('.markbtn').length === 50, 'по 2 кнопки отметки на вопрос');

console.log('— Отметки + localStorage —');
$$('.markbtn--known')[0].click();
assert($$('.q')[0].className.includes('q--known'), 'первый вопрос стал known');
assert($('.page-head .sub').textContent.includes('1/25'), 'счётчик 1/25: ' + $('.page-head .sub').textContent.trim());
const stored = JSON.parse(window.localStorage.getItem('seoultech-prep:marks:v1') || '{}');
assert(stored['politology-1'] === 'known', 'отметка сохранена в localStorage');

// повторный клик снимает отметку
$$('.markbtn--known')[0].click();
assert(!$$('.q')[0].className.includes('q--known'), 'повторный клик сбрасывает отметку');
$$('.markbtn--known')[0].click(); // вернуть

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
$$('.markbtn--known')[0].click(); // снять отметку — тест стартует с чистого листа
assert(JSON.parse(window.localStorage.getItem('seoultech-prep:marks:v1') || '{}')['politology-1'] === undefined, 'перед тестом отметок нет');

console.log('— Тест —');
window.location.hash = '#/s/politology/test';
window.dispatchEvent(new window.Event('hashchange'));
assert($('#startTestBtn'), 'экран настройки теста');
$$('.count-btn[data-c="5"]')[0].click();
$('#startTestBtn').click();
assert($('.test-q'), 'вопрос теста показан');
assert($('.test-meta').textContent.includes('1 / 5'), 'прогресс 1/5');

for (let i = 0; i < 5; i++) {
  (i < 3 ? $('#answerKnown') : $('#answerUnknown')).click();
}
assert($('.result__score').textContent.trim() === '3 / 5', 'итог 3/5: ' + $('.result__score').textContent.trim());
assert($$('.result__missed .q').length === 2, '2 пропущенных в списке повторения');
const stored2 = JSON.parse(window.localStorage.getItem('seoultech-prep:marks:v1') || '{}');
const unknownCount = Object.values(stored2).filter(v => v === 'unknown').length;
const knownCount = Object.values(stored2).filter(v => v === 'known').length;
assert(knownCount === 3 && unknownCount === 2, 'тест записал отметки: 3 known, 2 unknown');

console.log('— Возврат на домашнюю —');
window.location.hash = '#/';
window.dispatchEvent(new window.Event('hashchange'));
assert($('.overall__num').textContent.includes('3 / 100'), 'домашняя обновилась: ' + $('.overall__num').textContent.trim());

console.log(failures === 0 ? '\nВСЕ ТЕСТЫ ПРОШЛИ' : '\nПРОВАЛОВ: ' + failures);
process.exit(failures === 0 ? 0 : 1);
