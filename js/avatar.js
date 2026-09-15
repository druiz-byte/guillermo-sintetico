// Avatar ilustrado con sincronía labial por amplitud de audio.
// Para usar una foto propia, sustituye el SVG manteniendo los ids #mouth, #lidL, #lidR, #head.
window.GSAvatar = (function () {
  const svg = `
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar del presentador">
  <defs>
    <linearGradient id="bgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ddd0"/><stop offset="1" stop-color="#d7c5b3"/></linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#bgG)"/>
  <g id="body">
    <path d="M40 300 C48 232 92 210 150 210 C208 210 252 232 260 300Z" fill="#23303f"/>
    <path d="M128 212 L150 262 L172 212Z" fill="#f4f1ea"/>
    <path d="M146 222 L154 222 L158 270 L150 282 L142 270Z" fill="#b8322a"/>
    <path d="M128 212 L112 240 L150 262Z M172 212 L188 240 L150 262Z" fill="#1a2430"/>
  </g>
  <g id="head">
    <rect x="132" y="178" width="36" height="40" rx="10" fill="#d9a784"/>
    <ellipse cx="150" cy="128" rx="62" ry="74" fill="#e8b994"/>
    <ellipse cx="89" cy="134" rx="9" ry="15" fill="#dca783"/>
    <ellipse cx="211" cy="134" rx="9" ry="15" fill="#dca783"/>
    <path d="M88 118 C84 70 110 48 150 48 C194 48 218 72 212 118 C204 96 190 84 168 82 C140 80 112 88 94 104Z" fill="#4a3a30"/>
    <path d="M100 164 C104 196 126 206 150 206 C174 206 196 196 200 164 C192 184 172 192 150 192 C128 192 108 184 100 164Z" fill="#6b5446" opacity=".55"/>
    <path d="M112 108 Q126 100 138 106" stroke="#3b2e26" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M162 106 Q174 100 188 108" stroke="#3b2e26" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="125" cy="124" rx="7" ry="7.5" fill="#2a211c"/>
    <ellipse cx="175" cy="124" rx="7" ry="7.5" fill="#2a211c"/>
    <circle cx="127" cy="122" r="2" fill="#fff"/><circle cx="177" cy="122" r="2" fill="#fff"/>
    <rect id="lidL" x="115" y="114" width="20" height="0" fill="#e8b994"/>
    <rect id="lidR" x="165" y="114" width="20" height="0" fill="#e8b994"/>
    <g fill="none" stroke="#2f2f35" stroke-width="2.5">
      <rect x="108" y="112" width="36" height="26" rx="9"/><rect x="156" y="112" width="36" height="26" rx="9"/>
      <path d="M144 122 Q150 118 156 122"/>
    </g>
    <path d="M150 128 Q146 146 150 150 Q154 152 157 149" stroke="#c48d6c" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g id="mouthG" transform="translate(150 170)">
      <ellipse id="mouth" cx="0" cy="0" rx="15" ry="2" fill="#6e2b28"/>
      <path id="lip" d="M-16 -1 Q0 5 16 -1" stroke="#a45a4f" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;

  let mouth, lip, lidL, lidR, head, level = 0, target = 0, t0 = performance.now();

  function mount(el) {
    el.innerHTML = svg;
    mouth = el.querySelector('#mouth'); lip = el.querySelector('#lip');
    lidL = el.querySelector('#lidL'); lidR = el.querySelector('#lidR'); head = el.querySelector('#head');
    scheduleBlink(); requestAnimationFrame(loop);
  }
  function setLevel(v) { target = Math.max(0, Math.min(1, v)); }
  function loop(now) {
    level += (target - level) * 0.35;
    const open = 2 + level * 16;
    mouth.setAttribute('ry', open.toFixed(2));
    mouth.setAttribute('rx', (15 - level * 3).toFixed(2));
    lip.setAttribute('opacity', level > 0.08 ? 0 : 1);
    const s = (now - t0) / 1000;
    const sway = Math.sin(s * 0.9) * 1.2 + level * Math.sin(s * 7) * 1.5;
    head.setAttribute('transform', `rotate(${sway.toFixed(2)} 150 200)`);
    requestAnimationFrame(loop);
  }
  function blink() {
    [lidL, lidR].forEach(l => l.setAttribute('height', 20));
    setTimeout(() => [lidL, lidR].forEach(l => l.setAttribute('height', 0)), 130);
    scheduleBlink();
  }
  function scheduleBlink() { setTimeout(blink, 2500 + Math.random() * 3500); }
  return { mount, setLevel };
})();
