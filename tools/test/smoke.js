/**
 * Smoke-тест: node tools/test/smoke.js
 * Структура данных (100 ответов), home (экзамены + предметы), reveal-ответ,
 * детерминированные нуски, экзамен по нуске, отметки.
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
  await sleep(320);
}

(async () => {
  console.log('— Данные —');
  const S = window.SUBJECTS, E = window.EXAMS;
  assert(S.length === 4, '4 предмета');
  assert(S.every(s => s.modules.length >= 1 && s.modules[0].questions.length === 25), 'у каждого предмета модуль с 25 вопросами');
  const totalQ = S.reduce((a, s) => a + s.modules[0].questions.length, 0);
  assert(totalQ === 100, '100 вопросов');
  const withAns = S.reduce((a, s) => a + s.modules[0].questions.filter(q => q.answer).length, 0);
  assert(withAns === 100, 'ответов: 100/100 (' + withAns + ')');
  assert(E.length >= 1 && E[0].variants === 4 && E[0].total === 20, 'экзамен: 4 нуски по 20');

  console.log('— Домашняя —');
  assert($$('.brow').length === 5, '5 карточек (1 экзамен + 4 предмета)');
  assert($('.overall__num').textContent.trim() === '0 / 100', 'общий прогресс 0/100');
  assert(doc.body.textContent.includes('Рубежный контроль'), 'карточка экзамена видна');

  console.log('— Нуски детерминированы —');
  const V = window.__getVariants('rk-m1');
  assert(V.length === 4, '4 нуски');
  assert(V.every(v => v.items.length === 20), 'по 20 вопросов');
  const perSubjOk = V.every(v => {
    const c = {};
    v.items.forEach(it => { c[it.subject] = (c[it.subject] || 0) + 1; });
    return Object.keys(c).length === 4 && Object.values(c).every(x => x === 5);
  });
  assert(perSubjOk, 'в нуске ровно 5 с каждого предмета');
  assert(V[0].items[0].q.answer, 'вопросы нуски несут ответ');

  console.log('— Предмет: reveal-ответ —');
  await go('#/s/politology');
  assert($$('.q').length === 25, '25 вопросов');
  assert($$('.ansbtn').length === 25, '25 кнопок ответа');
  $$('.ansbtn')[0].click();
  await sleep(50);
  const wrap0 = $('#ans-politology-1');
  assert(wrap0.classList.contains('open'), 'ответ раскрывается');
  assert(wrap0.textContent.includes('наука'), 'содержит ответ: ' + wrap0.textContent.slice(0, 80));
  $$('.ansbtn')[0].click();
  assert(!$('#ans-politology-1').classList.contains('open'), 'ответ сворачивается');

  console.log('— Отметки + поиск —');
  $$('.markbtn--known')[0].click();
  assert($$('.q')[0].className.includes('q--known'), 'отметка known');
  const search = $('#searchInput');
  search.value = 'Вебер';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert($$('.q').length === 1, 'поиск "Вебер" — 1 сұрақ');
  search.value = '';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  $$('.markbtn--known')[0].click(); // снять

  console.log('— Экзамен: rk-m1 / нұсқа 2 —');
  await go('#/e/rk-m1');
  assert($$('.vcard').length === 4, '4 нуски на странице экзамена');
  await go('#/e/rk-m1/v/2');
  assert($('#startExamBtn'), 'интро нуски');
  assert($$('.exam-composition li').length === 4, 'состав из 4 предметов');
  $('#startExamBtn').click();
  await sleep(320);
  assert($('.exam-q'), 'вопрос экзамена');
  assert($('.ansbtn'), 'в экзамене есть кнопка ответа');
  $('.ansbtn').click();
  await sleep(50);
  assert($('#ans-exam-0').classList.contains('open'), 'ответ раскрыт в экзамене');
  assert($('#ans-exam-0').textContent.length > 20, 'ответ не пустой');

  for (let i = 0; i < 20; i++) {
    (i < 12 ? $('#answerKnown') : $('#answerUnknown')).click();
    await sleep(25);
  }
  await sleep(320);
  assert($('.result__score').textContent.replace(/\s/g, '').includes('12/20'), 'итог 12/20');
  assert($$('.result__missed .q').length === 8, '8 пропущенных');
  assert($$('.breakdown__row').length === 4, 'разбивка по 4 предметам');
  const stored = JSON.parse(window.localStorage.getItem('seoultech-prep:marks:v1'));
  assert(Object.values(stored).filter(v => v === 'known').length === 12, '12 known в localStorage');

  console.log('— Домашняя обновилась —');
  await go('#/');
  assert($('.overall__num').textContent.includes('12 / 100'), 'общий: ' + $('.overall__num').textContent.trim());
  assert($$('.brow')[0].getAttribute('href') === '#/e/rk-m1', 'карточка экзамена ведёт на #/e/rk-m1');

  console.log(failures === 0 ? '\nВСЕ ТЕСТЫ ПРОШЛИ' : '\nПРОВАЛОВ: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
