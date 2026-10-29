/* =====================================================================
   A Beautiful Accident, A Deliberate Choice — script.js
   Plain JavaScript. No libraries.
   ---------------------------------------------------------------------
   Things you might want to edit are all at the top:
     BACKGROUND       which photo fills the screen
     SOUNDTRACK       the five songs: files, titles, artists
     SONG_MAP         which song plays in which chapter / page
     ANSWER_MESSAGES  what she sees after tapping an answer
   The letter itself is in index.html (search "CHAPTER 1").
   ===================================================================== */

/* ---------------------------------------------------------------------
   BACKGROUND
   photo: the image that fills the whole screen behind everything.
   focus: which part of the photo to keep in view on phones, where the
          photo is cropped to fill the screen. "50% 25%" = centred
          horizontally, a little above the middle (good for faces).
   question: optional — a different photo just for the final question.
             Leave as '' to keep the same one.
   If you change "photo", also change the two <img class="bg__img">
   tags near the top of index.html so it shows even before this file loads.
   --------------------------------------------------------------------- */
const BACKGROUND = {
  photo: 'image1.jpg',
  focus: '50% 25%',
  question: ''
};

/* ---------------------------------------------------------------------
   SOUNDTRACK — put the MP3s in assets/music/ and type the real details.
   --------------------------------------------------------------------- */
const SOUNDTRACK = [
  { src: 'music5.mp3', title: 'Falling', artist: 'Harry Styles' },
  { src: 'music4.mp3', title: '', artist: 'Kotrell' },
  { src: 'music3.mp3', title: '', artist: 'Kotrell' },
  { src: 'music2.mp3', title: '', artist: 'Anendlessocen' },
  { src: 'music1.mp3', title: '', artist: 'Anendlessocean' }
];

/* ---------------------------------------------------------------------
   SONG_MAP — read it as: "in chapter X, from page Y onwards, play song Z".
   Chapter 1 changes song on page 3, "Then came the evening…", the
   moment he finds her photo.
   --------------------------------------------------------------------- */
const SONG_MAP = [
  { chapter: 1, fromPage: 1, song: 1 },   // welcome + the beginning
  { chapter: 1, fromPage: 3, song: 2 },   // how we met
  { chapter: 2, fromPage: 1, song: 3 },   // the unexpected journey
  { chapter: 3, fromPage: 1, song: 4 },   // the things I love about you
  { chapter: 4, fromPage: 1, song: 5 },   // the last chapter...
  { chapter: 'question', song: 5 }        // ...and the question
];

/* ---------------------------------------------------------------------
   ANSWER_MESSAGES — shown on her screen only. Nothing is sent anywhere.
   --------------------------------------------------------------------- */
const ANSWER_MESSAGES = {
  yes:  'That makes me so happy. This page can’t send your answer anywhere, so please tell me yourself, whenever you’re ready. I’ll be waiting.',
  talk: 'Thank you for being honest with me. There’s no rush and no pressure at all. Message me whenever you’re ready, and we’ll talk properly.'
};

/* Small settings */
const SETTINGS = {
  typewriter: true,       // types the title on the opening screen
  volume: 0.8,            // 0 to 1
  fadeOutMs: 700,
  fadeInMs: 1300,
  loopEachSong: true,     // keeps a chapter's song playing while she reads
  rememberProgress: true  // keeps unlocked chapters if she reloads or comes back
};

