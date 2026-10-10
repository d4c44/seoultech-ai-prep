/* Рубежный контроль — AI Institute by Seoultech
 * SPA без сборки. Данные: data.js (window.SUBJECTS).
 * 4 нуски по 20 вопросов (5 с каждого предмета), детерминированная выборка.
 * Прогресс — в localStorage.
 */
(function () {
  'use strict';

  var SUBJECTS = window.SUBJECTS || [];
  var LS_KEY = 'seoultech-prep:marks:v1';
  var PER_SUBJECT = 5; // вопросов с каждого предмета в нуске
  var app = document.getElementById('app');

  /* ---------------- Хранилище отметок ---------------- */

  function loadMarks() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
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

  function bySlug(slug) {
    for (var i = 0; i < SUBJECTS.length; i++) if (SUBJECTS[i].slug === slug) return SUBJECTS[i];
    return null;
  }

  function subjectStats(slug) {
    var s = bySlug(slug);
    var known = 0, unknown = 0;
    s.questions.forEach(function (q) {
      var m = marks[qid(s.slug, q.n)];
      if (m === 'known') known++;
      else if (m === 'unknown') unknown++;
    });
    return { total: s.questions.length, known: known, unknown: unknown };
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

  /* ---------------- Нуски ---------------- */

  function buildVariants() {
    var out = [];
    for (var v = 1; v <= 4; v++) {
      var rng = mulberry32(20260110 + v * 7919);
      var items = [];
      SUBJECTS.forEach(function (s) {
        seededShuffle(s.questions, rng).slice(0, PER_SUBJECT).forEach(function (q) {
          items.push({ q: q, subject: s.slug });
        });
      });
      out.push({ num: v, items: seededShuffle(items, rng) });
    }
    return out;
  }

  var VARIANTS = buildVariants();
  window.__VARIANTS = VARIANTS; // для тестов

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
    // перезапуск анимации progress-баров
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        app.querySelectorAll('[data-fill]').forEach(function (el) {
          el.style.width = el.getAttribute('data-fill') + '%';
        });
      });
    });
    if (app.__enterTimer) clearTimeout(app.__enterTimer);
    app.__enterTimer = setTimeout(function () { app.classList.remove('is-entering'); }, 600);
  }

  function route() {
    if (transitioning) return; // повторный вызов после дорендера — ниже
    transitioning = true;
    var h = location.hash || '#/';
    var finish = function (target) {
      lastHash = target;
      renderRouteFor(target);
      transitioning = false;
      window.scrollTo(0, 0);
      var cur = location.hash || '#/';
      if (cur !== lastHash) route(); // hash сменился во время перехода
    };
    if (app.dataset.ready && h !== lastHash) {
      app.classList.add('is-leaving');
      setTimeout(function () { finish(h); }, 190);
    } else {
      app.dataset.ready = '1';
      finish(h);
    }
  }

  function renderRouteFor(hash) {
    var mV = hash.match(/^#\/v\/([1-4])$/);
    var mS = hash.match(/^#\/s\/([a-z-]+)(?:\/(test))?$/);
    if (mV) viewVariant(parseInt(mV[1], 10));
    else if (mS) viewSubject(mS[1], mS[2] === 'test' ? 'test' : 'list');
    else viewHome();
  }

  function staggerStyle(i) {
    return ' style="--i:' + Math.min(i, 10) + '"';
  }

  function progressHtml(part, total) {
    var p = pct(part, total);
    return '<div class="progress' + (total && part === total ? ' progress--done' : '') + '">' +
      '<div class="progress__bar" data-fill="' + p + '"></div></div>';
  }

  /* ---------------- Views ---------------- */

  function viewHome() {
    var ov = overallStats();

    var variantCards = VARIANTS.map(function (v, i) {
      var st = variantStats(v);
      return '<a class="vcard" href="#/v/' + v.num + '"' + staggerStyle(i) + '>' +
        '<div class="vcard__num">0' + v.num + '</div>' +
        '<div class="vcard__body">' +
          '<div class="vcard__title">Нұсқа ' + v.num + '</div>' +
          '<div class="vcard__meta">20 сұрақ · әр пәннен 5 сұрақтан</div>' +
          '<div class="vcard__prog">' + progressHtml(st.known, st.total) +
            '<span class="vcard__count">' + st.known + '/' + st.total + '</span></div>' +
        '</div>' +
        '<div class="vcard__arrow">→</div>' +
      '</a>';
    }).join('');

    var bankRows = SUBJECTS.map(function (s, i) {
      var st = subjectStats(s.slug);
      return '<a class="brow" href="#/s/' + s.slug + '"' + staggerStyle(i) + '>' +
        '<div class="brow__name"><strong>' + esc(s.name) + '</strong><small>' + esc(s.ruName) + '</small></div>' +
        '<div class="brow__stats"><b>' + st.known + '</b> / ' + st.total + '</div>' +
        '<div class="brow__arrow">→</div>' +
      '</a>';
    }).join('');

    swapView(
      '<div class="hero">' +
        '<div class="overline">AI Institute by Seoultech · Қызылорда</div>' +
        '<h1>Рубежный контроль</h1>' +
        '<p class="lede">1-модуль, 1-семестр (2026). Әр нұсқада — 20 сұрақ: 100 сұрақтан кездейсоқ таңдалған, барлық пәндер қамтылған. Сұрақтар қазақ және орус тілдерінде.</p>' +
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
      '<div class="section">' +
        '<div class="section__head"><span class="section__title">Нұсқалар</span><span class="section__note">4 нұсқа · 20 сұрақтан</span></div>' +
        '<div class="variants stagger">' + variantCards + '</div>' +
      '</div>' +
      '<div class="section">' +
        '<div class="section__head"><span class="section__title">Сұрақтар банкi</span><span class="section__note">100 сұрақ</span></div>' +
        '<div class="bank stagger">' + bankRows + '</div>' +
      '</div>'
    );
  }

  function viewVariant(num) {
    var v = null;
    for (var i = 0; i < VARIANTS.length; i++) if (VARIANTS[i].num === num) v = VARIANTS[i];
    if (!v) { swapView('<div class="empty">Нұсқа табылмады</div>'); return; }

    var st = variantStats(v);
    var comp = SUBJECTS.map(function (s) {
      return '<li><span>' + esc(s.name) + '</span><span>5 сұрақ</span></li>';
    }).join('');

    swapView(
      '<a class="backlink" href="#/">← Басты бет</a>' +
      '<div class="exam-intro">' +
        '<div class="overline">Рубежный контроль</div>' +
        '<h1>Нұсқа ' + v.num + '</h1>' +
        '<p class="lede">20 сұрақ, әр пәннен 5 сұрақ. Әр сұраққа жауапты өз бетіңізше тексеріп, белгілеңіз.</p>' +
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
      startExam({ variant: v, title: 'Нұсқа ' + v.num, back: '#/v/' + v.num });
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
      '<div class="q-list stagger" id="qList"></div>'
    );

    var state = { filter: 'all', query: '' };

    function badge(q) {
      return q.answers > 1 ? ' <span class="qbadge">' + q.answers + ' жауап</span>' : '';
    }

    function renderList() {
      var list = s.questions.filter(function (q) {
        var m = marks[qid(slug, q.n)];
        if (state.filter === 'known' && m !== 'known') return false;
        if (state.filter === 'unknown' && m !== 'unknown') return false;
        if (state.query) {
          var hay = (q.kz + ' ' + (q.ru || '')).toLowerCase();
          if (hay.indexOf(state.query) === -1) return false;
        }
        return true;
      });

      var el = document.getElementById('qList');
      if (!list.length) {
        el.innerHTML = '<div class="empty">Бұл сүзгіде сұрақ жоқ</div>';
        return;
      }
      el.innerHTML = list.map(function (q) {
        var m = marks[qid(slug, q.n)];
        var cls = m === 'known' ? 'q--known' : (m === 'unknown' ? 'q--unknown' : '');
        return '<div class="q ' + cls + '">' +
          '<div class="q__num">' + q.n + '.</div>' +
          '<div class="q__body">' +
            '<div class="q__kz">' + esc(q.kz) + badge(q) + '</div>' +
            (q.ru ? '<div class="q__ru">' + esc(q.ru) + '</div>' : '') +
            '<div class="q__meta"><div class="q__marks">' +
              '<button class="markbtn markbtn--known ' + (m === 'known' ? 'active' : '') + '" data-q="' + q.n + '" data-v="known">✓ Білемін</button>' +
              '<button class="markbtn markbtn--unknown ' + (m === 'unknown' ? 'active' : '') + '" data-q="' + q.n + '" data-v="unknown">↻ Қайталаймын</button>' +
            '</div></div>' +
          '</div>' +
        '</div>';
      }).join('');
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
      var pool = s.questions.filter(function (q) { return marks[qid(slug, q.n)] === 'unknown'; });
      startExam({
        variant: null,
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
        '<p class="lede">Пән бойынша кездейсоқ сұрақтармен жатығыңыз. Нәтижелер жалпы прогресске жазылады.</p>' +
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
          '<button class="btn btn--ghost count-btn active" data-c="25">25 сұрақ</button>' +
        '</div>' +
        '<button class="btn btn--primary btn--big btn--block" id="startPracticeBtn">Бастау</button>' +
      '</div>'
    );

    var chosen = 25;
    document.querySelector('.count-row').addEventListener('click', function (e) {
      var b = e.target.closest('.count-btn');
      if (!b) return;
      chosen = parseInt(b.dataset.c, 10);
      document.querySelectorAll('.count-btn').forEach(function (c) { c.classList.remove('active'); });
      b.classList.add('active');
    });
    document.getElementById('startPracticeBtn').addEventListener('click', function () {
      var items = shuffle(s.questions).slice(0, chosen).map(function (q) { return { q: q, subject: s.slug }; });
      startExam({ variant: null, title: 'Практика · ' + s.name, back: '#/s/' + s.slug, items: items });
    });
  }

  /* ---------------- Экзамен ---------------- */

  var exam = null;

  function startExam(opts) {
    if (!opts.items) opts.items = opts.variant.items;
    if (!opts.items.length) {
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

    swapView(
      '<a class="backlink" href="' + exam.back + '">← Шығу</a>' +
      '<div class="exam-stage">' +
        '<div class="exam-meta">' +
          '<span>' + esc(exam.title) + '</span>' +
          '<span>' + (exam.index + 1) + ' / ' + exam.items.length + '</span>' +
        '</div>' +
        progressHtml(exam.index, exam.items.length) +
        '<div style="margin-top:22px">' +
          '<div class="exam-subj">' + esc(subj.name) + '</div>' +
          '<div class="exam-q">' + esc(q.kz) + (q.answers > 1 ? ' <span class="qbadge">' + q.answers + ' жауап</span>' : '') + '</div>' +
          (q.ru ? '<div class="exam-ru">' + esc(q.ru) + '</div>' : '') +
        '</div>' +
        '<div class="exam-ask">Бұл сұраққа толық жауап бере аласыз ба?</div>' +
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

    // разбивка по предметам
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
              '<div class="q__kz">' + esc(q.kz) + (q.answers > 1 ? ' <span class="qbadge">' + q.answers + ' жауап</span>' : '') + '</div>' +
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
      startExam({ variant: null, title: exam.title, back: exam.back, items: exam.items });
    });
    var mo = document.getElementById('missedOnlyBtn');
    if (mo) mo.addEventListener('click', function () {
      startExam({
        variant: null,
        title: exam.title + ' · қателер',
        back: exam.back,
        items: shuffle(missed)
      });
    });
    document.getElementById('homeBtn').addEventListener('click', function () {
      location.hash = '#/';
    });
  }

  /* ---------------- Роутер ---------------- */

  window.addEventListener('hashchange', route);
  route();
})();
