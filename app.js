/* AI Institute by Seoultech — сұрақтарға дайындық
 * SPA, без сборки. Данные: data.js (window.SUBJECTS).
 * Прогресс хранится в localStorage.
 */
(function () {
  'use strict';

  var SUBJECTS = window.SUBJECTS || [];
  var LS_KEY = 'seoultech-prep:marks:v1';
  var app = document.getElementById('app');

  /* ---------------- Хранилище отметок ---------------- */

  function loadMarks() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveMarks(marks) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(marks));
    } catch (e) { /* приватный режим — просто не сохраняем */ }
  }

  var marks = loadMarks();

  function qid(slug, n) { return slug + '-' + n; }

  function setMark(slug, n, value) { // 'known' | 'unknown' | null
    var id = qid(slug, n);
    if (value === null) delete marks[id];
    else marks[id] = value;
    saveMarks(marks);
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

  function bySlug(slug) {
    for (var i = 0; i < SUBJECTS.length; i++) if (SUBJECTS[i].slug === slug) return SUBJECTS[i];
    return null;
  }

  /* ---------------- Утилиты ---------------- */

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pct(part, total) {
    return total ? Math.round((part / total) * 100) : 0;
  }

  /* ---------------- Views ---------------- */

  function viewHome() {
    var totalQ = 0, totalKnown = 0;
    SUBJECTS.forEach(function (s) {
      var st = subjectStats(s.slug);
      totalQ += st.total;
      totalKnown += st.known;
    });

    var cards = SUBJECTS.map(function (s) {
      var st = subjectStats(s.slug);
      var p = pct(st.known, st.total);
      return '' +
        '<a class="card" href="#/s/' + s.slug + '">' +
          '<div class="card__head">' +
            '<div class="card__icon">' + s.icon + '</div>' +
            '<div class="card__titles">' +
              '<div class="card__title">' + esc(s.name) + '</div>' +
              '<div class="card__subtitle">' + esc(s.ruName) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="progress progress--slim"><div class="progress__bar" style="width:' + p + '%"></div></div>' +
          '<div class="card__stats">' +
            '<span>Сұрақтар: <b>' + st.total + '</b></span>' +
            '<span class="ok">✓ ' + st.known + '</span>' +
            '<span>↻ ' + st.unknown + '</span>' +
          '</div>' +
          '<div class="card__actions">' +
            '<span class="btn btn--ghost btn--sm">Сұрақтар</span>' +
            '<span class="btn btn--primary btn--sm">Тест бастау</span>' +
          '</div>' +
        '</a>';
    }).join('');

    app.innerHTML =
      '<div class="hero">' +
        '<h1>Дайындық орталығы</h1>' +
        '<p>Аралық бақылау мен сессияға дайындалу · 1-модуль, 1-семестр (2026)</p>' +
      '</div>' +
      '<div class="overall">' +
        '<div class="overall__row">' +
          '<span class="overall__title">Жалпы прогресс</span>' +
          '<span class="overall__num">' + totalKnown + ' / ' + totalQ + ' (' + pct(totalKnown, totalQ) + '%)</span>' +
        '</div>' +
        '<div class="progress ' + (totalKnown === totalQ ? 'progress--green' : '') + '">' +
          '<div class="progress__bar" style="width:' + pct(totalKnown, totalQ) + '%"></div>' +
        '</div>' +
        '<div class="overall__hint">Сұраққа дөңгелек батырмалармен белгі қою: ✓ — білемін, ↻ — қайталау керек</div>' +
      '</div>' +
      '<div class="subjects">' + cards + '</div>';
  }

  function viewSubject(slug, tab) {
    var s = bySlug(slug);
    if (!s) { app.innerHTML = '<div class="empty">Пән табылмады</div>'; return; }

    if (tab === 'test') { viewTestSetup(s); return; }

    var st = subjectStats(slug);
    var p = pct(st.known, st.total);

    app.innerHTML =
      '<a class="backlink" href="#/">← Барлық пәндер</a>' +
      '<div class="page-head">' +
        '<h1>' + s.icon + ' ' + esc(s.name) + '</h1>' +
        '<div class="sub">' + esc(s.ruName) + ' · ' + st.known + '/' + st.total + ' сұрақ білінді</div>' +
      '</div>' +
      '<div class="progress" style="margin-bottom:16px"><div class="progress__bar" style="width:' + p + '%"></div></div>' +
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
      '<div class="q-list" id="qList"></div>';

    var state = { filter: 'all', query: '' };

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

      if (!list.length) {
        document.getElementById('qList').innerHTML = '<div class="empty">Бұл сүзгіде сұрақ жоқ</div>';
        return;
      }

      document.getElementById('qList').innerHTML = list.map(function (q) {
        var m = marks[qid(slug, q.n)];
        var cls = m === 'known' ? 'q--known' : (m === 'unknown' ? 'q--unknown' : '');
        var blockBadge = q.block ? '<span class="q__block">бөлім ' + q.block + '</span>' : '';
        return '' +
          '<div class="q ' + cls + '">' +
            '<div class="q__num">' + q.n + '</div>' +
            '<div class="q__body">' +
              '<div class="q__kz">' + esc(q.kz) + blockBadge + '</div>' +
              (q.ru ? '<div class="q__ru">' + esc(q.ru) + '</div>' : '') +
              '<div class="q__marks">' +
                '<button class="markbtn markbtn--known ' + (m === 'known' ? 'active' : '') + '" data-q="' + q.n + '" data-v="known">✓ Білемін</button>' +
                '<button class="markbtn markbtn--unknown ' + (m === 'unknown' ? 'active' : '') + '" data-q="' + q.n + '" data-v="unknown">↻ Қайталаймын</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      }).join('');
    }

    function refreshCounts() {
      var st2 = subjectStats(slug);
      var chips = document.querySelectorAll('#filters .chip');
      chips.forEach(function (chip) {
        var cnt = chip.querySelector('.cnt');
        if (!cnt) return;
        if (chip.dataset.f === 'all') cnt.textContent = st2.total;
        if (chip.dataset.f === 'known') cnt.textContent = st2.known;
        if (chip.dataset.f === 'unknown') cnt.textContent = st2.unknown;
      });
      var sub = document.querySelector('.page-head .sub');
      if (sub) sub.textContent = s.ruName + ' · ' + st2.known + '/' + st2.total + ' сұрақ білінді';
      var bar = document.querySelector('.progress .progress__bar');
      if (bar) bar.style.width = pct(st2.known, st2.total) + '%';
      var rb = document.getElementById('reviewBtn');
      if (rb) {
        if (st2.unknown > 0) rb.textContent = 'Тек қайталау (' + st2.unknown + ')';
        else { rb.remove(); }
      }
    }

    document.getElementById('qList').addEventListener('click', function (e) {
      var btn = e.target.closest('.markbtn');
      if (!btn) return;
      var n = parseInt(btn.dataset.q, 10);
      var v = btn.dataset.v;
      var cur = marks[qid(slug, n)];
      setMark(slug, n, cur === v ? null : v);
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

    var tabs = document.querySelector('.tabs');
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      location.hash = b.dataset.tab === 'test' ? '#/s/' + slug + '/test' : '#/s/' + slug;
    });

    var rb = document.getElementById('reviewBtn');
    if (rb) rb.addEventListener('click', function () {
      startTest(s, s.questions.filter(function (q) { return marks[qid(slug, q.n)] === 'unknown'; }), 'Қайталау тесті');
    });

    renderList();
  }

  /* ---------------- Тест режимы ---------------- */

  var testState = null;

  function viewTestSetup(s) {
    var st = subjectStats(s.slug);
    app.innerHTML =
      '<a class="backlink" href="#/s/' + s.slug + '">← ' + esc(s.name) + '</a>' +
      '<div class="test-setup">' +
        '<h2>' + s.icon + ' Тест режимі</h2>' +
        '<p>Сұрақ беріледі — өз бетіңізше жауаптап, белгілеңіз. Нәтижелер прогресске жазылады.</p>' +
        '<div class="count-row" id="countRow">' +
          '<button class="count-btn" data-c="5">5 сұрақ</button>' +
          '<button class="count-btn" data-c="10">10 сұрақ</button>' +
          '<button class="count-btn active" data-c="' + Math.min(25, st.total) + '">25 сұрақ</button>' +
        '</div>' +
        '<button class="btn btn--primary btn--big" id="startTestBtn">Тестті бастау</button>' +
        (st.unknown > 0 ? '<div style="margin-top:10px"><button class="btn btn--ghost" id="reviewOnlyBtn">Тек қайталауға (' + st.unknown + ')</button></div>' : '') +
      '</div>';

    var chosen = Math.min(25, st.total);
    document.getElementById('countRow').addEventListener('click', function (e) {
      var b = e.target.closest('.count-btn');
      if (!b) return;
      chosen = parseInt(b.dataset.c, 10);
      document.querySelectorAll('.count-btn').forEach(function (c) { c.classList.remove('active'); });
      b.classList.add('active');
    });
    document.getElementById('startTestBtn').addEventListener('click', function () {
      startTest(s, shuffle(s.questions).slice(0, chosen));
    });
    var ro = document.getElementById('reviewOnlyBtn');
    if (ro) ro.addEventListener('click', function () {
      var pool = s.questions.filter(function (q) { return marks[qid(s.slug, q.n)] === 'unknown'; });
      startTest(s, pool, 'Қайталау тесті');
    });
  }

  function startTest(s, pool, title) {
    if (!pool || !pool.length) {
      app.innerHTML = '<a class="backlink" href="#/s/' + s.slug + '">← ' + esc(s.name) + '</a><div class="empty">Тестке сұрақ қалмады 🎉</div>';
      return;
    }
    testState = {
      subject: s,
      title: title || 'Тест',
      questions: pool,
      index: 0,
      results: []
    };
    renderTestQuestion();
  }

  function renderTestQuestion() {
    var t = testState;
    var q = t.questions[t.index];
    var st = subjectStats(t.subject.slug);
    app.innerHTML =
      '<a class="backlink" href="#/s/' + t.subject.slug + '">← Шығу</a>' +
      '<div class="test-stage">' +
        '<div class="test-meta">' +
          '<span>' + esc(t.title) + ' · ' + esc(t.subject.name) + '</span>' +
          '<span>' + (t.index + 1) + ' / ' + t.questions.length + '</span>' +
        '</div>' +
        '<div class="test-progress"><div class="progress"><div class="progress__bar" style="width:' + pct(t.index, t.questions.length) + '%"></div></div></div>' +
        '<div class="test-q">' + q.n + '. ' + esc(q.kz) + (q.block ? ' <span class="q__block">бөлім ' + q.block + '</span>' : '') + '</div>' +
        (q.ru ? '<div class="test-ru">' + esc(q.ru) + '</div>' : '') +
        '<div class="test-ask">Бұл сұраққа толық жауап бере аласыз ба?</div>' +
        '<div class="test-actions">' +
          '<button class="btn btn--primary btn--big" id="answerKnown" style="background:var(--green)">✓ Иә, білемін</button>' +
          '<button class="btn btn--ghost btn--big" id="answerUnknown" style="color:var(--amber);border-color:#f0d9b5">↻ Жоқ, қайталаймын</button>' +
        '</div>' +
      '</div>';

    document.getElementById('answerKnown').addEventListener('click', function () { answer(true); });
    document.getElementById('answerUnknown').addEventListener('click', function () { answer(false); });
  }

  function answer(known) {
    var t = testState;
    var q = t.questions[t.index];
    t.results.push({ q: q, known: known });
    setMark(t.subject.slug, q.n, known ? 'known' : 'unknown');
    t.index++;
    if (t.index < t.questions.length) renderTestQuestion();
    else renderTestResult();
  }

  function renderTestResult() {
    var t = testState;
    var known = t.results.filter(function (r) { return r.known; }).length;
    var total = t.results.length;
    var missed = t.results.filter(function (r) { return !r.known; }).map(function (r) { return r.q; });
    var p = pct(known, total);

    var emoji = p === 100 ? '🏆' : (p >= 80 ? '🎉' : (p >= 50 ? '💪' : '📚'));
    var msg = p === 100
      ? 'Нақ соғылдың! Барлығы дұрыс.'
      : (p >= 80 ? 'Керемет! Тек бірнеше сұрақты қайталаңыз.'
        : (p >= 50 ? 'Жақсы бастама. Аяқталмаған сұрақтарды қайталап шығыңыз.'
          : 'Қорықпаңыз — қайталау тестін басып, қателерді жабуға дейін жалғасаңыз.'));

    var missedHtml = '';
    if (missed.length) {
      missedHtml =
        '<div class="result__missed"><h3>Қайталауға қалған (' + missed.length + '):</h3>' +
        missed.map(function (q) {
          return '<div class="q"><div class="q__num">' + q.n + '</div><div class="q__body">' +
            '<div class="q__kz">' + esc(q.kz) + '</div>' +
            (q.ru ? '<div class="q__ru">' + esc(q.ru) + '</div>' : '') +
            '</div></div>';
        }).join('') + '</div>';
    }

    app.innerHTML =
      '<a class="backlink" href="#/s/' + t.subject.slug + '">← ' + esc(t.subject.name) + '</a>' +
      '<div class="test-stage"><div class="result">' +
        '<div class="result__emoji">' + emoji + '</div>' +
        '<h2>' + esc(t.title) + ' аяқталды</h2>' +
        '<div class="result__score">' + known + ' / ' + total + '</div>' +
        '<p>' + msg + '</p>' +
        missedHtml +
        '<div class="result__actions">' +
          '<button class="btn btn--primary" id="againBtn">Қайта бастау</button>' +
          (missed.length >= 2 ? '<button class="btn btn--ghost" id="missedOnlyBtn">Тек қателерді (' + missed.length + ')</button>' : '') +
          '<button class="btn btn--ghost" id="toListBtn">Сұрақтарға оралу</button>' +
        '</div>' +
      '</div></div>';

    document.getElementById('againBtn').addEventListener('click', function () {
      startTest(t.subject, shuffle(t.questions));
    });
    var mo = document.getElementById('missedOnlyBtn');
    if (mo) mo.addEventListener('click', function () {
      startTest(t.subject, shuffle(missed), 'Қайталау тесті');
    });
    document.getElementById('toListBtn').addEventListener('click', function () {
      location.hash = '#/s/' + t.subject.slug;
    });
  }

  /* ---------------- Роутер ---------------- */

  function route() {
    var hash = location.hash || '#/';
    var m = hash.match(/^#\/s\/([a-z-]+)(?:\/(test))?/);
    if (m) {
      viewSubject(m[1], m[2] === 'test' ? 'test' : 'list');
    } else {
      viewHome();
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  route();
})();