/* =====================================================================
   The machinery below — you shouldn't need to touch it.
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mq && mq.matches);
  const isLocal = location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/.test(location.hostname);

  const CHAPTER_COUNT = 4;

  /* ---------- storage (wrapped: some browsers block it) ---------- */
  const storage = (area, key) => ({
    get() { try { return JSON.parse(window[area].getItem(key)) || {}; } catch (e) { return {}; } },
    set(v) { try { window[area].setItem(key, JSON.stringify(v)); } catch (e) { /* unavailable */ } }
  });
  const progressStore = storage(SETTINGS.rememberProgress ? 'localStorage' : 'sessionStorage', 'abadc-progress');
  const musicStore = storage('sessionStorage', 'abadc-music');

  /* =================================================================
     Background
     ================================================================= */
  const Background = (() => {
    const bg = $('.bg');
    const imgs = $$('.bg__img', bg);
    let currentSrc = '';

    function set(src) {
      if (!src || src === currentSrc) return;
      const first = !currentSrc;
      currentSrc = src;
      const apply = () => imgs.forEach((img) => {
        img.classList.remove('is-missing');
        if (img.getAttribute('src') !== src) img.src = src;
      });
      if (first || reduced()) { apply(); return; }
      bg.classList.add('is-swapping');
      window.setTimeout(() => {
        apply();
        const done = () => bg.classList.remove('is-swapping');
        if (imgs[1].complete) done(); else imgs[1].addEventListener('load', done, { once: true });
        imgs[1].addEventListener('error', done, { once: true });
      }, 700);
    }

    function init() {
      document.documentElement.style.setProperty('--bg-focus', BACKGROUND.focus || '50% 25%');
      imgs.forEach((img) => {
        const fail = () => img.classList.add('is-missing');
        if (img.complete && img.naturalWidth === 0) fail();
        img.addEventListener('error', fail);
      });
      set(BACKGROUND.photo);
    }

    function scene(name) {
      bg.dataset.scene = name;
      set(name === 'question' && BACKGROUND.question ? BACKGROUND.question : BACKGROUND.photo);
    }

    return { init, scene };
  })();

  /* =================================================================
     Photos inside the letter: handle missing files quietly
     (placeholder while testing locally, hidden on the live site)
     ================================================================= */
  function initPhotos() {
    $$('.photo img').forEach((img) => {
      const fail = () => {
        const fig = img.closest('.photo');
        if (!fig) return;
        if (isLocal) fig.classList.add('is-missing'); else fig.hidden = true;
      };
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) fail();
      img.addEventListener('error', fail, { once: true });
    });
  }

  /* =================================================================
     Soundtrack — one <audio> element plays everything
     ================================================================= */
  const Player = (() => {
    const el = $('#player');
    const btnToggle = $('#player-toggle');
    const btnPrev = $('#player-prev');
    const btnNext = $('#player-next');
    const btnMute = $('#player-mute');
    const label = $('#player-label');
    const titleEl = $('#player-title');
    const announceEl = $('#player-announce');

    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = SETTINGS.loopEachSong;

    const volumeWorks = (() => { try { const a = new Audio(); a.volume = .5; return a.volume === .5; } catch (e) { return false; } })();

    const saved = musicStore.get();
    const s = {
      started: false,
      userPaused: !!saved.userPaused,
      muted: !!saved.muted,
      wanted: 0,
      loaded: -1,
      lastAuto: -1,
      status: 'idle',            // idle | loading | playing | paused | blocked | error
      failed: new Set()
    };
    let op = 0, fadeOp = 0, internal = false, timer = null, preloader = null;

    const save = () => musicStore.set({ userPaused: s.userPaused, muted: s.muted });
    const announce = (t) => { announceEl.textContent = ''; if (t) setTimeout(() => { announceEl.textContent = t; }, 60); };

    function fade(to, ms) {
      if (!volumeWorks || reduced() || ms <= 0) { if (volumeWorks) audio.volume = to; return Promise.resolve(); }
      const id = ++fadeOp, from = audio.volume, t0 = performance.now();
      return new Promise((res) => {
        const step = (now) => {
          if (id !== fadeOp) return res();
          const t = Math.min(1, (now - t0) / ms);
          audio.volume = Math.max(0, Math.min(1, from + (to - from) * t * (2 - t)));
          if (t < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }
    const quietPause = () => { internal = true; audio.pause(); internal = false; };

    function render() {
      const song = SOUNDTRACK[s.wanted] || {};
      const playing = s.status === 'playing' && !audio.paused;
      el.classList.toggle('is-playing', playing);
      el.classList.toggle('is-muted', s.muted);
      el.classList.toggle('is-error', s.status === 'error');
      el.classList.toggle('is-blocked', s.status === 'blocked');
      const n = `Song ${s.wanted + 1} of ${SOUNDTRACK.length}`;
      label.textContent = {
        idle: n,
        loading: `Loading · ${n}`,
        playing: `Now playing · ${n}`,
        paused: `Paused · ${n}`,
        blocked: 'Tap play to continue the music',
        error: 'This song couldn’t load'
      }[s.status] || n;
      const t = song.title || `Song ${s.wanted + 1}`;
      titleEl.textContent = song.artist ? `${t} — ${song.artist}` : t;
      btnToggle.setAttribute('aria-label', playing ? `Pause music: ${t}` : `Play music: ${t}`);
      btnMute.setAttribute('aria-label', s.muted ? 'Unmute' : 'Mute');
      btnMute.setAttribute('aria-pressed', String(s.muted));
    }

    function preloadNext() {
      const i = s.wanted + 1;
      if (i >= SOUNDTRACK.length || s.failed.has(i)) return;
      if (!preloader) {
        preloader = new Audio();
        preloader.preload = 'auto';
        preloader.muted = true;
        preloader.addEventListener('error', () => { const k = Number(preloader.dataset.i); if (!Number.isNaN(k)) s.failed.add(k); });
      }
      if (preloader.dataset.i !== String(i)) { preloader.dataset.i = String(i); preloader.src = SOUNDTRACK[i].src; }
    }

    async function sync() {
      if (!s.started || s.userPaused) { render(); return; }
      const my = ++op;
      const i = s.wanted;
      const song = SOUNDTRACK[i];
      if (!song || s.failed.has(i)) {
        if (!audio.paused) { await fade(0, 300); if (my !== op) return; quietPause(); }
        s.status = 'error'; render(); return;
      }
      if (s.loaded === i && !audio.paused) { s.status = 'playing'; render(); return; }
      if (!audio.paused && s.loaded !== i) {
        await fade(0, SETTINGS.fadeOutMs);
        if (my !== op) return;
        quietPause();
      }
      if (s.loaded !== i) { s.loaded = i; audio.src = song.src; }
      audio.muted = s.muted;
      if (volumeWorks) audio.volume = reduced() ? SETTINGS.volume : 0;
      s.status = 'loading'; render();
      try {
        await audio.play();
        if (my !== op) return;
        s.status = 'playing'; render();
        fade(SETTINGS.volume, SETTINGS.fadeInMs);
        preloadNext();
      } catch (err) {
        if (my !== op) return;
        if (err && err.name === 'AbortError') return;
        if (err && err.name === 'NotAllowedError') {
          s.status = 'blocked';
          announce('The browser paused the music. Tap play to continue.');
        } else {
          s.failed.add(i);
          s.status = 'error';
          announce('This song couldn’t load. The letter works without it.');
        }
        render();
      }
    }

    // The story asks for a song (chapter/page changed). Ignores repeats,
    // so if she skipped to another song herself, page turns won't undo it.
    function auto(index) {
      if (index == null || index === s.lastAuto) return;
      s.lastAuto = index;
      if (index === s.wanted) return;
      s.wanted = index;
      if (s.status === 'error' || s.status === 'blocked') s.status = s.started && !s.userPaused ? s.status : 'paused';
      render();
      clearTimeout(timer);
      if (!s.started || s.userPaused) { if (s.started) { s.status = 'paused'; render(); } return; }
      timer = setTimeout(sync, 500);
    }

    // First deliberate tap: "Begin our story"
    function begin(index) {
      s.started = true;
      s.userPaused = false;
      s.wanted = index; s.lastAuto = index;
      s.failed.delete(index);
      save(); show(); sync();
    }

    async function toggle() {
      clearTimeout(timer);
      if (s.status === 'playing' && !audio.paused) {
        s.userPaused = true; save();
        const my = ++op;
        s.status = 'paused'; render();
        await fade(0, 250);
        if (my !== op) return;
        quietPause(); render();
      } else {
        s.started = true; s.userPaused = false;
        s.failed.delete(s.wanted);
        save(); sync();
      }
    }

    function skip(step) {
      clearTimeout(timer);
      s.wanted = (s.wanted + step + SOUNDTRACK.length) % SOUNDTRACK.length;
      s.failed.delete(s.wanted);
      s.started = true; s.userPaused = false; save();
      sync();
    }

    function show() {
      if (el.classList.contains('is-visible')) return;
      el.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
    }

    function init() {
      btnToggle.addEventListener('click', toggle);
      btnPrev.addEventListener('click', () => skip(-1));
      btnNext.addEventListener('click', () => skip(1));
      btnMute.addEventListener('click', () => { s.muted = !s.muted; audio.muted = s.muted; save(); render(); });

      audio.addEventListener('error', () => {
        if (s.loaded < 0 || !audio.getAttribute('src')) return;
        s.failed.add(s.loaded);
        if (s.loaded === s.wanted) { s.status = 'error'; render(); }
      });
      audio.addEventListener('playing', () => { if (!s.userPaused) { s.status = 'playing'; render(); } });
      audio.addEventListener('waiting', () => { if (s.status === 'playing') { s.status = 'loading'; render(); } });
      audio.addEventListener('pause', () => {   // paused from outside (headphones, lock screen)
        if (internal || audio.ended) return;
        if (s.status === 'playing' || s.status === 'loading') { s.userPaused = true; s.status = 'paused'; save(); render(); }
      });
      audio.addEventListener('ended', () => { if (!audio.loop) skip(1); });
      render();
    }

    return { init, begin, auto, show };
  })();

  function songFor(chapter, page) {
    let found = null;
    SONG_MAP.forEach((m) => {
      if (m.chapter !== chapter) return;
      if (chapter === 'question' || (m.fromPage || 1) <= page) found = m.song;
    });
    return found == null ? null : found - 1;
  }

  /* =================================================================
     Progress: which chapters are open / finished
     ================================================================= */
  const Progress = (() => {
    const saved = progressStore.get();
    const p = {
      unlocked: Math.min(5, Math.max(1, Number(saved.unlocked) || 1)),
      done: new Set(Array.isArray(saved.done) ? saved.done : []),
      seenQuestion: !!saved.seenQuestion
    };
    const save = () => progressStore.set({ unlocked: p.unlocked, done: [...p.done], seenQuestion: p.seenQuestion });
    return {
      get unlocked() { return p.unlocked; },
      get seenQuestion() { return p.seenQuestion; },
      isDone: (n) => p.done.has(n),
      finish(n) { p.done.add(n); p.unlocked = Math.max(p.unlocked, Math.min(5, n + 1)); save(); },
      sawQuestion() { p.seenQuestion = true; p.unlocked = 5; p.done.add(5); save(); }
    };
  })();

  /* =================================================================
     Scenes
     ================================================================= */
  const Scenes = (() => {
    const all = {
      opening: $('#opening'),
      map: $('#map'),
      reader: $('#reader'),
      question: $('#question')
    };
    let current = 'opening';
    let busy = null;

    function show(name, after) {
      if (name === current) { if (after) after(); return; }
      const from = all[current];
      const to = all[name];
      clearTimeout(busy);
      const swap = () => {
        from.classList.remove('is-active', 'is-leaving');
        to.classList.add('is-active');
        current = name;
        Background.scene(name);
        window.scrollTo(0, 0);
        if (after) after();
      };
      if (reduced()) { swap(); return; }
      from.classList.add('is-leaving');
      busy = setTimeout(swap, 420);
    }
    return { show, get current() { return current; } };
  })();

  /* =================================================================
     Opening: typewriter title, then the rest fades in
     ================================================================= */
  function initOpening(onBegin) {
    const lines = $$('[data-type]');
    const later = $$('.opening > *:not(.opening__title):not(.opening__eyebrow)');
    const btn = $('#begin');

    btn.addEventListener('click', (e) => { e.preventDefault(); onBegin(); });

    if (!SETTINGS.typewriter || reduced()) return;

    later.forEach((n) => n.classList.add('reveal-later'));
    const texts = lines.map((l) => l.textContent.trim());
    lines.forEach((l) => { l.textContent = ''; });
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');

    let li = 0, ci = 0;
    const tick = () => {
      if (li >= lines.length) {
        setTimeout(() => caret.remove(), 900);
        later.forEach((n, k) => setTimeout(() => n.classList.add('is-in'), 250 + k * 180));
        return;
      }
      const line = lines[li];
      ci++;
      line.textContent = texts[li].slice(0, ci);
      line.appendChild(caret);
      if (ci >= texts[li].length) { li++; ci = 0; setTimeout(tick, 380); }
      else setTimeout(tick, 42 + Math.random() * 40);
    };
    setTimeout(tick, 600);
  }

  /* =================================================================
     Chapter map
     ================================================================= */
  const MapView = (() => {
    const tiles = $$('.tile');
    const hint = $('#map-hint');
    const lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

    function render(highlight) {
      tiles.forEach((tile, idx) => {
        const n = idx + 1;
        const name = $('.tile__name', tile).textContent;
        const state = $('.tile__state', tile);
        const locked = n > Progress.unlocked;
        const done = n === 5 ? Progress.seenQuestion : Progress.isDone(n);
        tile.classList.toggle('is-locked', locked);
        tile.classList.toggle('is-done', !locked && done);
        tile.classList.toggle('is-open', !locked && !done);
        tile.classList.remove('is-new');
        tile.setAttribute('aria-disabled', String(locked));
        if (locked) {
          state.innerHTML = lock + 'Locked';
          tile.setAttribute('aria-label', `${n}. ${name}. Locked until you finish part ${n - 1}.`);
        } else if (done) {
          state.innerHTML = tick + (n === 5 ? 'Read again' : 'Read again');
          tile.setAttribute('aria-label', `${n}. ${name}. Read. Open again.`);
        } else {
          state.textContent = 'Open';
          tile.setAttribute('aria-label', `${n}. ${name}. Open.`);
        }
        if (highlight === n) tile.classList.add('is-new');
      });
      const u = Progress.unlocked;
      if (Progress.seenQuestion) hint.textContent = 'You’ve read it all. Open any part again, any time.';
      else if (u === 1) hint.textContent = 'Start with the first one.';
      else if (u === 5) hint.textContent = 'There’s one more thing I want to ask you.';
      else hint.textContent = `Part ${u} is open now.`;
    }

    function init(onOpen) {
      tiles.forEach((tile, idx) => {
        tile.addEventListener('click', () => {
          const n = idx + 1;
          if (n > Progress.unlocked) {
            hint.textContent = `Finish part ${Progress.unlocked} first. It’s worth the wait.`;
            return;
          }
          onOpen(n);
        });
      });
    }

    function focusTile(n) {
      const t = tiles[(n || 1) - 1];
      if (t) try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); }
    }

    return { init, render, focusTile };
  })();

  /* =================================================================
     Reader: one chapter, one page at a time
     ================================================================= */
  const Reader = (() => {
    const chapters = $$('.chapter');
    const scroller = $('#reader-scroll');
    const where = $('#reader-where');
    const prev = $('#page-prev');
    const next = $('#page-next');
    const nextLabel = $('#page-next-label');
    const dots = $('#page-dots');
    const status = $('#page-status');
    const positions = {};
    let ch = 1, page = 0, pages = [], onFinish = null;

    function chapterEl(n) { return chapters[n - 1]; }

    function open(n, startPage) {
      ch = n;
      chapters.forEach((c, i) => c.classList.toggle('is-current', i === n - 1));
      pages = $$('.page', chapterEl(n));
      dots.innerHTML = '';
      pages.forEach(() => dots.appendChild(document.createElement('i')));
      go(typeof startPage === 'number' ? startPage : (positions[n] || 0), 0, true);
    }

    function go(p, dir, first) {
      page = Math.max(0, Math.min(pages.length - 1, p));
      positions[ch] = page;
      const chap = chapterEl(ch);
      chap.classList.toggle('is-first-page', page === 0);
      pages.forEach((pg, i) => {
        pg.classList.toggle('is-current', i === page);
        pg.classList.toggle('from-left', i === page && dir < 0);
        if (i === page) { pg.style.animation = 'none'; void pg.offsetWidth; pg.style.animation = ''; }
      });
      // Load the next page's photo early so it's ready
      const nxt = pages[page + 1];
      if (nxt) $$('img', nxt).forEach((img) => { img.loading = 'eager'; });

      $$('i', dots).forEach((d, i) => {
        d.classList.toggle('is-current', i === page);
        d.classList.toggle('is-done', i < page);
      });

      const title = $('.chapter__title', chap).textContent;
      where.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = `Chapter ${ch}`;
      where.append(b, document.createTextNode(` · ${title} · ${page + 1}/${pages.length}`));
      status.textContent = `Chapter ${ch}, page ${page + 1} of ${pages.length}`;

      prev.disabled = page === 0;
      const last = page === pages.length - 1;
      next.classList.toggle('is-final', last);
      nextLabel.textContent = last ? (ch === CHAPTER_COUNT ? 'To the question' : 'Finish chapter') : 'Next';

      scroller.scrollTop = 0;
      if (!first) try { scroller.focus({ preventScroll: true }); } catch (e) { /* ignore */ }

      Player.auto(songFor(ch, page + 1));
    }

    function forward() {
      if (page < pages.length - 1) go(page + 1, 1);
      else if (onFinish) { positions[ch] = 0; onFinish(ch); }
    }
    function back() { if (page > 0) go(page - 1, -1); }

    function init(handlers) {
      onFinish = handlers.finish;
      next.addEventListener('click', forward);
      prev.addEventListener('click', back);
      $('#reader-close').addEventListener('click', handlers.close);

      document.addEventListener('keydown', (e) => {
        if (Scenes.current !== 'reader' || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); forward(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
        else if (e.key === 'Escape') { e.preventDefault(); handlers.close(); }
      });

      // Swipe left / right to turn pages
      let x0 = null, y0 = 0;
      scroller.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { x0 = null; return; }
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      }, { passive: true });
      scroller.addEventListener('touchend', (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) (dx < 0 ? forward : back)();
      }, { passive: true });
    }

    return { init, open, get chapter() { return ch; } };
  })();

  /* =================================================================
     The question
     ================================================================= */
  const Question = (() => {
    const scene = $('#question');
    const lines = $$('.q-line', scene);
    const delays = [0, .7, 2.0, 3.3, 4.2, 5.0, 6.2, 7.0];

    function reveal() {
      scene.classList.remove('is-revealing', 'is-revealed');
      if (Progress.seenQuestion || reduced()) { scene.classList.add('is-revealed'); return; }
      lines.forEach((l, i) => l.style.setProperty('--d', `${delays[Math.min(i, delays.length - 1)]}s`));
      void scene.offsetWidth;
      scene.classList.add('is-revealing');
    }

    function init(onAgain) {
      const msg = $('#answer-message');
      const buttons = $$('[data-answer]', scene);
      buttons.forEach((btn) => btn.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        msg.textContent = '';
        void msg.offsetWidth;
        msg.textContent = ANSWER_MESSAGES[btn.dataset.answer] || '';
      }));
      $('#read-again').addEventListener('click', onAgain);
    }

    return { init, reveal };
  })();

  /* =================================================================
     Wiring it together (+ phone Back button support)
     ================================================================= */
  function start() {
    Background.init();
    initPhotos();
    Player.init();

    const goMap = (highlight, push = true) => {
      MapView.render(highlight);
      Scenes.show('map', () => {
        Player.show();
        MapView.focusTile(highlight || Progress.unlocked);
      });
      if (push) setHash('map');
    };

    const goChapter = (n, push = true) => {
      Scenes.show('reader', () => Reader.open(n));
      Player.show();
      if (push) setHash(`chapter-${n}`);
    };

        // Always start on the opening screen so the first tap can start the music
    if (location.hash && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    Background.scene('opening');

    const goQuestion = (push = true) => {
      Player.show();
      Player.auto(songFor('question'));
      Scenes.show('question', () => {
        Question.reveal();
        Progress.sawQuestion();
        const h = $('#the-question');
        h.setAttribute('tabindex', '-1');
        try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      });
      if (push) setHash('question');
    };

    function setHash(h) {
      if (!history.pushState) return;
      if (location.hash === `#${h}`) return;
      history.pushState({ scene: h }, '', `#${h}`);
    }

    function route() {
      const h = location.hash.replace('#', '');
      if (!h || h === 'opening') { Scenes.show('opening'); return; }
      if (h === 'map') { goMap(null, false); return; }
      if (h === 'question') { if (Progress.unlocked >= 5) goQuestion(false); else goMap(null, false); return; }
      const m = h.match(/^chapter-(\d)$/);
      if (m) {
        const n = Number(m[1]);
        if (n >= 1 && n <= CHAPTER_COUNT && n <= Progress.unlocked) goChapter(n, false);
        else goMap(null, false);
      }
    }
    window.addEventListener('popstate', route);

    initOpening(() => {
      Player.begin(songFor(1, 1));
      goMap(Progress.unlocked === 1 ? 1 : null);
    });

    MapView.init((n) => (n === 5 ? goQuestion() : goChapter(n)));

    Reader.init({
      close: () => goMap(),
      finish: (n) => {
        const firstTime = !Progress.isDone(n);
        Progress.finish(n);
        if (n === CHAPTER_COUNT) goQuestion();
        else goMap(firstTime ? n + 1 : null);
      }
    });

    Question.init(() => goMap());

    // Always start on the opening screen so the first tap can start the music
    if (location.hash && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    Background.scene('opening');
        // Start song 1 as soon as the landing page opens
    Player.begin(songFor(1, 1));

    // If the browser blocks it, start it on her first tap or key press anywhere
    const startOnFirstTouch = () => {
      Player.begin(songFor(1, 1));
      ['pointerdown', 'keydown'].forEach((t) => document.removeEventListener(t, startOnFirstTouch, true));
    };
    ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, startOnFirstTouch, true));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
