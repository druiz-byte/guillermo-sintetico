// Integración con el avatar en tiempo real de Anam (https://anam.ai).
// Modo "elevenlabs": el audio de ElevenLabs (PCM 16 kHz) se envía a Anam, que sincroniza los labios.
// Modo "anam": Anam genera la voz con su propio voiceId a partir del texto.
window.GSAnam = (function () {
  const A = window.anam;
  let client = null, audioIn = null, sessionLang = null, outAnalyser = null, actx = null, starting = null;
  let speakToken = 0, pendingText = null;

  const api = p => window.GS_CONFIG.API_BASE.replace(/\/$/, '') + p;
  const available = () => !!(A && window.GS_CONFIG.API_BASE && window.GS_CONFIG.AVATAR_PROVIDER === 'anam');
  const voiceMode = () => window.GS_CONFIG.VOICE_PROVIDER || 'elevenlabs';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function start(lang, videoId) {
    // En modo voz de Anam la voz depende del idioma → nueva sesión al cambiar de idioma.
    if (client && (voiceMode() === 'elevenlabs' || sessionLang === lang)) return;
    if (starting) return starting;
    starting = (async () => {
      await stop();
      const r = await fetch(api('/api/anam-session'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }) });
      if (!r.ok) throw new Error('Anam session ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const { sessionToken } = await r.json();
      client = A.createClient(sessionToken, { disableInputAudio: true });
      client.addListener(A.AnamEvent.AUDIO_STREAM_STARTED, stream => {
        try {
          actx = actx || new (window.AudioContext || window.webkitAudioContext)();
          outAnalyser = actx.createAnalyser(); outAnalyser.fftSize = 512;
          actx.createMediaStreamSource(stream).connect(outAnalyser); // solo medición, no se reproduce dos veces
        } catch (e) { console.warn(e); }
      });
      client.addListener(A.AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, ev => {
        if (ev.role !== 'user' && ev.endOfSpeech && pendingText) { const f = pendingText; pendingText = null; f(); }
      });
      client.addListener(A.AnamEvent.CONNECTION_CLOSED, (code, details) => {
        console.warn('Anam cerrado', code, details); client = null; audioIn = null;
        window.dispatchEvent(new CustomEvent('gs-anam-closed'));
      });
      const ready = new Promise(res => client.addListener(A.AnamEvent.SESSION_READY, res));
      await client.streamToVideoElement(videoId);
      await Promise.race([ready, sleep(8000)]);
      if (voiceMode() === 'elevenlabs') {
        audioIn = client.createAgentAudioInputStream({ encoding: 'pcm_s16le', sampleRate: 16000, channels: 1 });
      }
      sessionLang = lang;
    })();
    try { await starting; } finally { starting = null; }
  }

  function level() {
    if (!outAnalyser) return null;
    const b = new Uint8Array(outAnalyser.fftSize); outAnalyser.getByteTimeDomainData(b);
    let s = 0; for (const v of b) { const x = (v - 128) / 128; s += x * x; }
    return Math.sqrt(s / b.length);
  }

  // Envía PCM y resuelve cuando el avatar termina de hablar.
  async function sayPCM(buf) {
    const my = ++speakToken;
    const bytes = new Uint8Array(buf, 0, buf.byteLength - (buf.byteLength % 2));
    const CH = 16000;                      // 0,5 s por bloque
    const dur = bytes.length / 32000;      // segundos de audio
    // 1 s por adelantado (Anam necesita ~800 ms para arrancar) y después a doble de tiempo real
    for (let i = 0; i < bytes.length; i += CH) {
      if (my !== speakToken || !audioIn) return false;
      audioIn.sendAudioChunk(bytes.subarray(i, Math.min(i + CH, bytes.length)));
      if (i >= CH * 2) await sleep(250);
    }
    audioIn.endSequence();
    const t0 = performance.now();
    const minMs = dur * 1000 - (bytes.length / CH) * 250 + 600;
    // Espera al menos la duración restante y luego a 600 ms de silencio (máx. 6 s de margen).
    let silentSince = null;
    while (my === speakToken) {
      await sleep(100);
      const el = performance.now() - t0;
      if (el < minMs) continue;
      const l = level();
      if (l === null) return true;
      if (l < 0.01) { silentSince = silentSince || performance.now(); if (performance.now() - silentSince > 600) return true; }
      else silentSince = null;
      if (el > minMs + 6000) return true;
    }
    return false;
  }

  function sayText(text) {
    const my = ++speakToken;
    return new Promise(res => {
      pendingText = () => res(my === speakToken);
      client.talk(text).catch(() => res(false));
    });
  }

  function interrupt() {
    speakToken++; pendingText = null;
    try { client && client.interruptPersona(); } catch (e) {}
    try { audioIn && audioIn.endSequence(); } catch (e) {}
  }

  async function stop() {
    interrupt();
    if (client) { try { await client.stopStreaming(); } catch (e) {} }
    client = null; audioIn = null; sessionLang = null; outAnalyser = null;
  }

  return { available, start, sayPCM, sayText, interrupt, stop, voiceMode, isOn: () => !!client };
})();
