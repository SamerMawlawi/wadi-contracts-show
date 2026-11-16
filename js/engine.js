/* engine.js — beats, navigation, keys, overlays, presenter link.
 *
 * The whole show is ONE paused GSAP timeline ("master"). A beat is a time on it where the
 * show stops and waits for a click. Next tweens the timeline's time forward to the next
 * beat; Back tweens it backward. Nothing else ever plays by itself.
 *
 * Modes (index.html?mode=...):  show (default) | mirror | preview | thumb
 *   mirror/preview live inside the presenter view; thumb is used by the snapshot maker.
 *   Embedded copies ignore keyboard and mouse and take orders through postMessage.
 */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var MODE = qs.get('mode') || 'show';
  var EMBED = MODE !== 'show';
  var LITE = qs.has('lite');
  var BACK_SPEED = 1.8;

  var Deck = window.Deck = window.Deck || {};
  Deck.mode = MODE; Deck.embedded = EMBED; Deck.lite = LITE;
  Deck.extras = Deck.extras || [];     // functions (B) that add scenes after deck.js
  Deck.slots = Deck.slots || {};       // name -> [functions (B)] called where deck.js says B.slot(name)
  Deck.slot = function (name, fn) { (Deck.slots[name] = Deck.slots[name] || []).push(fn); };

  var $ = function (id) { return document.getElementById(id); };
  var master = null, beats = [], scenes = [], cur = 0, anim = null, buildFn = null, started = false;
  var cloud = null;

  /* ------------------------------------------------------------------ watchers */
  // The timeline tweens plain objects; a watcher redraws when their values change.
  var watchers = [];
  function sig(o) { var s = '', k, v; for (k in o) { v = o[k]; if (typeof v === 'number' || typeof v === 'string') s += v + '|'; } return s; }
  Deck.watch = function (obj, draw) { watchers.push({ o: obj, f: draw, s: null }); return obj; };
  function runWatchers(force) {
    for (var i = 0; i < watchers.length; i++) {
      var w = watchers[i], s = sig(w.o);
      if (force === true || s !== w.s) { w.s = s; w.f(w.o); }
    }
  }

  /* ------------------------------------------------------------------ text helpers */
  var ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

  // Wrap words (and Latin letters) in spans for staggered text.
  // Arabic words are never cut into letters: that would break the joined script.
  // Returns { words: [...], chars: [...] }  (for an Arabic word, its "char" is the whole word).
  Deck.split = function (el) {
    var words = [], chars = [];
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = document.createDocumentFragment();
          ch.nodeValue.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var wi = document.createElement('span'); wi.className = 'wi'; w.appendChild(wi);
            if (ARABIC.test(tok)) { wi.textContent = tok; chars.push(wi); }
            else { wi.className = 'wi lat'; Array.from(tok).forEach(function (c) {
              var s = document.createElement('span'); s.className = 'c'; s.textContent = c; wi.appendChild(s); chars.push(s);
            }); }
            words.push(wi); frag.appendChild(w);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
      });
    }
    walk(el);
    return { words: words, chars: chars };
  };

  // Typewriter that never shifts the layout: the full text is laid out from the start and
  // each word is uncovered in its own writing direction. Tween the returned state: { p: 0 -> 1 }.
  Deck.typer = function (el) {
    var units = [], total = 0;
    var text = el.textContent; el.textContent = '';
    text.split(/(\s+)/).forEach(function (tok) {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(' ')); return; }
      var s = document.createElement('span'); s.className = 'tw'; s.textContent = tok; el.appendChild(s);
      var len = Array.from(tok).length;
      units.push({ el: s, start: total, len: len, rtl: ARABIC.test(tok) }); total += len;
    });
    return Deck.watch({ p: 0 }, function (st) {
      var pos = st.p * total;
      units.forEach(function (u) {
        var f = Math.max(0, Math.min(1, (pos - u.start) / u.len));
        if (f <= 0) { u.el.style.visibility = 'hidden'; u.el.style.clipPath = ''; }
        else if (f >= 1) { u.el.style.visibility = 'visible'; u.el.style.clipPath = ''; }
        else {
          var cut = ((1 - f) * 100).toFixed(1) + '%';
          u.el.style.visibility = 'visible';
          u.el.style.clipPath = u.rtl ? 'inset(-40% 0 -40% ' + cut + ')' : 'inset(-40% ' + cut + ' -40% 0)';
        }
      });
    });
  };

  // Random glyphs resolve into the text. Layout is held by an invisible copy. State: { p: 0 -> 1 }.
  Deck.decode = function (el) {
    var text = el.textContent, arr = Array.from(text);
    var AR = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي', LA = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&<>/';
    el.textContent = ''; el.classList.add('dc');
    var hold = document.createElement('span'); hold.className = 'dc-hold'; hold.textContent = text;
    var live = document.createElement('span'); live.className = 'dc-live';
    el.appendChild(hold); el.appendChild(live);
    return Deck.watch({ p: 0 }, function (st) {
      if (st.p >= 1) { hold.style.visibility = 'visible'; live.textContent = ''; return; }
      hold.style.visibility = 'hidden';
      if (st.p <= 0) { live.textContent = ''; return; }
      var k = Math.floor(st.p * arr.length), out = '';
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (i < k || /\s/.test(c)) out += c;
        else if (i > k + 6) out += ' ';
        else { var pool = ARABIC.test(c) ? AR : LA; out += pool[Math.floor(Math.random() * pool.length)]; }
      }
      live.textContent = out;
    });
  };

  // Animated number. State: { v: number }.  format(v) returns the text to show.
  Deck.counter = function (el, format) {
    return Deck.watch({ v: 0 }, function (st) { el.textContent = format ? format(st.v) : String(Math.round(st.v)); });
  };

  /* ------------------------------------------------------------------ stage */
  var stageScale = 1;
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stageScale = s;
    $('stage').style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    if (cloud) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(1920 * s * dpr);
      w = Math.max(320, Math.min(w, LITE || EMBED ? 1280 : 2560));
      cloud.resize(w, Math.round(w * 9 / 16));
    }
  }

  // background gradient: tween Deck.bg { h1, h2, l } (two hues and a brightness)
  Deck.bg = { h1: 222, h2: 268, l: 13 };

  /* ------------------------------------------------------------------ building the show */
  Deck.start = function (fn) { buildFn = fn; if (started) build(); };

  function build() {
    master = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 0.9 } });
    scenes = [{ title: 'البداية', page: 0 }];
    beats = [{ name: 'start', notes: '', time: 0, scene: 0 }];
    master.set({}, {}, 0.02);
    var names = { start: 1 };
    var B = {
      tl: master,
      cloud: cloud,
      // start a new page
      scene: function (title) { scenes.push({ title: title, page: scenes.length }); return B; },
      // a click stop. Everything added to the timeline since the previous beat plays on this click.
      beat: function (name, notes) {
        var t = Math.max(master.duration(), beats[beats.length - 1].time + 0.1);
        name = name || ('beat-' + beats.length);
        if (names[name]) { var n = 2; while (names[name + '-' + n]) n++; name = name + '-' + n; }
        names[name] = 1;
        beats.push({ name: name, notes: notes || '', time: t, scene: scenes.length - 1 });
        // a small gap, so a .set() meant for the NEXT click cannot fire while we rest on this beat
        master.set({}, {}, t + 0.02);
        return B;
      },
      // the current end of the timeline
      t: function () { return master.duration(); },
      // run the hooks other files registered under this name
      slot: function (name) { (Deck.slots[name] || []).forEach(function (f) { f(B); }); return B; },
      // morph the dot cloud into a new shape on this click
      morph: function (points, vars, pos) {
        var v = { shape: cloud.add(points), duration: 2.4, ease: 'power2.inOut' }, k;
        for (k in (vars || {})) v[k] = vars[k];
        master.to(cloud.state, v, pos == null ? master.duration() : pos);
        return B;
      }
    };
    if (buildFn) buildFn(B);
    Deck.extras.forEach(function (f) { f(B); });
    if (master.duration() > beats[beats.length - 1].time + 0.05) {
      console.warn('[deck] animation after the last beat: adding a final beat "end"');
      B.beat('end', '');
    }
    // touch every tween once, in order, so jumping anywhere later is exact
    master.progress(1); master.time(0);
    runWatchers(true);
  }

  /* ------------------------------------------------------------------ navigation */
  function pageOf(i) { return scenes[beats[i].scene].page; }

  function finishAnim() {
    if (anim) { anim.kill(); anim = null; master.time(beats[cur].time); }
  }
  function go(i, instant) {
    i = Math.max(0, Math.min(beats.length - 1, i));
    finishAnim();                                   // a click during an animation finishes it first
    if (i === cur) { refresh(false); return; }
    var from = cur, step = i - cur;
    cur = i;
    var animate = Math.abs(step) === 1 && !instant;
    if (animate) {
      var dist = Math.abs(beats[i].time - master.time());
      anim = gsap.to(master, {
        time: beats[i].time, duration: dist / (step < 0 ? BACK_SPEED : 1), ease: 'none',
        onComplete: function () { anim = null; }
      });
    } else {
      flash();                                      // a jump is instant, hidden by a quick black flash
      master.time(beats[i].time);
      runWatchers(true);
    }
    refresh(true, animate, from);
  }
  function next() { go(cur + 1); }
  function back() { go(cur - 1); }
  function jumpToPage(n) {
    for (var i = 0; i < beats.length; i++) if (pageOf(i) === n) { go(i, true); return true; }
    return false;
  }

  function flash() {
    if (MODE === 'thumb') return;
    var f = $('flash'); gsap.killTweensOf(f);
    gsap.set(f, { opacity: 1 }); gsap.to(f, { opacity: 0, duration: 0.4, delay: 0.05, ease: 'power1.out' });
  }

  function refresh(moved, animate, from) {
    var p = pageOf(cur);
    $('pageno').textContent = p > 0 ? p : '';
    $('progress-fill').style.transform = 'scaleX(' + (beats.length > 1 ? cur / (beats.length - 1) : 0) + ')';
    if (!EMBED) {
      try { history.replaceState(null, '', '#' + beats[cur].name); } catch (e) { location.hash = beats[cur].name; }
      sendState(moved ? 'nav' : 'sync', animate);
    }
  }

  /* ------------------------------------------------------------------ black / white screen */
  var blank = null;
  function setBlank(v, quiet) {
    blank = v || null;
    var el = $('blank');
    el.style.background = v === 'white' ? '#fff' : '#000';
    gsap.killTweensOf(el);
    gsap.to(el, { autoAlpha: v ? 1 : 0, duration: MODE === 'thumb' ? 0 : 0.5, ease: 'power2.inOut' });
    if (!quiet && !EMBED) sendState('blank');
  }

  /* ------------------------------------------------------------------ overlays */
  var open = null;   // 'help' | 'overview' | null
  function closeOverlay() {
    if (!open) return;
    $(open).classList.remove('open'); open = null;
  }
  function toggleHelp() { if (open === 'help') return closeOverlay(); closeOverlay(); open = 'help'; $('help').classList.add('open'); }

  var ovItems = [], ovSel = 0;
  function toggleOverview() {
    if (open === 'overview') return closeOverlay();
    closeOverlay(); open = 'overview';
    var root = $('overview-grid'); root.innerHTML = ''; ovItems = [];
    var thumbs = window.DECK_THUMBS || {}, missing = 0;
    scenes.forEach(function (sc, si) {
      var idx = []; beats.forEach(function (b, i) { if (b.scene === si) idx.push(i); });
      if (!idx.length) return;
      var g = document.createElement('section'); g.className = 'ov-group';
      var h = document.createElement('header');
      h.innerHTML = '<b></b><span></span><i></i>';
      h.children[0].textContent = sc.page === 0 ? '0' : sc.page;
      h.children[1].textContent = sc.title;
      h.children[2].textContent = idx.length === 1 ? 'نقرة واحدة' : idx.length + ' نقرات';
      g.appendChild(h);
      var row = document.createElement('div'); row.className = 'ov-row'; g.appendChild(row);
      idx.forEach(function (i) {
        var b = beats[i], it = document.createElement('button'); it.className = 'ov-item'; it.type = 'button';
        if (thumbs[b.name]) {
          var img = document.createElement('img'); img.src = 'assets/thumbs/' + thumbs[b.name]; img.alt = b.name; it.appendChild(img);
        } else { missing++; var ph = document.createElement('span'); ph.className = 'ov-name'; ph.textContent = b.name; it.appendChild(ph); }
        var cap = document.createElement('em'); cap.textContent = i + ' · ' + b.name; it.appendChild(cap);
        it.addEventListener('click', function (e) { e.stopPropagation(); closeOverlay(); go(i, true); });
        row.appendChild(it); ovItems[i] = it;
      });
      root.appendChild(g);
    });
    $('overview-note').style.display = missing ? '' : 'none';
    $('overview').classList.add('open');
    ovSelect(cur);
  }
  function ovSelect(i) {
    i = Math.max(0, Math.min(ovItems.length - 1, i));
    ovItems.forEach(function (it, k) { it.classList.toggle('sel', k === i); it.classList.toggle('now', k === cur); });
    ovSel = i;
    ovItems[i].scrollIntoView({ block: 'nearest' });
  }
  function ovRow(dir) {   // move up or down one row, to the nearest tile
    var a = ovItems[ovSel].getBoundingClientRect(), best = -1, bestScore = Infinity;
    ovItems.forEach(function (it, k) {
      var r = it.getBoundingClientRect(), dy = (r.top - a.top) * dir;
      if (dy < 10) return;
      var score = dy * 4 + Math.abs(r.left - a.left);
      if (score < bestScore) { bestScore = score; best = k; }
    });
    if (best >= 0) ovSelect(best);
  }

  /* ------------------------------------------------------------------ small tools */
  var testerOn = false, lineOn = false, digits = '', digitTimer = null;
  var LABEL = {
    next: 'التالي', back: 'السابق', enter: 'التالي', full: 'ملء الشاشة', black: 'شاشة سوداء', white: 'شاشة بيضاء',
    presenter: 'شاشة المقدّم', overview: 'نظرة عامة', home: 'أول نقرة', end: 'آخر نقرة', help: 'المساعدة',
    tester: 'فاحص الأزرار', line: 'خط التقدّم', esc: 'إغلاق', digit: 'رقم صفحة'
  };
  function testerShow(keyName, action) {
    if (!testerOn) return;
    $('tester').innerHTML = '<b></b><span></span>';
    $('tester').children[0].textContent = keyName;
    $('tester').children[1].textContent = action ? LABEL[action.split(':')[0]] : 'غير معرّف';
  }
  function showDigits() {
    var el = $('jumpbox');
    el.textContent = digits ? 'صفحة ' + digits + ' ⏎' : '';
    el.classList.toggle('open', !!digits);
    clearTimeout(digitTimer);
    if (digits) digitTimer = setTimeout(function () { digits = ''; showDigits(); }, 5000);
  }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () { });
  }

  /* ------------------------------------------------------------------ keys */
  // Letters are read by their position on the keyboard (e.code), so they work
  // the same whether the keyboard is set to Arabic or English.
  function actionFor(e) {
    var c = e.code || '', k = e.key || '';
    if (/^(Digit|Numpad)\d$/.test(c) && !e.shiftKey) return 'digit:' + c.slice(-1);
    switch (c) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'Space': case 'KeyN': return 'next';
      case 'Enter': case 'NumpadEnter': return 'enter';
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': return 'back';
      case 'KeyF': case 'F5': return 'full';
      case 'KeyB': case 'Period': case 'NumpadDecimal': return 'black';
      case 'KeyW': case 'Comma': return 'white';
      case 'KeyP': return 'presenter';
      case 'KeyG': case 'KeyO': return 'overview';
      case 'Home': return 'home';
      case 'End': return 'end';
      case 'KeyH': return 'help';
      case 'Slash': return e.shiftKey ? 'help' : null;
      case 'KeyD': return 'tester';
      case 'KeyL': return 'line';
      case 'Escape': return 'esc';
    }
    switch (k) {   // devices that send a key name but no position
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': return 'next';
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': return 'back';
      case 'Enter': return 'enter';
      case 'F5': return 'full'; case '.': return 'black'; case ',': return 'white'; case '?': return 'help';
      case 'Escape': return 'esc'; case 'Home': return 'home'; case 'End': return 'end';
    }
    if (/^\d$/.test(k)) return 'digit:' + k;
    return null;
  }

  function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var a = actionFor(e);
    testerShow(e.key === ' ' ? 'Space' : e.key, a);
    if (!a) return;
    e.preventDefault();
    if (e.repeat && a !== 'next' && a !== 'back') return;

    if (open === 'overview') {
      if (e.code === 'ArrowDown') return ovRow(1);
      if (e.code === 'ArrowUp') return ovRow(-1);
      if (a === 'enter' || e.code === 'Space') { var t = ovSel; closeOverlay(); return go(t, true); }
      if (a === 'next') return ovSelect(ovSel + 1);
      if (a === 'back') return ovSelect(ovSel - 1);
      if (a === 'home') return ovSelect(0);
      if (a === 'end') return ovSelect(ovItems.length - 1);
      if (a === 'esc' || a === 'overview') return closeOverlay();
      return;
    }
    if (open === 'help') { if (a === 'esc' || a === 'help' || a === 'next' || a === 'back' || a === 'enter') closeOverlay(); return; }
    act(a);
  }

  function act(a) {
    // while the screen is black or white, Next / Back only bring the picture back
    if (blank && (a === 'next' || a === 'back' || a === 'enter' || a === 'esc')) { digits = ''; showDigits(); return setBlank(null); }
    if (a.indexOf('digit:') === 0) { digits = (digits + a.slice(6)).slice(-3); return showDigits(); }
    if (a === 'enter' && digits) { var n = parseInt(digits, 10); digits = ''; showDigits(); jumpToPage(n); return; }
    if (digits && a !== 'full') { digits = ''; showDigits(); if (a === 'back' || a === 'esc') return; }
    switch (a) {
      case 'next': case 'enter': return next();
      case 'back': return back();
      case 'full': return fullscreen();
      case 'black': return setBlank(blank === 'black' ? null : 'black');
      case 'white': return setBlank(blank === 'white' ? null : 'white');
      case 'presenter': return openPresenter();
      case 'overview': return toggleOverview();
      case 'home': return go(0, true);
      case 'end': return go(beats.length - 1, true);
      case 'help': return toggleHelp();
      case 'tester': testerOn = !testerOn; $('tester').classList.toggle('open', testerOn); $('tester').textContent = testerOn ? 'اضغط أي زر…' : ''; return;
      case 'line': lineOn = !lineOn; $('progress').classList.toggle('open', lineOn); return;
      case 'esc': return closeOverlay();
    }
  }

  /* ------------------------------------------------------------------ mouse */
  var idleTimer = null;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { document.body.classList.add('idle'); }, 2000);
  }
  function bindInput() {
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      testerShow('نقرة يمين', 'back');
      if (open) return closeOverlay();
      act('back');
    });
    window.addEventListener('click', function (e) {
      if (e.button !== 0) return;
      testerShow('نقرة يسار', 'next');
      if (open) { if (!e.target.closest('.ov-item')) closeOverlay(); return; }
      act('next');
    });
    window.addEventListener('mousemove', wake);
    wake();
  }

  /* ------------------------------------------------------------------ presenter link (postMessage) */
  var presenter = null;
  function openPresenter() {
    var w = window.open('presenter.html', 'deck-presenter', 'width=1400,height=860');
    if (w) presenter = w;
  }
  function meta() {
    return beats.map(function (b, i) { return { name: b.name, notes: b.notes, page: pageOf(i), title: scenes[b.scene].title }; });
  }
  function sendState(kind, animate) {
    if (!presenter || presenter.closed) return;
    var m = { deck: 1, type: 'state', kind: kind, index: cur, animate: !!animate, blank: blank };
    if (kind === 'init') m.beats = meta();
    try { presenter.postMessage(m, '*'); } catch (e) { }
  }
  function onMessage(e) {
    var m = e.data;
    if (!m || m.deck !== 1) return;
    if (EMBED) {                                   // orders from the presenter window that holds us
      if (e.source !== window.parent) return;
      if (m.type === 'goto' && master) { go(m.index, !m.animate); }
      if (m.type === 'blank' && MODE === 'mirror') setBlank(m.value, true);
      return;
    }
    if (m.type === 'hello') { presenter = e.source; sendState('init'); }
    if (m.type === 'cmd' && e.source === presenter) {
      if (m.cmd === 'next' || m.cmd === 'back' || m.cmd === 'black' || m.cmd === 'white') { if (open) closeOverlay(); act(m.cmd); }
    }
  }

  /* ------------------------------------------------------------------ start-up */
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (res) { setTimeout(res, ms); })]);
  }
  function fontsReady() {
    if (!document.fonts) return Promise.resolve();
    var all = [];
    document.fonts.forEach(function (f) { all.push(f.load().catch(function () { })); });
    return Promise.all(all);
  }
  function imagesReady() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('#stage img'));
    return Promise.all(imgs.map(function (im) {
      if (im.complete) return null;
      return new Promise(function (res) { im.addEventListener('load', res); im.addEventListener('error', res); });
    }));
  }
  function makeGrain() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d'), d = x.createImageData(256, 256), r = Cloud.rng(99);
    for (var i = 0; i < d.data.length; i += 4) { var v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    $('grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
  }

  function init() {
    document.body.classList.add('mode-' + MODE);
    if (EMBED) document.body.classList.add('embedded');
    var count = MODE === 'thumb' ? 30000 : EMBED ? 6000 : LITE ? 8000 : 30000;
    try { cloud = Cloud.create($('cloud'), count); }
    catch (err) { console.warn('[deck] WebGL is not available: ' + err.message); cloud = Cloud.create(document.createElement('div'), 16); }
    Deck.cloud = cloud;
    makeGrain();
    fit();
    window.addEventListener('resize', fit);
    Deck.watch(Deck.bg, function (b) {
      $('bg').style.background =
        'radial-gradient(1200px 900px at 22% 18%, hsl(' + b.h1 + ' 55% ' + b.l + '%), transparent 70%),' +
        'radial-gradient(1300px 1000px at 85% 95%, hsl(' + b.h2 + ' 50% ' + (b.l * 0.8) + '%), transparent 70%), #04050a';
    });

    Promise.all([withTimeout(fontsReady(), 5000), withTimeout(imagesReady(), 8000)]).then(function () {
      started = true;
      build();
      var want = decodeURIComponent(location.hash.replace('#', '')), at = 0;
      if (want && !EMBED) {
        beats.forEach(function (b, i) { if (b.name === want) at = i; });
        if (!at && /^\d+$/.test(want)) at = Math.min(beats.length - 1, parseInt(want, 10));
      }
      cur = at; master.time(beats[at].time); runWatchers(true);
      gsap.ticker.add(function (time) { runWatchers(); cloud.render(time); });
      refresh(false);
      if (!EMBED) bindInput();
      window.addEventListener('message', onMessage);
      if (EMBED && window.parent !== window) { try { window.parent.postMessage({ deck: 1, type: 'embed-ready', mode: MODE }, '*'); } catch (e) { } }
      $('loader').classList.add('done');
      window.__deck.ready = true;
    });
  }

  // a small handle for the snapshot maker and the check scripts
  window.__deck = {
    ready: false,
    beats: function () { return meta().map(function (b, i) { b.time = beats[i].time; return b; }); },
    index: function () { return cur; },
    jump: function (i) { go(i, true); },
    next: next, back: back,
    finish: finishAnim,
    busy: function () { return !!anim; },
    blank: setBlank,
    key: function (code, key) { onKey({ code: code, key: key || code, preventDefault: function () { } }); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
