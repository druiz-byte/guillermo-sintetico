(function () {
  const C = window.GS_CONFIG, T = window.GS_I18N;
  const $ = s => document.querySelector(s);
  const live = !!C.API_BASE;
  const api = p => C.API_BASE.replace(/\/$/, '') + p;

  const st = { deck: null, idx: 0, lang: C.DEFAULT_LANG, playing: false, paused: false, run: 0, cache: new Map(), asking: false };
  const audio = new Audio(); audio.preload = 'auto'; audio.crossOrigin = 'anonymous';
  let actx, analyser, rafLip;

  // ---------- utilidades ----------
  const tr = k => (T[st.lang] || T.es)[k] || k;
  const pick = (v, lang = st.lang) => v == null ? '' : typeof v === 'string' ? v : (v[lang] || v.es || Object.values(v)[0] || '');
  const slide = i => st.deck.slides[i];
  const frames = s => s.images || (s.image ? [s.image] : []);
  function slidePayload(i) {
    const s = slide(i);
    const imgs = frames(s);
    return { title: pick(s.title), kicker: pick(s.kicker), bullets: (s.bullets || []).map(b => pick(b)),
             text: pick(s.text), notes: pick(s.notes), brief: !!s.brief, steps: imgs.length,
             imageUrl: imgs.length ? new URL(imgs[imgs.length - 1], location.href).href : undefined };
  }
  function status(kind) {
    $('#statusDot').className = 'dot ' + (kind === 'speaking' ? 'speaking' : kind === 'thinking' ? 'thinking' : '');
    $('#statusText').textContent = tr(kind);
  }
  function applyI18n() {
    document.documentElement.lang = st.lang;
    document.querySelectorAll('[data-i18n]').forEach(e => e.textContent = tr(e.dataset.i18n));
    document.querySelectorAll('[data-i18n-ph]').forEach(e => e.placeholder = tr(e.dataset.i18nPh));
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-checked', b.dataset.lang === st.lang));
    $('#modeBadge').textContent = live ? tr('live') + (C.VOICE_PROVIDER === 'anam' ? 'Anam' : 'ElevenLabs') : tr('demo');
    $('#deckTitle').textContent = pick(st.deck?.title) || 'Guillermo sintético';
    updatePlayBtn(); status(st.playing && !st.paused ? 'speaking' : st.paused ? 'paused' : 'ready');
  }
  function updatePlayBtn() {
    $('#playBtn').textContent = !st.playing ? tr('play') : st.paused ? tr('resume') : tr('pause');
  }

  // ---------- render de diapositivas ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function render() {
    const s = slide(st.idx), n = st.deck.slides.length;
    clearTimeout(st.frameTimer); st.frame = 0;
    const imgs = frames(s);
    if (imgs.length) {
      $('#slide').innerHTML = `<img src="${esc(imgs[0])}" alt="${esc(pick(s.title) || 'Diapositiva ' + (st.idx + 1))}">`;
      imgs.slice(1).forEach(u => { const im = new Image(); im.src = u; }); // precarga de los pasos
      if (st.idx + 1 < n) frames(slide(st.idx + 1)).slice(0, 1).forEach(u => { const im = new Image(); im.src = u; });
    } else {
      const bl = (s.bullets || []).map(b => `<li>${esc(pick(b))}</li>`).join('');
      $('#slide').innerHTML = `<div class="html-slide">${s.kicker ? `<div class="kicker">${esc(pick(s.kicker))}</div>` : ''}
        <h2>${esc(pick(s.title))}</h2>${bl ? `<ul>${bl}</ul>` : ''}${s.text ? `<p>${esc(pick(s.text))}</p>` : ''}</div>`;
    }
    $('#counter').textContent = `${st.idx + 1} / ${n}`;
    $('#chapter').value = String(chapterOf(st.idx));
    $('#progressBar').style.width = ((st.idx + 1) / n * 100) + '%';
    $('#prevBtn').disabled = st.idx === 0; $('#nextBtn').disabled = st.idx === n - 1;
  }

  // Muestra los pasos de una animación repartidos a lo largo de la locución.
  function runFrames(seconds) {
    const imgs = frames(slide(st.idx)); clearTimeout(st.frameTimer);
    if (imgs.length < 2) return;
    const step = Math.max(1.2, (seconds * 0.85) / (imgs.length - 1)) * 1000, idx = st.idx;
    const next = () => {
      if (st.idx !== idx || st.frame >= imgs.length - 1) return;
      st.frame++; const im = $('#slide img'); if (im) im.src = imgs[st.frame];
      st.frameTimer = setTimeout(next, step);
    };
    st.frameTimer = setTimeout(next, step);
  }
  function showAllFrames() { const imgs = frames(slide(st.idx)); const im = $('#slide img'); if (im && imgs.length) im.src = imgs[imgs.length - 1]; }
  function chapterOf(i) { let c = 0; (st.chapters || []).forEach((ch, k) => { if (ch.idx <= i) c = k; }); return c; }
  function buildChapters() {
    const seen = new Set(); st.chapters = [];
    st.deck.slides.forEach((s, i) => { const t = pick(s.title); if (t && !seen.has(t) && !s.brief) { seen.add(t); st.chapters.push({ idx: i, t }); } });
    $('#chapter').innerHTML = st.chapters.map((c, k) => `<option value="${k}">${c.idx + 1}. ${esc(c.t.slice(0, 60))}</option>`).join('');
  }

  // ---------- narración ----------
  async function postJSON(path, body) {
    const r = await fetch(api(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r;
  }
  const useAnam = () => window.GSAnam && GSAnam.available();
  // Devuelve lo necesario para que hable: {url} (audio mp3), {pcm} (para Anam) o nada (voz propia de Anam).
  async function tts(text, lang = st.lang) {
    if (C.VOICE_PROVIDER === 'anam') return {}; // voz de Anam (o, si Anam falla, voz del navegador)
    const pcm = useAnam();
    const r = await postJSON('/api/tts', { text, lang, format: pcm ? 'pcm' : 'mp3' });
    return pcm ? { pcm: await r.arrayBuffer() } : { url: URL.createObjectURL(await r.blob()) };
  }
  function localScript(i, lang) {
    const s = slide(i), p = slidePayload(i);
    const parts = [p.title, ...p.bullets, p.text, pick(s.demoComment, lang) || p.notes].filter(Boolean);
    return parts.map(t => /[.!?…:]$/.test(t.trim()) ? t.trim() : t.trim() + '.').join(' ');
  }
  function getNarration(i, lang = st.lang) {
    const key = lang + ':' + i;
    if (st.cache.has(key)) return st.cache.get(key);
    const p = (async () => {
      if (!live) return { text: localScript(i, lang) };
      const r = await postJSON('/api/narrate', {
        lang, locale: C.LOCALES[lang], presenter: C.PRESENTER_NAME,
        deckTitle: pick(st.deck.title, lang), author: st.deck.author, context: st.deck.context, index: i + 1, total: st.deck.slides.length,
        slide: slidePayload(i),
        outline: st.deck.slides.map(s => pick(s.title, lang)).filter(Boolean)
      });
      const { text } = await r.json();
      return { text, ...(await tts(text, lang)) };
    })();
    p.catch(() => st.cache.delete(key));
    st.cache.set(key, p);
    return p;
  }

  // ---------- reproducción ----------
  function ensureAudioGraph() {
    if (actx) { actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser(); analyser.fftSize = 1024;
      src.connect(analyser); analyser.connect(actx.destination);
    } catch (e) { console.warn('Sin Web Audio', e); }
  }
  function lipFromAnalyser() {
    const buf = new Uint8Array(analyser ? analyser.fftSize : 0);
    const tick = () => {
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0; for (let k = 0; k < buf.length; k++) { const v = (buf[k] - 128) / 128; sum += v * v; }
        GSAvatar.setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5));
      }
      rafLip = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafLip); tick();
  }
  function stopSpeech() {
    audio.pause(); audio.onended = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (window.GSAnam) GSAnam.interrupt();
    cancelAnimationFrame(rafLip); clearInterval(stopSpeech.fake); GSAvatar.setLevel(0);
  }
  function speakBrowser(text, onEnd) {
    if (!('speechSynthesis' in window)) { setTimeout(onEnd, 1500); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = C.LOCALES[st.lang];
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(st.lang)) || null;
    u.rate = 1;
    clearInterval(stopSpeech.fake);
    stopSpeech.fake = setInterval(() => GSAvatar.setLevel(speechSynthesis.paused ? 0 : 0.25 + Math.random() * 0.6), 110);
    u.onend = u.onerror = () => { clearInterval(stopSpeech.fake); GSAvatar.setLevel(0); onEnd(); };
    speechSynthesis.speak(u);
  }
  function speak(n, onEnd) {
    const secs = n.pcm ? n.pcm.byteLength / 32000 : n.text.split(/\s+/).length / 2.6;
    if (n.url) audio.addEventListener('loadedmetadata', () => runFrames(audio.duration || secs), { once: true });
    else runFrames(secs);
    if (useAnam() && GSAnam.isOn()) {
      const p = n.pcm ? GSAnam.sayPCM(n.pcm) : GSAnam.sayText(n.text);
      return p.then(ok => { if (ok) onEnd(); });
    }
    if (n.url) {
      audio.src = n.url; audio.onended = onEnd; lipFromAnalyser();
      return audio.play();
    }
    speakBrowser(n.text, onEnd);
  }

  async function startAvatar() {
    if (!useAnam()) return;
    try {
      await GSAnam.start(st.lang, 'anamVideo');
      document.body.classList.add('anam-on');
    } catch (e) {
      console.error(e);
      document.body.classList.remove('anam-on');
      window.GS_CONFIG.AVATAR_PROVIDER = 'svg'; // recurre al avatar ilustrado
      st.cache.clear();
    }
  }
  window.addEventListener('gs-anam-closed', () => document.body.classList.remove('anam-on'));
  document.addEventListener('visibilitychange', () => { // no consumir minutos de Anam con la pestaña oculta
    if (document.hidden && useAnam() && GSAnam.isOn() && !st.playing) { GSAnam.stop(); document.body.classList.remove('anam-on'); }
  });

  async function playCurrent() {
    const run = ++st.run; stopSpeech();
    status('thinking'); $('#caption').textContent = '…';
    try {
      const [n] = await Promise.all([getNarration(st.idx), startAvatar()]);
      if (run !== st.run) return;
      $('#caption').textContent = n.text;
      status('speaking');
      if (live && st.idx + 1 < st.deck.slides.length) getNarration(st.idx + 1).catch(() => {}); // precarga
      await speak(n, () => {
        if (run !== st.run) return;
        GSAvatar.setLevel(0); showAllFrames();
        const last = st.idx === st.deck.slides.length - 1;
        if (last) {
          st.playing = false; updatePlayBtn(); status('ready'); $('#caption').textContent += '\n\n' + tr('end');
          if (useAnam()) setTimeout(() => { if (!st.playing && run === st.run) { GSAnam.stop(); document.body.classList.remove('anam-on'); } }, 90000);
          return;
        }
        if ($('#autoAdv').checked) { st.idx++; render(); playCurrent(); }
        else { status('ready'); }
      });
    } catch (e) {
      console.error(e);
      if (run !== st.run) return;
      $('#caption').textContent = tr('error') + ' (' + e.message + ')';
      st.playing = false; updatePlayBtn(); status('ready');
    }
  }

  // ---------- eventos ----------
  $('#playBtn').onclick = () => {
    ensureAudioGraph();
    if (!st.playing) { st.playing = true; st.paused = false; updatePlayBtn(); playCurrent(); return; }
    st.paused = !st.paused;
    if (useAnam()) {
      if (st.paused) { st.run++; stopSpeech(); status('paused'); } else playCurrent(); // Anam no admite pausa: se repite la diapositiva
      updatePlayBtn(); return;
    }
    if (st.paused) { audio.pause(); if ('speechSynthesis' in window) speechSynthesis.pause(); status('paused'); GSAvatar.setLevel(0); }
    else { if (audio.src && !audio.ended && audio.currentTime > 0) audio.play(); if ('speechSynthesis' in window) speechSynthesis.resume(); status('speaking'); }
    updatePlayBtn();
  };
  function go(d) {
    const ni = st.idx + d; if (ni < 0 || ni >= st.deck.slides.length) return;
    st.idx = ni; render(); st.paused = false; updatePlayBtn();
    if (st.playing) playCurrent(); else { st.run++; stopSpeech(); status('ready'); }
  }
  $('#prevBtn').onclick = () => go(-1);
  $('#nextBtn').onclick = () => go(1);
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === ' ') { e.preventDefault(); $('#playBtn').click(); }
  });
  document.querySelectorAll('.lang button').forEach(b => b.onclick = () => {
    if (b.dataset.lang === st.lang) return;
    st.lang = b.dataset.lang; st.paused = false;
    try { localStorage.setItem('gs-lang', st.lang); } catch (e) {}
    applyI18n(); render();
    if (st.playing) playCurrent(); else { st.run++; stopSpeech(); $('#caption').textContent = tr('hint'); }
  });
  $('#askForm').onsubmit = async e => {
    e.preventDefault();
    const q = $('#askInput').value.trim(); if (!q) return;
    if (!live) { $('#caption').textContent = tr('askDemo'); return; }
    ensureAudioGraph();
    const run = ++st.run; stopSpeech(); status('thinking');
    const wasPlaying = st.playing; st.playing = false; st.paused = false; updatePlayBtn();
    try {
      const r = await postJSON('/api/ask', { lang: st.lang, locale: C.LOCALES[st.lang], presenter: C.PRESENTER_NAME,
        question: q, deckTitle: pick(st.deck.title), author: st.deck.author, context: st.deck.context, slide: slidePayload(st.idx) });
      const { text } = await r.json();
      const [voice] = await Promise.all([tts(text), startAvatar()]);
      if (run !== st.run) return;
      $('#caption').textContent = '❓ ' + q + '\n\n' + text; $('#askInput').value = '';
      status('speaking');
      await speak({ text, ...voice }, () => { if (run === st.run) { status('ready'); GSAvatar.setLevel(0); if (wasPlaying) $('#caption').textContent += '\n\n▶ ' + tr('resume') + '?'; } });
    } catch (err) { console.error(err); $('#caption').textContent = tr('error'); status('ready'); }
  };

  // ---------- arranque ----------
  (async function init() {
    GSAvatar.mount($('#avatar'));
    try { const l = localStorage.getItem('gs-lang'); if (T[l]) st.lang = l; } catch (e) {}
    $('#autoAdv').checked = C.AUTO_ADVANCE !== false;
    const params = new URLSearchParams(location.search);
    if (T[params.get('lang')]) st.lang = params.get('lang');
    st.deck = await (await fetch(params.get('deck') || C.DECK_URL, { cache: 'no-cache' })).json();
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
    if (st.deck.aspect) document.documentElement.style.setProperty('--slide-aspect', st.deck.aspect);
    buildChapters();
    const s0 = Number(params.get('slide')); if (s0 >= 1 && s0 <= st.deck.slides.length) st.idx = s0 - 1;
    applyI18n(); render();
  })();
  $('#chapter').onchange = e => { const c = st.chapters[+e.target.value]; if (c) go(c.idx - st.idx); };
})();
