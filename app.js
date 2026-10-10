/* Рубежный контроль — AI Institute by Seoultech
 * SPA без сборки. Данные: data.js (window.SUBJECTS, window.EXAMS).
 *
 * Архитектура (расширяемая):
 *   SUBJECTS: предмет → модули → вопросы (kz/ru/answers/answer)
 *   EXAMS:    конфиг контрольных (список предметов, по сколько вопросов, сколько нусок)
 * Новые предметы добавляются в data.js (парсер tools/build-data.js),
 * новые контрольные — в EXAMS.
 */
(function () {
  'use strict';

  var SUBJECTS = window.SUBJECTS || [];
  var EXAMS = window.EXAMS || [];
  var LS_KEY = 'seoultech-prep:marks:v1';
  var app = document.getElementById('app');

  /* ---------------- Хранилище отметок ---------------- */

  function loadMarks() {
    try { var raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function saveMarks(m) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(m)); } catch (e) { /* приватный режим */ }
  }

  var marks = loadMarks();

  function qid(slug, n) { return slug + '-' + n; }

  function setMark(slug, n, value) {
    var id = qid(slug, n);
    if (value === null) delete marks[id];
    else marks[id] = value;
    saveMarks(marks);
  }

  /* ---------------- Доступ к данным ---------------- */

  function bySlug(slug) {
    for (var i = 0; i < SUBJECTS.length; i++) if (SUBJECTS[i].slug === slug) return SUBJECTS[i];
    return null;
  }
  function byExam(id) {
    for (var i = 0; i < EXAMS.length; i++) if (EXAMS[i].id === id) return EXAMS[i];
    return null;
  }
  function subjQuestions(s) {
    var q = [];
    s.modules.forEach(function (m) { q = q.concat(m.questions); });
    return q;
  }

  function subjectStats(slug) {
    var s = bySlug(slug);
    var qs = subjQuestions(s);
    var known = 0, unknown = 0;
    qs.forEach(function (q) {
      var m = marks[qid(s.slug, q.n)];
      if (m === 'known') known++;
      else if (m === 'unknown') unknown++;
    });
    return { total: qs.length, known: known, unknown: unknown };
  }

  function overallStats() {
    var known = 0, total = 0;
    SUBJECTS.forEach(function (s) {
      var st = subjectStats(s.slug);
      known += st.known; total += st.total;
    });
    return { known: known, total: total };
  }

  /* ---------------- Утилиты ---------------- */

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(part, total) { return total ? Math.round((part / total) * 100) : 0; }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededShuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function shuffle(arr) { return seededShuffle(arr, Math.random); }

  /* ---------------- Нуски экзаменов ---------------- */

  function buildVariants(exam) {
    var base = hashStr(exam.id);
    var out = [];
    for (var v = 1; v <= exam.variants; v++) {
      var rng = mulberry32(base + v * 7919);
      var items = [];
      exam.subjects.forEach(function (slug) {
        var s = bySlug(slug);
        if (!s) return;
        seededShuffle(subjQuestions(s), rng).slice(0, exam.perSubject).forEach(function (q) {
          items.push({ q: q, subject: slug });
        });
      });
      out.push({ num: v, items: seededShuffle(items, rng) });
    }
    return out;
  }

  var variantsCache = {};
  function examVariants(exam) {
    if (!variantsCache[exam.id]) variantsCache[exam.id] = buildVariants(exam);
    return variantsCache[exam.id];
  }
  window.__getVariants = function (id) { var e = byExam(id); return e ? examVariants(e) : null; };
  window.__EXAMS = EXAMS;

  function variantStats(v) {
    var known = 0;
    v.items.forEach(function (it) {
      if (marks[qid(it.subject, it.q.n)] === 'known') known++;
    });
    return { total: v.items.length, known: known };
  }

  /* ---------------- Переходы ---------------- */

  var transitioning = false;
  var lastHash = null;

  function swapView(html) {
    app.innerHTML = html;
    app.classList.remove('is-leaving');
    app.classList.add('is-entering');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        app.querySelectorAll('[data-fill]').forEach(function (el) {
          el.style.width = el.getAttribute('data-fill') + '%';
        });
      });
    });
    if (app.__enterTimer) clearTimeout(app.__enterTimer);
    app.__enterTimer = setTimeout(function () { app.classList.remove('is-entering'); }, 600);
    wireAnswerToggles(app);
  }

  function route() {
    if (transitioning) return;
    transitioning = true;
    var h = location.hash || '#/';
    var finish = function (target) {
      lastHash = target;
      renderRouteFor(target);
      transitioning = false;
      window.scrollTo(0, 0);
      var cur = location.hash || '#/';
      if (cur !== lastHash) route();
    };
    if (app.dataset.ready && h !== lastHash) {
      app.classList.add('is-leaving');
      setTimeout(function () { finish(h); }, 190);
    } else {
      app.dataset.ready = '1';
      finish(h);
    }
  }

  function staggerStyle(i) { return ' style="--i:' + Math.min(i, 10) + '"'; }

  function progressHtml(part, total) {
    var p = pct(part, total);
    return '<div class="progress' + (total && part === total ? ' progress--done' : '') + '">' +
      '<div class="progress__bar" data-fill="' + p + '"></div></div>';
  }

  function badge(q) {
    return q.answers > 1 ? ' <span class="qbadge">' + q.answers + ' жауап</span>' : '';
  }

  function answerHtml(q, key, open) {
    var text = q.answer
      ? esc(q.answer)
      : '<span class="ans-placeholder">Жауап әзірге қосылмады — бізге кілт жіберіңіз</span>';
    return '<div class="answrap' + (open ? ' open' : '') + '" id="' + key + '">' +
      '<div class="ansbox"><div class="ansinner">' +
        '<div class="ansinner__label">Дұрыс жауап</div>' +
        text +
      '</div></div></div>';
  }

  function wireAnswerToggles(container) {
    container.querySelectorAll('.ansbtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wrap = document.getElementById(btn.dataset.ans);
        if (!wrap) return;
        var open = wrap.classList.toggle('open');
        btn.classList.toggle('open', open);
        btn.textContent = open ? 'Жауапты жасыру' : 'Жауапты көрсету';
      });
    });
  }

  /* ---------------- Views ---------------- */

  function viewHome() {
    var ov = overallStats();

    var examCards = EXAMS.map(function (e, i) {
      var subjNames = e.subjects.map(function (slug) { var s = bySlug(slug); return s ? esc(s.name) : slug; }).join(', ');
      return '<a class="brow" href="#/e/' + e.id + '"' + staggerStyle(i) + '>' +
        '<div class="brow__name"><strong>' + esc(e.title) + '</strong><small>' + esc(e.subtitle) + ' · ' + e.variants + ' нұсқа · ' + e.total + ' сұрақ</small></div>' +
        '<div class="brow__stats">' + subjNames.slice(0, 60) + (subjNames.length > 60 ? '…' : '') + '</div>' +
        '<div class="brow__arrow">→</div>' +
      '</a>';
    }).join('');

    var bankRows = SUBJECTS.map(function (s, i) {
      var st = subjectStats(s.slug);
      var modCount = s.modules.length;
      return '<a class="brow" href="#/s/' + s.slug + '"' + staggerStyle(i) + '>' +
        '<div class="brow__name"><strong>' + esc(s.name) + '</strong><small>' + esc(s.ruName) + ' · ' + modCount + ' модуль · жауаптарымен</small></div>' +
        '<div class="brow__stats"><b>' + st.known + '</b> / ' + st.total + '</div>' +
        '<div class="brow__arrow">→</div>' +
      '</a>';
    }).join('');

    swapView(
      '<div class="hero">' +
        '<div class="overline">AI Institute by Seoultech · Қызылорда</div>' +
        '<h1>Дайындық платформасы</h1>' +
        '<p class="lede">Сұрақтар мен дұрыс жауаптар қазақ және орус тілдерінде. Сұрақты оқыңыз, жауабын көріп тексеріңіз, білгендерін белгілеңіз.</p>' +
        '<div class="rule"></div>' +
        '<div class="overall">' +
          '<div class="overall__row">' +
            '<span class="overall__title">Жалпы прогресс</span>' +
            '<span class="overall__num">' + ov.known + ' / ' + ov.total + '</span>' +
          '</div>' +
          progressHtml(ov.known, ov.total) +
          '<div class="overall__hint">✓ — білемін, ↻ — қайталау керек. Белгілер браузерде сақталады.</div>' +
        '</div>' +
      '</div>' +
      (EXAMS.length ?
        '<div class="section">' +
          '<div class="section__head"><span class="section__title">Бақылау</span><span class="section__note">нұсқа таңдап, 20 сұрақтан тест</span></div>' +
          '<div class="bank stagger">' + examCards + '</div>' +
        '</div>'
        : '') +
      '<div class="section">' +
        '<div class="section__head"><span class="section__title">Пәндер</span><span class="section__note">' + ov.total + ' сұрақ</span></div>' +
        '<div class="bank stagger">' + bankRows + '</div>' +
      '</div>'
    );
  }

  function viewExam(examId) {
    var e = byExam(examId);
    if (!e) { swapView('<div class="empty">Бақылау табылмады</div>'); return; }

    var variants = examVariants(e);
    var cards = variants.map(function (v, i) {
      var st = variantStats(v);
      return '<a class="vcard" href="#/e/' + e.id + '/v/' + v.num + '"' + staggerStyle(i) + '>' +
        '<div class="vcard__num">0' + v.num + '</div>' +
        '<div class="vcard__body">' +
          '<div class="vcard__title">Нұсқа ' + v.num + '</div>' +
          '<div class="vcard__meta">' + e.total + ' сұрақ · әр пәннен ' + e.perSubject + ' сұрақтан</div>' +
          '<div class="vcard__prog">' + progressHtml(st.known, st.total) +
            '<span class="vcard__count">' + st.known + '/' + st.total + '</span></div>' +
        '</div>' +
        '<div class="vcard__arrow">→</div>' +
      '</a>';
    }).join('');

    var subjNames = e.subjects.map(function (slug) { var s = bySlug(slug); return s ? esc(s.name) : slug; }).join(' · ');

    swapView(
      '<a class="backlink" href="#/">← Басты бет</a>' +
      '<div class="page-head">' +
        '<h1>' + esc(e.title) + '</h1>' +
        '<div class="sub">' + esc(e.subtitle) + ' · ' + subjNames + '</div>' +
      '</div>' +
      '<p class="lede" style="margin-bottom:18px">Әр нұсқада ' + e.total + ' сұрақ — ' + e.subjects.length + ' пәннен кездейсоқ таңдалған. Нұсқа таңдаңыз.</p>' +
      '<div class="variants stagger">' + cards + '</div>'
    );
  }

  function viewVariant(examId, num) {
    var e = byExam(examId);
    var v = null;
    if (e) {
      var vs = examVariants(e);
      for (var i = 0; i < vs.length; i++) if (vs[i].num === num) v = vs[i];
    }
    if (!e || !v) { swapView('<div class="empty">Нұсқа табылмады</div>'); return; }

    var st = variantStats(v);
    var comp = e.subjects.map(function (slug) {
      var s = bySlug(slug);
      return '<li><span>' + (s ? esc(s.name) : esc(slug)) + '</span><span>' + e.perSubject + ' сұрақ</span></li>';
    }).join('');

    swapView(
      '<a class="backlink" href="#/e/' + e.id + '">← ' + esc(e.title) + '</a>' +
      '<div class="exam-intro">' +
        '<div class="overline">' + esc(e.title) + '</div>' +
        '<h1>Нұсқа ' + v.num + '</h1>' +
        '<p class="lede">' + e.total + ' сұрақ, әр пәннен ' + e.perSubject + ' сұрақ. Әр сұраққа жауапты өз бетіңізше тексеріңіз — қажет болса жауапты көріп алыңыз.</p>' +
        '<ul class="exam-composition">' + comp + '</ul>' +
        '<div class="overall" style="margin-bottom:18px">' +
          '<div class="overall__row">' +
            '<span class="overall__title">Бұл нұсқа бойынша</span>' +
            '<span class="overall__num">' + st.known + ' / ' + st.total + '</span>' +
          '</div>' +
          progressHtml(st.known, st.total) +
        '</div>' +
        '<button class="btn btn--primary btn--big btn--block" id="startExamBtn">' +
          (st.known > 0 ? 'Тестті жалғастыру' : 'Тестті бастау') +
        '</button>' +
      '</div>'
    );

    document.getElementById('startExamBtn').addEventListener('click', function () {
      startExam({ title: e.title + ' · Нұсқа ' + v.num, back: '#/e/' + e.id + '/v/' + v.num, items: v.items, exam: e });
    });
  }

  function viewSubject(slug, tab) {
    var s = bySlug(slug);
    if (!s) { swapView('<div class="empty">Пән табылмады</div>'); return; }
    if (tab === 'test') { viewPracticeSetup(s); return; }

    var st = subjectStats(slug);

    swapView(
      '<a class="backlink" href="#/">← Басты бет</a>' +
      '<div class="page-head">' +
        '<h1>' + esc(s.name) + '</h1>' +
        '<div class="sub">' + esc(s.ruName) + ' · ' + st.known + '/' + st.total + ' сұрақ білінді</div>' +
      '</div>' +
      '<div class="tabs">' +
        '<button data-tab="list" class="' + (tab === 'list' ? 'active' : '') + '">Сұрақтар</button>' +
        '<button data-tab="test" class="' + (tab === 'test' ? 'active' : '') + '">Тест</button>' +
      '</div>' +
      '<div class="toolbar">' +
        '<input class="search" type="search" placeholder="Іздеу: сұрақ мәтініне…" id="searchInput" />' +
        (st.unknown > 0 ? '<button class="btn btn--ghost" id="reviewBtn">Тек қайталау (' + st.unknown + ')</button>' : '') +
      '</div>' +
      '<div class="filters" id="filters">' +
        '<button class="chip active" data-f="all">Барлығы<span class="cnt">' + st.total + '</span></button>' +
        '<button class="chip" data-f="known">Білінген<span class="cnt">' + st.known + '</span></button>' +
        '<button class="chip" data-f="unknown">Қайталау<span class="cnt">' + st.unknown + '</span></button>' +
      '</div>' +
      '<div class="q-list" id="qList"></div>'
    );

    var state = { filter: 'all', query: '', open: {} };

    function match(q) {
      var m = marks[qid(slug, q.n)];
      if (state.filter === 'known' && m !== 'known') return false;
      if (state.filter === 'unknown' && m !== 'unknown') return false;
      if (state.query) {
        var hay = (q.kz + ' ' + (q.ru || '')).toLowerCase();
        if (hay.indexOf(state.query) === -1) return false;
      }
      return true;
    }

    function questionHtml(q) {
      var m = marks[qid(slug, q.n)];
      var cls = m === 'known' ? 'q--known' : (m === 'unknown' ? 'q--unknown' : '');
      var key = 'ans-' + slug + '-' + q.n;
      var isOpen = !!state.open[q.n];
      return '<div class="q ' + cls + '">' +
        '<div class="q__num">' + q.n + '.</div>' +
        '<div class="q__body">' +
          '<div class="q__kz">' + esc(q.kz) + badge(q) + '</div>' +
          (q.ru ? '<div class="q__ru">' + esc(q.ru) + '</div>' : '') +
          '<div class="q__meta">' +
            '<div class="q__actions">' +
              '<button class="ansbtn' + (isOpen ? ' open' : '') + '" data-ans="' + key + '">' +
                (isOpen ? 'Жауапты жасыру' : 'Жауапты көрсету') + '</button>' +
              '<div class="q__marks">' +
                '<button class="markbtn markbtn--known ' + (m === 'known' ? 'active' : '') + '" data-q="' + q.n + '" data-v="known">✓ Білемін</button>' +
                '<button class="markbtn markbtn--unknown ' + (m === 'unknown' ? 'active' : '') + '" data-q="' + q.n + '" data-v="unknown">↻ Қайталаймын</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          answerHtml(q, key, isOpen) +
        '</div>' +
      '</div>';
    }

    function renderList() {
      var el = document.getElementById('qList');
      var html = '';
      var any = false;

      s.modules.forEach(function (mod) {
        var qs = mod.questions.filter(match);
        if (!qs.length) return;
        any = true;
        if (s.modules.length > 1 || state.filter !== 'all' || state.query) {
          html += '<div class="modhead">' + esc(mod.title) + '</div>';
        }
        html += qs.map(questionHtml).join('');
      });

      el.innerHTML = any ? html : '<div class="empty">Бұл сүзгіде сұрақ жоқ</div>';
      wireAnswerToggles(el);
    }

    function refreshCounts() {
      var st2 = subjectStats(slug);
      document.querySelectorAll('#filters .chip').forEach(function (chip) {
        var cnt = chip.querySelector('.cnt');
        if (!cnt) return;
        if (chip.dataset.f === 'all') cnt.textContent = st2.total;
        if (chip.dataset.f === 'known') cnt.textContent = st2.known;
        if (chip.dataset.f === 'unknown') cnt.textContent = st2.unknown;
      });
      var sub = document.querySelector('.page-head .sub');
      if (sub) sub.textContent = s.ruName + ' · ' + st2.known + '/' + st2.total + ' сұрақ білінді';
      var rb = document.getElementById('reviewBtn');
      if (rb) {
        if (st2.unknown > 0) rb.textContent = 'Тек қайталау (' + st2.unknown + ')';
        else rb.remove();
      }
    }

    document.getElementById('qList').addEventListener('click', function (e) {
      var btn = e.target.closest('.markbtn');
      if (!btn) return;
      var n = parseInt(btn.dataset.q, 10);
      var cur = marks[qid(slug, n)];
      setMark(slug, n, cur === btn.dataset.v ? null : btn.dataset.v);
      renderList();
      refreshCounts();
    });

    // reveal-кнопка: меняем состояние без перерендера списка
    document.getElementById('qList').addEventListener('click', function (e) {
      var btn = e.target.closest('.ansbtn');
      if (!btn) return;
      var n = parseInt(btn.dataset.ans.split('-').pop(), 10);
      state.open[n] = !state.open[n];
    });

    document.getElementById('filters').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      state.filter = chip.dataset.f;
      document.querySelectorAll('#filters .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      renderList();
    });

    document.getElementById('searchInput').addEventListener('input', function (e) {
      state.query = e.target.value.trim().toLowerCase();
      renderList();
    });

    document.querySelector('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      location.hash = b.dataset.tab === 'test' ? '#/s/' + slug + '/test' : '#/s/' + slug;
    });

    var rb = document.getElementById('reviewBtn');
    if (rb) rb.addEventListener('click', function () {
      var pool = subjQuestions(s).filter(function (q) { return marks[qid(slug, q.n)] === 'unknown'; });
      startExam({
        title: 'Қайталау · ' + s.name,
        back: '#/s/' + slug,
        items: pool.map(function (q) { return { q: q, subject: slug }; })
      });
    });

    renderList();
  }

  function viewPracticeSetup(s) {
    var st = subjectStats(s.slug);
    swapView(
      '<a class="backlink" href="#/s/' + s.slug + '">← ' + esc(s.name) + '</a>' +
      '<div class="exam-intro">' +
        '<div class="overline">Практика</div>' +
        '<h1>' + esc(s.name) + '</h1>' +
        '<p class="lede">Пән бойынша кездейсоқ сұрақтармен жатығыңыз. Жауапты көріп, тексеріңіз.</p>' +
        '<div class="overall" style="margin-bottom:20px">' +
          '<div class="overall__row">' +
            '<span class="overall__title">Прогресс</span>' +
            '<span class="overall__num">' + st.known + ' / ' + st.total + '</span>' +
          '</div>' +
          progressHtml(st.known, st.total) +
        '</div>' +
        '<div class="count-row" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">' +
          '<button class="btn btn--ghost count-btn" data-c="5">5 сұрақ</button>' +
          '<button class="btn btn--ghost count-btn" data-c="10">10 сұрақ</button>' +
          '<button class="btn btn--ghost count-btn active" data-c="' + st.total + '">' + st.total + ' сұрақ</button>' +
        '</div>' +
        '<button class="btn btn--primary btn--big btn--block" id="startPracticeBtn">Бастау</button>' +
      '</div>'
    );

    var chosen = st.total;
    document.querySelector('.count-row').addEventListener('click', function (e) {
      var b = e.target.closest('.count-btn');
      if (!b) return;
      chosen = parseInt(b.dataset.c, 10);
      document.querySelectorAll('.count-btn').forEach(function (c) { c.classList.remove('active'); });
      b.classList.add('active');
    });
    document.getElementById('startPracticeBtn').addEventListener('click', function () {
      var items = shuffle(subjQuestions(s)).slice(0, chosen).map(function (q) { return { q: q, subject: s.slug }; });
      startExam({ title: 'Практика · ' + s.name, back: '#/s/' + s.slug, items: items });
    });
  }

  /* ---------------- Тест / экзамен ---------------- */

  var exam = null;

  function startExam(opts) {
    if (!opts.items || !opts.items.length) {
      location.hash = opts.back || '#/';
      return;
    }
    exam = {
      title: opts.title,
      back: opts.back || '#/',
      items: opts.items,
      index: 0,
      results: []
    };
    renderExamQuestion();
  }

  function renderExamQuestion() {
    var it = exam.items[exam.index];
    var q = it.q;
    var subj = bySlug(it.subject);
    var key = 'ans-exam-' + exam.index;

    swapView(
      '<a class="backlink" href="' + exam.back + '">← Шығу</a>' +
      '<div class="exam-stage">' +
        '<div class="exam-meta">' +
          '<span>' + esc(exam.title) + '</span>' +
          '<span>' + (exam.index + 1) + ' / ' + exam.items.length + '</span>' +
        '</div>' +
        progressHtml(exam.index, exam.items.length) +
        '<div style="margin-top:22px">' +
          '<div class="exam-subj">' + (subj ? esc(subj.name) : '') + '</div>' +
          '<div class="exam-q">' + esc(q.kz) + badge(q) + '</div>' +
          (q.ru ? '<div class="exam-ru">' + esc(q.ru) + '</div>' : '') +
        '</div>' +
        '<div class="exam-ask">Алдымен өз жауабыңызды ойлап шығарыңыз, содан кейін тексеріңіз:</div>' +
        '<div class="exam-reveal">' +
          '<button class="btn btn--ghost btn--sm ansbtn" data-ans="' + key + '">Жауапты көрсету</button>' +
          answerHtml(q, key) +
        '</div>' +
        '<div class="exam-actions">' +
          '<button class="btn btn--good btn--big" id="answerKnown">✓ Иә, білемін</button>' +
          '<button class="btn btn--ghost btn--big" id="answerUnknown">Жоқ, қайталаймын</button>' +
        '</div>' +
      '</div>'
    );

    document.getElementById('answerKnown').addEventListener('click', function () { answerExam(true); });
    document.getElementById('answerUnknown').addEventListener('click', function () { answerExam(false); });
  }

  function answerExam(known) {
    var it = exam.items[exam.index];
    exam.results.push({ item: it, known: known });
    setMark(it.subject, it.q.n, known ? 'known' : 'unknown');
    exam.index++;
    if (exam.index < exam.items.length) renderExamQuestion();
    else renderExamResult();
  }

  function renderExamResult() {
    var known = exam.results.filter(function (r) { return r.known; }).length;
    var total = exam.results.length;
    var missed = exam.results.filter(function (r) { return !r.known; }).map(function (r) { return r.item; });
    var p = pct(known, total);

    var msg = p === 100
      ? 'Нақ соғылдың — барлығы дұрыс.'
      : (p >= 80 ? 'Керемет нәтиже. Аяқталмаған сұрақтарды ғана қайталаңыз.'
        : (p >= 50 ? 'Жақсы бастама. Төмендегі сұрақтарды қайталап шығыңыз.'
          : 'Бірден болмайды — қателерді жеке қайталап шығыңыз.'));

    var bySubj = {};
    exam.results.forEach(function (r) {
      if (!bySubj[r.item.subject]) bySubj[r.item.subject] = { k: 0, t: 0 };
      bySubj[r.item.subject].t++;
      if (r.known) bySubj[r.item.subject].k++;
    });
    var subjKeys = Object.keys(bySubj);
    var breakdown = subjKeys.length > 1
      ? '<div class="breakdown"><h3>Пәндер бойынша</h3>' + subjKeys.map(function (k) {
          var d = bySubj[k];
          return '<div class="breakdown__row"><span>' + esc(bySlug(k).name) + '</span><span>' + d.k + ' / ' + d.t + '</span></div>';
        }).join('') + '</div>'
      : '';

    var missedHtml = '';
    if (missed.length) {
      missedHtml = '<div class="result__missed"><h3>Қайталауға қалған (' + missed.length + ')</h3>' +
        '<div class="q-list">' + missed.map(function (it) {
          var q = it.q;
          return '<div class="q q--unknown">' +
            '<div class="q__num">' + esc(bySlug(it.subject).name.slice(0, 3)) + '</div>' +
            '<div class="q__body">' +
              '<div class="q__kz">' + esc(q.kz) + badge(q) + '</div>' +
              (q.ru ? '<div class="q__ru">' + esc(q.ru) + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join('') + '</div></div>';
    }

    swapView(
      '<a class="backlink" href="' + exam.back + '">← Артқа</a>' +
      '<div class="exam-stage"><div class="result">' +
        '<div class="overline">' + esc(exam.title) + ' аяқталды</div>' +
        '<div class="result__score">' + known + '<small> / ' + total + '</small></div>' +
        '<p class="result__msg">' + msg + '</p>' +
        breakdown +
        missedHtml +
        '<div class="result__actions">' +
          '<button class="btn btn--primary" id="againBtn">Қайта тапсыру</button>' +
          (missed.length >= 2 ? '<button class="btn btn--ghost" id="missedOnlyBtn">Тек қателерді (' + missed.length + ')</button>' : '') +
          '<button class="btn btn--ghost" id="homeBtn">Басты бет</button>' +
        '</div>' +
      '</div></div>'
    );

    document.getElementById('againBtn').addEventListener('click', function () {
      startExam({ title: exam.title, back: exam.back, items: exam.items });
    });
    var mo = document.getElementById('missedOnlyBtn');
    if (mo) mo.addEventListener('click', function () {
      startExam({ title: exam.title + ' · қателер', back: exam.back, items: shuffle(missed) });
    });
    document.getElementById('homeBtn').addEventListener('click', function () {
      location.hash = '#/';
    });
  }

  /* ---------------- Роутер ---------------- */

  function renderRouteFor(hash) {
    var mV = hash.match(/^#\/e\/([a-z0-9-]+)\/v\/([1-9])$/);
    var mE = hash.match(/^#\/e\/([a-z0-9-]+)$/);
    var mS = hash.match(/^#\/s\/([a-z-]+)(?:\/(test))?$/);
    if (mV) viewVariant(mV[1], parseInt(mV[2], 10));
    else if (mE) viewExam(mE[1]);
    else if (mS) viewSubject(mS[1], mS[2] === 'test' ? 'test' : 'list');
    else viewHome();
  }

  window.addEventListener('hashchange', route);
  route();
})();
