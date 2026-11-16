/* Dźwięki efektów (etap 3, 2026-11-16). Na stronie wczytuje go dzwiek.js, gdy czytelnik włączy
   „Dźwięki”; ten sam plik działa na stronie testowej (robocze/efekty-test.html) i w mikserze. Wszystko generowane na żywo przez Web Audio: żadnych plików, nic z sieci.
   Każdy dźwięk powstaje od nowa przy każdym uruchomieniu, więc nie powtarza się identycznie.

   Podpięcie: owija window.Efekty.uruchom (ten sam punkt wejścia co kliknięcie frazy, Enter
   i przycisk „uruchom”), a zdarzenia z DOM-u (dymki czatu, test, ruch) łapie MutationObserver.
   Czasy przepisane z efekty.js: uderzenia pioruna, odbicia bidonu, szarpnięcie liny itd. */
(() => {
  if (new URLSearchParams(location.search).get('fx')) return;        // tryb klatki: cisza

  let A = null, master = null, wet = null, wlaczony = false;
  const BAZA = document.currentScript && document.currentScript.src ? new URL('.', document.currentScript.src).href : '';
  // nagrania (assets/audio/efekty/): pobierane przy pierwszym włączeniu dźwięków, dekodowane raz
  const PROBKI = {grzmot: 'grzmot.mp3', glitch: 'glitch.mp3'}, probki = {};
  function probka(n) {
    if (!probki[n]) probki[n] = fetch(`${BAZA}assets/audio/efekty/${PROBKI[n]}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(d => new Promise((ok, blad) => { const p = A.decodeAudioData(d, ok, blad); if (p && p.then) p.then(ok, blad); }))
      .catch(e => { delete probki[n]; throw e; });
    return probki[n];
  }
  const R = Math.random, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
  const envF = (u, a = .15, b = .25) => u < a ? smooth(u/a) : (u > 1 - b ? smooth((1 - u)/b) : 1);

  // ---------- szumy (bufory dzielone między kontekstami) ----------
  const B = {};
  function bufory(sr) {
    const len = sr*4, mk = () => new AudioBuffer({length: len, sampleRate: sr, numberOfChannels: 1});
    const w = mk(), p = mk(), b = mk(), dw = w.getChannelData(0), dp = p.getChannelData(0), db = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const x = R()*2 - 1; dw[i] = x;
      b0 = .99886*b0 + x*.0555179; b1 = .99332*b1 + x*.0750759; b2 = .969*b2 + x*.153852;
      b3 = .8665*b3 + x*.3104856; b4 = .55*b4 + x*.5329522; b5 = -.7616*b5 - x*.016898;
      dp[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x*.5362)*.11; b6 = x*.115926;
      last = (last + .02*x)/1.02; db[i] = last*3.5;
    }
    B.white = w; B.pink = p; B.brown = b; B.sr = sr;
  }
  function impuls(ctx, sek, zanik) {
    const len = Math.floor(ctx.sampleRate*sek), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { const u = i/len; lp += ((R()*2 - 1) - lp)*(.5 - .42*u);    // im dalej, tym ciemniej
        d[i] = lp*Math.pow(1 - u, zanik)*(i < ctx.sampleRate*.012 ? i/(ctx.sampleRate*.012) : 1); } }
    return buf;
  }
  // jeden kontekst dźwięku na całą stronę — tworzy go script.js w kliknięciu (iOS wymaga gestu)
  const wspolny = () => window.alpinistaCtx || (window.alpinistaCtx = new (window.AudioContext || window.webkitAudioContext)());
  function przygotuj(ctx) {
    A = ctx;
    if (B.sr !== ctx.sampleRate) bufory(ctx.sampleRate);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .25;
    master = ctx.createGain(); master.gain.value = glosnosc;
    master.connect(comp).connect(ctx.destination);
    const rev = ctx.createConvolver(); rev.buffer = impuls(ctx, 3.4, 2.4);
    wet = ctx.createGain(); wet.gain.value = .8; wet.connect(rev).connect(master);
  }

  // ---------- klocki ----------
  const filt = (type, f, Q = .7) => { const n = A.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = Q; return n; };
  const gain = (v = 0) => { const g = A.createGain(); g.gain.value = v; return g; };
  const src = (buf, t, d) => { const s = A.createBufferSource(); s.buffer = B[buf]; s.loop = true;
    s.start(t, R()*3); s.stop(t + d + .05); return s; };
  // parametr prowadzony krzywą f(u), u = 0…1 na odcinku [t, t+d]
  function krzywa(par, t, d, f, n = 0) {
    n = n || Math.max(32, Math.ceil(d*60)); const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = f(i/(n - 1));
    par.setValueCurveAtTime(a, t, d);
  }
  // szyna jednego dźwięku: panorama + pogłos; stop() wycisza
  function szyna(pan = 0, poglos = .25, vol = 1) {
    const g = gain(vol), p = A.createStereoPanner(), s = gain(poglos);
    p.pan.value = clamp(pan, -1, 1); g.connect(p).connect(master); p.connect(s).connect(wet);
    return {in: g, g, pan: p.pan, stop(t, fade = .35) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); }};
  }
  // krótki szum przez filtr z zanikiem wykładniczym
  function uderz(out, t, {f = 1000, q = 1, dur = .05, vol = .5, typ = 'bandpass', szum = 'white', atak = .001, pan}) {
    const s = src(szum, t, dur*6 + .05), fl = filt(typ, f, q), g = gain(0);
    let dalej = out;
    if (pan !== undefined) { const p = A.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(out); dalej = p; }
    s.connect(fl).connect(g).connect(dalej);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + atak); g.gain.setTargetAtTime(0, t + atak, dur);
  }
  // ton z opcjonalnym zjazdem wysokości
  function ton(out, t, {f = 440, f2, dur = .3, vol = .3, typ = 'sine', atak = .004, pan}) {
    const o = A.createOscillator(), g = gain(0); o.type = typ; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur*1.2);
    let dalej = out;
    if (pan !== undefined) { const p = A.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(out); dalej = p; }
    o.connect(g).connect(dalej);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + atak); g.gain.setTargetAtTime(0, t + atak, dur/3);
    o.start(t); o.stop(t + dur*3 + .1);
  }
  // metal: nieharmoniczne alikwoty
  function ping(out, t, f0, {mn = [1, 2.32, 4.25, 6.63], dur = .35, vol = .2, pan} = {}) {
    mn.forEach((m, i) => ton(out, t, {f: f0*m*(1 + (R() - .5)*.006), dur: dur/(1 + i*.6), vol: vol/(1 + i*.9), atak: .001, pan}));
  }
  function serce(out, t, vol = .8) {
    ton(out, t, {f: 64, f2: 36, dur: .16, vol, atak: .006});
    ton(out, t + .16, {f: 56, f2: 33, dur: .14, vol: vol*.65, atak: .006});
    uderz(out, t, {f: 90, q: .8, dur: .05, vol: vol*.5, typ: 'lowpass', szum: 'brown'});
  }
  // wiatr: szum różowy w paśmie + syk śniegu + gwizd; sila(u) 0…1
  function wiatr(out, t, d, sila, {f0 = 320, f1 = 950, syk = .12, gwizd = .25, vol = 1} = {}) {
    const a = src('pink', t, d), bp = filt('bandpass', 500, .6), g = gain(0);
    a.connect(bp).connect(g).connect(out);
    krzywa(g.gain, t, d, u => 1.1*vol*sila(u)); krzywa(bp.frequency, t, d, u => f0 + (f1 - f0)*sila(u));
    const b = src('white', t, d), hp = filt('highpass', 3800, .5), g2 = gain(0);
    b.connect(hp).connect(g2).connect(out); krzywa(g2.gain, t, d, u => syk*vol*sila(u));
    if (gwizd) { const c = src('white', t, d), bq = filt('bandpass', 900, 22), g3 = gain(0);
      c.connect(bq).connect(g3).connect(out);
      const ph = R()*9;
      krzywa(bq.frequency, t, d, u => 620 + 520*sila(u) + 70*Math.sin(u*d*2.3 + ph));
      krzywa(g3.gain, t, d, u => gwizd*vol*2.2*Math.pow(sila(u), 2)); }
  }
  // grzmot: trzask (gdy blisko) i dudnienie; dal 0 = tuż obok, 1 = daleko
  function grzmot(out, t, {moc = 1, dal = 0, opozn = .05} = {}) {
    if (dal < .6) {
      uderz(out, t, {f: 3000, q: .4, dur: .07, vol: .9*moc*(1 - dal), typ: 'highpass'});
      uderz(out, t + .01, {f: 1200, q: .5, dur: .18, vol: .7*moc*(1 - dal)});
      uderz(out, t + .03, {f: 400, q: .6, dur: .35, vol: .8*moc*(1 - dal*.8), szum: 'pink'});
    }
    const t1 = t + opozn, len = 3 + dal*1.6, s = src('brown', t1, len), lp = filt('lowpass', 300, .8), g = gain(0);
    s.connect(lp).connect(g).connect(out);
    const f1 = 4 + R()*4, f2 = 1.5 + R()*2, ph = R()*6, wejscie = .04 + dal*.5;
    krzywa(g.gain, t1, len, u => { const s = u*len;
      return moc*1.5*Math.min(1, s/wejscie)*Math.exp(-s*(1.3 - dal*.5))*(.55 + .45*Math.abs(Math.sin(s*f1 + ph) + .7*Math.sin(s*f2))); });
    krzywa(lp.frequency, t1, len, u => (dal > .5 ? 170 : 520)*(1 - .65*u) + 45);
  }
  // chrzęst śniegu pod butem: kilka ziaren w krótkim pakiecie
  function krok(out, t, vol = .2, pan) {
    const n = 6 + Math.floor(R()*6);
    for (let i = 0; i < n; i++) uderz(out, t + R()*.09, {f: 1400 + R()*2600, q: 1.4, dur: .008 + R()*.012, vol: vol*(.4 + R()*.6), pan});
    uderz(out, t, {f: 300, q: .7, dur: .04, vol: vol*.6, typ: 'lowpass', szum: 'brown', pan});
  }
  function oddech(out, t, {wdech = .7, wydech = .9, vol = .25, f = 900, pan} = {}) {
    const s = src('pink', t, wdech + wydech + .3), bp = filt('bandpass', f, .9), g = gain(0);
    let dalej = out;
    if (pan !== undefined) { const p = A.createStereoPanner(); p.pan.value = pan; p.connect(out); dalej = p; }
    s.connect(bp).connect(g).connect(dalej);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol*.7, t + wdech*.8); g.gain.linearRampToValueAtTime(vol*.15, t + wdech);
    g.gain.linearRampToValueAtTime(vol, t + wdech + .12); g.gain.linearRampToValueAtTime(0, t + wdech + wydech);
    bp.frequency.setValueAtTime(f*1.4, t); bp.frequency.linearRampToValueAtTime(f*1.6, t + wdech); bp.frequency.linearRampToValueAtTime(f*.8, t + wdech + wydech);
  }
  // raki na zmrożonym śniegu: chrzęst i krótkie zgrzytnięcie stalowych zębów
  function rak(out, t, vol = .15) {
    krok(out, t, vol*.7);
    for (let i = 0; i < 3; i++) uderz(out, t + .01 + R()*.04, {f: 4500 + R()*3500, q: 6, dur: .004 + R()*.004, vol: vol*.35});
  }
  function kijek(out, t, vol = .1) {               // kijek albo czekan o lód: suchy, krótki stuk
    uderz(out, t, {f: 2200 + R()*1200, q: 4, dur: .012, vol});
    ping(out, t, 3100 + R()*900, {mn: [1, 2.6], dur: .05, vol: vol*.35});
  }
  function noc(out, t, d, vol = 1) {               // nocna cisza w górach: bardzo cichy, niski wiatr
    wiatr(out, t, d, u => .14*vol*envF(u, .2, .3), {gwizd: 0, syk: .02, f0: 180, f1: 320, vol: .6});
  }
  function las(out, t, d) {                        // szum ciemnego lasu: szeroki, miękki, z obu stron
    [-.8, .8].forEach(pn => { const s = src('pink', t, d), bp = filt('bandpass', 1400, .4), g = gain(0), pp = A.createStereoPanner();
      pp.pan.value = pn; s.connect(bp).connect(g).connect(pp).connect(out);
      const ph = R()*6; krzywa(g.gain, t, d, u => .07*envF(u, .25, .3)*(.6 + .4*Math.sin(u*d*.8 + ph))); });
  }
  // plama dźwięku: kilka głosów, powolne wejście i wyjście
  function plama(out, t, d, freqs, {typ = 'triangle', lp = 1400, vol = .06, a = .3, b = .3, drzenie = .15} = {}) {
    const f = filt('lowpass', lp, .5), g = gain(0); f.connect(g).connect(out);
    krzywa(g.gain, t, d, u => vol*envF(u, a, b)*(1 - drzenie + drzenie*Math.sin(u*d*1.3)));
    freqs.forEach(fr => [-1, 1].forEach(k => { const o = A.createOscillator(); o.type = typ;
      o.frequency.value = fr; o.detune.value = k*(4 + R()*5); o.connect(f); o.start(t); o.stop(t + d + .1); }));
  }

  // ---------- czasy liczone tak samo jak w efekty.js ----------
  function bidonUderzenia(btn) {
    const r = btn.getBoundingClientRect(), H = innerHeight, W = innerWidth, col = document.querySelector('article').getBoundingClientRect();
    let x = W - col.right > 100 ? col.right + 50 : clamp(r.right + 24, 30, W - 30), y = r.top + r.height/2;
    const y0 = y, ledges = [120, 250, 395, 560, 745, 950, 1180].map(d => y0 + d), out = [], sciezka = [];
    let vx = .9, vy = -3.4, hit = 0, i = 0;
    for (; i < 520; i++) { const py = y; vy += .34; x += vx; y += vy;
      if (hit < ledges.length && py < ledges[hit] && y >= ledges[hit]) { y = ledges[hit]; vy = -Math.abs(vy)*.4 - .6; vx = (hit%2 ? 1 : -1)*(1.4 + hit*.4); out.push({t: i*.016, x, y, nr: hit, v: Math.abs(vy)}); hit++; }
      if (x < 16 || x > W - 16) { vx *= -1; x = clamp(x, 16, W - 16); }
      sciezka.push([x, y, vy]);
      if (y > H + 90) break; }
    return {hity: out, koniec: i*.016, W, sciezka, y0};
  }
  function linaChwyt(btn) {
    const r = btn.getBoundingClientRect(), H = innerHeight, bok = Math.min(70, Math.max(34, r.width*.8));
    const L = Math.hypot(bok, 3) + clamp(H*.13, 70, 120);
    let x = 0, y = 0, vx = 26, vy = -40, t = 0;
    while (t < 2) { const h = .004; t += h; vy += 1500*h; x += vx*h; y += vy*h; if (Math.hypot(x + bok, y + 3) > L) return {t, v: Math.hypot(vx, vy)}; }
    return {t: .45, v: 500};
  }
  function blyskIle(btn) {
    let n = btn.closest('.line');
    do { n = n && n.nextElementSibling; } while (n && !n.classList.contains('line'));
    return n && /sześciu/.test(n.textContent) ? 6 : 9;
  }
  function choinkaCzasy() {                       // światło i zapala się, gdy u ≤ smooth(p/.35) + .02
    const out = [];
    for (let i = 0; i < 30; i++) { const zu = i/30; let p = 0;
      while (p < 1 && zu*.9 + p*.09 > smooth(p/.35) + .02) p += .002;
      out.push(p*6.5); }
    return out;
  }
  const panX = x => clamp((x/innerWidth)*2 - 1, -1, 1)*.7;

  // ---------- przestrzeń: dźwięk w miejscu, w którym dzieje się obraz (HRTF, słuchawki) ----------
  // Ekran → metry wokół słuchacza: x w bok, y w górę i w dół, z przed nim.
  // glab 0…1: dalej i ciemniej (wysokie tony giną z odległością) — wzmacnia „w dół, w przepaść”,
  // bo samą wysokość model ucha w przeglądarce oddaje słabiej niż lewo–prawo.
  // Przełącznik „przestrzeń: wył.” wraca do zwykłej panoramy lewo–prawo do porównania.
  let przestrzen = true;
  const do3d = (sx, sy, glab = 0) => [clamp(sx/innerWidth*2 - 1, -1.2, 1.2)*2.4, clamp(.5 - sy/innerHeight, -1.5, 1)*2.4, -1 - glab*5];
  function panner() { const p = A.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.rolloffFactor = 1; return p; }
  // nieruchome źródło w punkcie ekranu; zwraca węzeł, do którego podłącza się dźwięk
  function miejsce(out, sx, sy, glab = 0) {
    if (!przestrzen) { const p = A.createStereoPanner(); p.pan.value = panX(sx); p.connect(out); return p; }
    const p = panner(), [x, y, z] = do3d(sx, sy, glab), lp = filt('lowpass', 16000/(1 + glab*5), .5);
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; lp.connect(p).connect(out); return lp;
  }
  // źródło w ruchu: f(u) → [sx, sy, glab] na odcinku [t, t+d]
  function tor(out, t, d, f) {
    if (!przestrzen) { const p = A.createStereoPanner(); p.pan.value = panX(f(0)[0]); p.connect(out); krzywa(p.pan, t, d, u => panX(f(u)[0])); return p; }
    const p = panner(), lp = filt('lowpass', 16000, .5), pkt = u => { const [sx, sy, g] = f(u); return do3d(sx, sy, g); };
    const [x0, y0, z0] = pkt(0); p.positionX.value = x0; p.positionY.value = y0; p.positionZ.value = z0;
    lp.connect(p).connect(out);
    krzywa(p.positionX, t, d, u => pkt(u)[0]); krzywa(p.positionY, t, d, u => pkt(u)[1]); krzywa(p.positionZ, t, d, u => pkt(u)[2]);
    krzywa(lp.frequency, t, d, u => 16000/(1 + f(u)[2]*5));
    return lp;
  }

  // ---------- dźwięki efektów: (szyna, t0, btn) → czas trwania z ogonem, s ----------
  let wtfLevel = 0, klikLevel = 0, klikLast = 0, cykFlesz = -1e9;
  // „kruszarka”: spłaszcza falę do kilku poziomów — cyfrowy, brudny dźwięk zacięcia
  function krusz(poziomy) { const w = A.createWaveShaper(), n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i/(n - 1)*2 - 1; c[i] = Math.round(x*poziomy)/poziomy; } w.curve = c; return w; }
  const S = {
    tlen(o, t) {                                   // serce co 820 ms, ciężki oddech, gasnące uszy
      const d = 5.2;
      for (let k = 0; k*.82 < d - .3; k++) serce(o, t + k*.82, .25 + .75*envF(k*.82/d, .38, .3));
      const lp = filt('lowpass', 5000, .7); lp.connect(o);
      krzywa(lp.frequency, t, d, u => 5000 - 4300*envF(u, .38, .3));
      for (let k = 0; k*1.7 < d - .6; k++) oddech(lp, t + .2 + k*1.7, {wdech: .6, wydech: .9, vol: .3*envF(k*1.7/d, .38, .3) + .05, f: 1000});
      const pisk = A.createOscillator(), g = gain(0); pisk.frequency.value = 5600; pisk.connect(g).connect(o);
      krzywa(g.gain, t, d, u => .018*envF(u, .5, .3)); pisk.start(t); pisk.stop(t + d);
      return d + .6;
    },
    zamiec(o, t) {
      const d = 6, sila = u => envF(u, .12, .25)*clamp(.7 + .2*Math.sin(u*d*1000/640) + .12*Math.sin(u*d*1000/210), 0, 1);
      wiatr(o, t, d, sila, {f0: 280, f1: 1150, syk: .2, gwizd: .32});
      return d + .4;
    },
    szron(o, t) {                                  // kryształki: trzaski gęste, gdy szron rośnie
      const d = 6;
      wiatr(o, t, d, u => .25*envF(u, .2, .3), {gwizd: 0, syk: .05, f0: 250, f1: 500, vol: .6});
      for (let i = 0; i < 170; i++) { const u = Math.pow(R(), 1.8)*.55 + (R() < .15 ? .74 + R()*.2 : 0);
        uderz(o, t + u*d, {f: 3500 + R()*6000, q: 2, dur: .003 + R()*.01, vol: .05 + R()*.22, typ: 'bandpass', pan: R()*1.6 - .8}); }
      for (let i = 0; i < 5; i++) { const tt = t + .3 + R()*3, s = src('white', tt, .5), f = filt('bandpass', 1800 + R()*1500, 9), g = gain(0);
        s.connect(f).connect(g).connect(o); f.frequency.linearRampToValueAtTime(900 + R()*600, tt + .35);
        krzywa(g.gain, tt, .4, u => .25*Math.sin(u*Math.PI)*(.5 + .5*Math.sign(Math.sin(u*90)))); }
      plama(o, t, d, [2637, 3136, 3951], {typ: 'sine', lp: 8000, vol: .012, a: .4, b: .3, drzenie: .5});
      return d + .5;
    },
    'swietliki~'(o, t) {                           // STARA: noc, kroki wielu ludzi, ciepła plama
      const d = 6.5;
      plama(o, t, d, [110, 164.8, 246.9, 277.2, 415.3], {vol: .05, lp: 1100, a: .3, b: .3});
      wiatr(o, t, d, u => .2*envF(u, .2, .3), {gwizd: 0, syk: .03, f0: 200, f1: 400, vol: .6});
      for (let k = 0; k < 34; k++) { const u = .08 + R()*.8; krok(o, t + u*d, .07 + .1*envF(u, .2, .3), R()*1.4 - .7); }
      return d + 1;
    },
    /* ---- noc z czołówkami, wersja 2 (autor 16.11: zamiast muzyki — ludzie) ----
       Bez tonów i akordów. Słychać to, co słychać nocą na lodowcu: raki na zmrożonym śniegu,
       stuk kijków, oddechy. Dźwięk idzie w górę i oddala się razem ze światłami. */
    swietliki(o, t) {                              // 17 czołówek; od 40% drogi trzy ścieżki: lewo, prosto, lekko w prawo
      const d = 6.5, W = innerWidth, H = innerHeight;
      wiatr(o, t, d, u => envF(u, .2, .3)*(.55 + .2*Math.sin(u*d*.9) + .1*Math.sin(u*d*2.7)), {gwizd: .08, syk: .05, f0: 200, f1: 520, vol: .5});
      [[-.26, 6], [0, 6], [.12, 5]].forEach(([bok, ile], gi) => {
        const pkt = u => { const r = smooth((u - .4)/.6); return [W*(.5 + bok*r) + (gi - 1)*20, H*(1.05 - .85*u), .15 + .55*u]; };
        const p = tor(o, t, d, pkt);
        for (let k = 0; k < ile; k++) { const okres = .62 + R()*.12, faza = R()*okres, vol = (.1 + R()*.06)*.3;   // daleko: ledwie słychać
          for (let x = faza; x < d - .3; x += okres*(1 + (R() - .5)*.06)) { const u = x/d; rak(p, t + x, vol*envF(u, .12, .25)); }
          if (R() < .3) for (let x = R()*1.2; x < d - .8; x += 1.9 + R()*.4) oddech(p, t + x, {wdech: .7, wydech: .9, vol: .025*envF(x/d, .15, .3), f: 950}); } });
      return d + 1;
    },
    dwa(o, t) {                                    // dwoje: raki i oddechy, z czasem w jednym rytmie
      const d = 6.5, W = innerWidth, H = innerHeight, okres = .66;
      noc(o, t, d, .8); las(o, t, d);
      [[-1, 0], [1, .22]].forEach(([str, start]) => {
        const p = tor(o, t, d, u => [W*(.5 + str*.03), H*(.95 - .7*u) + (str > 0 ? 25 : 0), .15 + .5*u]);
        // drugi idzie krok za pierwszym: przesunięcie fazy topnieje do pół kroku — jeden rytm na dwoje
        for (let n = 0; ; n++) { const x = .3 + n*okres + (str > 0 ? start + (okres/2 - start)*Math.min(1, n/5) : 0);
          if (x > d - .4) break; rak(p, t + x, .16*envF(x/d, .12, .25)); }
        for (let x = .4 + start*2; x < d - .9; x += 2.1) oddech(p, t + x, {wdech: .75, wydech: 1, vol: .09*envF(x/d, .15, .3), f: str > 0 ? 820 : 980}); });
      return d + 1;
    },
    choinka(o, t) {                                // korytarz świateł: każde światło to ktoś na zakosie, coraz dalej
      const d = 6.5, W = innerWidth, H = innerHeight, N = 8, sc = [];
      for (let i = 0; i <= N; i++) { const u = i/N, bok = (i % 2 ? 1 : -1)*(W*.02 + Math.min(W*.2, 230)*(1 - u)); sc.push([W/2 + bok, H*.9 - u*H*.8]); }
      const dl = [0]; for (let i = 1; i < sc.length; i++) dl.push(dl[i - 1] + Math.hypot(sc[i][0] - sc[i - 1][0], sc[i][1] - sc[i - 1][1]));
      const naSciezce = u => { const dd = u*dl[N]; let i = 1; while (i < N && dl[i] < dd) i++;
        const f = (dd - dl[i - 1])/Math.max(1, dl[i] - dl[i - 1]); return [sc[i - 1][0] + (sc[i][0] - sc[i - 1][0])*f, sc[i - 1][1] + (sc[i][1] - sc[i - 1][1])*f]; };
      wiatr(o, t, d, u => envF(u, .15, .3)*(.6 + .25*Math.sin(u*d*.7) + .1*Math.sin(u*d*2.1)), {gwizd: .1, syk: .05, f0: 190, f1: 480, vol: .5});
      // każde zapalone światło to ktoś na zakosie: dwa, trzy kroki, coraz dalej i ciszej
      choinkaCzasy().forEach((tt, i) => { const u = i/30, [x, y] = naSciezce(u*.9), m = miejsce(o, x, y, .1 + .85*u), vol = .06*(1 - .6*u);
        for (let k = 0; k < 2 + Math.floor(R()*2); k++) krok(m, t + tt + k*(.6 + R()*.1), vol); });
      return d + 1.2;
    },
    brocken(o, t) {                                // cisza we mgle: wiatr cichnie, gdy pojawia się poświata
      const d = 6, W = innerWidth;
      wiatr(o, t, d, u => .32*(1 - smooth((u - .05)/.35))*(.8 + .2*Math.sin(u*9)) + .04, {gwizd: 0, syk: .04, f0: 220, f1: 420, vol: .7});
      // mgła: miękki, szeroki szum powietrza z obu stron, bez wysokości dźwięku
      [-1, 1].forEach(k => { const s = src('pink', t, d), lp = filt('lowpass', 900, .5), g = gain(0), pp = miejsce(o, W*(.5 + k*.45), innerHeight*.5, .4);
        s.connect(lp).connect(g).connect(pp); krzywa(g.gain, t, d, u => .09*envF(u, .3, .35)*(.8 + .2*Math.sin(u*d*.9 + k))); });
      // połysk: kilka wąskich, wysokich pasm szumu, które powoli dryfują i oddychają z poświatą
      for (let i = 0; i < 4; i++) { const s = src('white', t, d), bp = filt('bandpass', 3000 + i*900, 30), g = gain(0), ph = R()*6;
        const pp = miejsce(o, W*(.25 + R()*.5), innerHeight*(.35 + R()*.2), .35);
        s.connect(bp).connect(g).connect(pp);
        krzywa(bp.frequency, t, d, u => (3000 + i*900)*(1 + .06*Math.sin(u*d*.7 + ph)));
        krzywa(g.gain, t, d, u => .05*envF(u, .4, .35)*(.6 + .4*Math.sin(u*d*1.1 + ph))); }
      return d + .8;
    },
    szczelina(o, t) {
      const d = 4.2, pek = .92;
      for (let i = 0; i < 26; i++) { const u = Math.pow(i/26, .7)*pek;    // pęknięcie przyspiesza
        uderz(o, t + u, {f: 1800 + R()*3000, q: 1.2, dur: .006 + R()*.012, vol: .18 + .35*i/26, pan: -.6 + 1.2*u/pek}); }
      const jek = src('brown', t, pek + .4), lp = filt('lowpass', 120, 2), g = gain(0); jek.connect(lp).connect(g).connect(o);
      krzywa(g.gain, t, pek + .4, u => .9*Math.pow(u, 2)*(u > .75 ? (1 - u)/.25 : 1)); krzywa(lp.frequency, t, pek + .4, u => 60 + 120*u);
      ton(o, t + pek, {f: 72, f2: 30, dur: .5, vol: .9});
      uderz(o, t + pek, {f: 220, q: .6, dur: .25, vol: .9, typ: 'lowpass', szum: 'brown'});
      uderz(o, t + pek, {f: 2400, q: .5, dur: .03, vol: .5, typ: 'highpass'});
      for (let i = 0; i < 14; i++) ping(o, t + pek + .15 + Math.pow(R(), .7)*1.4, 1800 + R()*2600, {dur: .12, vol: .05 + R()*.06, pan: R()*1.2 - .6});
      const glab = src('pink', t + pek, 2.6), bp = filt('bandpass', 170, 3), g2 = gain(0); glab.connect(bp).connect(g2).connect(o);
      krzywa(g2.gain, t + pek, 2.6, u => .5*envF(u, .3, .4));
      const zam = t + d*.78, z = src('pink', zam, .7), bz = filt('bandpass', 650, 1.5), gz = gain(0); z.connect(bz).connect(gz).connect(o);
      krzywa(gz.gain, zam, .65, u => .35*Math.sin(u*Math.PI)*(.6 + .4*Math.sin(u*120)));
      ton(o, zam + .6, {f: 60, f2: 40, dur: .25, vol: .4});
      return d + 1.2;
    },
    burza(o, t) {                                  // deszcz, trzy uderzenia: 14, 44, 73% z 6,2 s
      const d = 6.2, W = innerWidth, H = innerHeight;
      const deszcz = src('white', t, d + 1), hp = filt('highpass', 1300, .5), lp = filt('lowpass', 7500, .5), g = gain(0);
      deszcz.connect(hp).connect(lp).connect(g).connect(o); krzywa(g.gain, t, d + 1, u => .3*envF(u, .08, .2));
      for (let i = 0; i < 90; i++) { const u = R(); uderz(o, t + u*d, {f: 2500 + R()*4000, q: 3, dur: .004, vol: .08*envF(u, .08, .2), pan: R()*2 - 1}); }
      // każdy grzmot z miejsca uderzenia: wysoko, raz z lewej, raz z prawej, w różnej odległości
      const strony = [R()*.35, .65 + R()*.3, .2 + R()*.6].sort(() => R() - .5);
      [.14, .44, .73].forEach((at, i) => { const dal = [.1, .25, 0][i];
        grzmot(miejsce(o, W*strony[i], H*.12, .1 + dal), t + at*d, {moc: [1, .85, 1.1][i]*(przestrzen ? 1.3 : 1), dal, opozn: .06}); });
      return d + 3;
    },
    wiatr(o, t) {                                  // narasta przez 60% i faluje
      const d = 5;
      wiatr(o, t, d, u => envF(u, .1, .25)*(.35 + .65*clamp(u/.6, 0, 1))*clamp(.65 + .35*Math.sin(u*d*1000/380) + .22*Math.sin(u*d*1000/127), 0, 1.2)/1.2,
        {f0: 300, f1: 1100, gwizd: .4, syk: .15});
      return d + .4;
    },
    lawinki(o, t) {                                // trzy lawiny: 6, 34, 60% z 6,5 s; po 1,9 s każda
      // tor jak w animacji: start poza kolumną, wysoko, zjazd ukosem do środka i zwalnianie
      const d = 6.5, bok = R() < .5 ? 1 : -1, W = innerWidth, H = innerHeight;
      [.06, .34, .6].forEach((at, i) => { const t1 = t + at*d, L = 1.9, strona = i % 2 ? -bok : bok;
        const x0 = W*(.5 - strona*(.3 + R()*.14)), y0 = H*(.04 + R()*.1), kat = (38 + R()*16)*Math.PI/180;
        const dx = strona*Math.cos(kat), dy = Math.sin(kat), dl = H*(.5 + R()*.2), T = L + .5;
        const p = tor(o, t1, T, u => { const q = Math.min(1, u*T/L), e = 1 - Math.pow(1 - q, 2.2);
          return [x0 + dx*dl*e, y0 + dy*dl*e, .45 - .25*e]; });
        const h = src('brown', t1, L + .5), lp = filt('lowpass', 240, .9), g = gain(0); h.connect(lp).connect(g).connect(p);
        const glos = przestrzen ? 1.4 : 1;
        krzywa(g.gain, t1, L + .4, u => { const q = u*(L + .4)/L; return glos*(q > 1 ? .9*Math.max(0, 1 - (q - 1)*5) : 1.4*Math.sin(Math.min(1, q*1.15)*Math.PI)); });
        const s = src('pink', t1, L), bp = filt('bandpass', 1700, .6), g2 = gain(0); s.connect(bp).connect(g2).connect(p);
        krzywa(g2.gain, t1, L, u => glos*.28*Math.sin(Math.min(1, u*1.15)*Math.PI));
        for (let k = 0; k < 22; k++) { const u = R()*.8; uderz(p, t1 + u*L, {f: 200 + R()*500, q: 1, dur: .03, vol: glos*.25*Math.sin(Math.min(1, u*1.15)*Math.PI), typ: 'lowpass', szum: 'brown'}); }
      });
      return d + 1.5;
    },
    bidon(o, t, btn) {                             // odbicia i lot liczone tą samą fizyką co animacja
      const {hity, sciezka, y0} = bidonUderzenia(btn), H = innerHeight;
      if (!sciezka.length) return 1;
      const glab = y => clamp((y - y0)/H, 0, 1);    // jak w animacji: im niżej, tym głębiej w przepaść
      const kon = sciezka.length*.016, pkt = u => sciezka[Math.min(sciezka.length - 1, Math.round(u*(sciezka.length - 1)))];
      // lot: cichy świst ciągnięty za butelką, głośniejszy, gdy leci szybko
      const lot = tor(o, t, kon, u => { const [x, y] = pkt(u); return [x, y, glab(y)]; });
      const s = src('pink', t, kon), bp = filt('bandpass', 1100, 1.4), g = gain(0); s.connect(bp).connect(g).connect(lot);
      krzywa(g.gain, t, kon, u => .16*clamp(Math.abs(pkt(u)[2])/10, 0, 1));
      uderz(miejsce(o, sciezka[0][0], sciezka[0][1]), t, {f: 1600, q: 1, dur: .08, vol: .08});
      hity.forEach(h => { const m = miejsce(o, h.x, h.y, glab(h.y)), vol = .55*(przestrzen ? 1.25 : 1 - h.nr*.09);
        ping(m, t + h.t, 640 + R()*80, {dur: .4, vol: vol*.6});
        uderz(m, t + h.t, {f: 2600, q: .8, dur: .015, vol});
        uderz(m, t + h.t, {f: 900, q: 1, dur: .05, vol: vol*.6});
        for (let k = 0; k < 4; k++) uderz(m, t + h.t + .03 + R()*.25, {f: 2000 + R()*3000, q: 2, dur: .006, vol: vol*.25}); });
      return (hity.length ? hity[hity.length - 1].t : 3) + 1.6;
    },
    odpadasz(o, t, btn) {                          // ześlizg, lot, szarpnięcie liny, wybieranie
      const {t: tc} = linaChwyt(btn);
      uderz(o, t, {f: 1300, q: .8, dur: .12, vol: .35, szum: 'pink'});
      for (let i = 0; i < 5; i++) uderz(o, t + .03 + R()*.18, {f: 2500 + R()*2500, q: 2, dur: .008, vol: .15});
      const sw = src('pink', t, tc), bp = filt('bandpass', 300, 1), g = gain(0); sw.connect(bp).connect(g).connect(o);
      krzywa(g.gain, t, tc, u => .5*u*u); krzywa(bp.frequency, t, tc, u => 300 + 900*u);
      const tt = t + tc;
      ton(o, tt, {f: 80, f2: 38, dur: .3, vol: .8});
      const o1 = A.createOscillator(), g1 = gain(0), f1 = filt('lowpass', 900, 2); o1.type = 'sawtooth';
      o1.connect(f1).connect(g1).connect(o); o1.frequency.setValueAtTime(150, tt); o1.frequency.exponentialRampToValueAtTime(92, tt + .7);
      krzywa(g1.gain, tt, 1.1, u => .22*Math.exp(-u*5)*(1 + .4*Math.sin(u*70))); o1.start(tt); o1.stop(tt + 1.15);
      ping(o, tt + .01, 2650, {mn: [1, 1.52, 2.71, 3.9], dur: .5, vol: .18});
      [.9, 1.8].forEach(k => uderz(o, tt + k, {f: 500, q: 4, dur: .15, vol: .07}));
      for (let k = 0; t + 3.5 + k*.085 < t + 5.35; k++) uderz(o, t + 3.5 + k*.085, {f: 3200, q: 3, dur: .006, vol: .1});
      const tar = src('pink', t + 3.5, 1.85), bt = filt('bandpass', 1100, 1.2), gt = gain(0); tar.connect(bt).connect(gt).connect(o);
      krzywa(gt.gain, t + 3.5, 1.85, u => .12*envF(u, .2, .3));
      return 6.2;
    },
    drzenie(o, t) {                                // drżący wydech i szybkie serce
      const d = 3.6;
      const s = src('pink', t, d), bp = filt('bandpass', 750, 1.2), g = gain(0); s.connect(bp).connect(g).connect(o);
      krzywa(g.gain, t, d, u => .3*envF(u, .2, .35)*(.55 + .45*Math.sin(u*d*TAU8)));
      for (let k = 0; k*.5 < d - .3; k++) serce(o, t + k*.5, .3*envF(k*.5/d, .2, .3));
      return d + .4;
    },
    most(o, t) {                                   // mara nocna: dudnienie, serce, nagłe przebudzenie
      const d = 6.2, budz = d - .55;
      const dr = filt('lowpass', 320, .6), g = gain(0); dr.connect(g).connect(o);
      krzywa(g.gain, t, budz + .05, u => .14*smooth(u/.35));
      [55, 55.6, 82.4, 110.3].forEach(f => { const os = A.createOscillator(); os.type = 'triangle'; os.frequency.value = f; os.connect(dr); os.start(t); os.stop(t + budz + .08); });
      const br = src('brown', t, budz), lb = filt('lowpass', 90, .7), gb = gain(0); br.connect(lb).connect(gb).connect(o);
      krzywa(gb.gain, t, budz, u => .5*smooth(u/.3));
      for (let k = 0; .6 + k*1.05 < budz; k++) serce(o, t + .6 + k*1.05, .35);
      oddech(o, t + budz, {wdech: .35, wydech: .4, vol: .45, f: 1300});
      return d + 1;
    },
    'most-stary'(o, t) {                           // skrzypienie kładki na wietrze
      const d = 5.2;
      wiatr(o, t, d, u => .35*envF(u, .2, .3), {gwizd: .1, syk: .05});
      for (let i = 0; i < 6; i++) { const tt = t + .3 + i*.8 + R()*.3, os = A.createOscillator(), lfo = A.createOscillator(), lg = gain(0), bp = filt('bandpass', 700 + R()*500, 5), g = gain(0);
        os.type = 'sawtooth'; os.frequency.value = 90 + R()*60; lfo.type = 'square'; lfo.frequency.value = 22 + R()*16;
        lfo.connect(lg.gain); os.connect(lg).connect(bp).connect(g).connect(o);
        krzywa(g.gain, tt, .45, u => .3*Math.sin(u*Math.PI)); os.start(tt); lfo.start(tt); os.stop(tt + .5); lfo.stop(tt + .5); }
      return d + .4;
    },
    blysk(o, t, btn) {                             // błysk jest cichy, liczenie też (autor: bez tykania); potem grzmot
      // Grzmot z nagrania autora (refumedia, Pixabay), skrócony do 4,6 s. Po dziewięciu jest daleko:
      // ciszej i głucho (wysokie tony giną z odległością); po sześciu bliżej — pełny i głośniejszy.
      const ile = blyskIle(btn), tg = t + .62 + ile*.334, blisko = ile === 6;
      probka('grzmot').then(b => {
        const s = A.createBufferSource(), lp = filt('lowpass', blisko ? 9000 : 1100, .6), g = gain(blisko ? 1 : .55);
        s.buffer = b; s.connect(lp).connect(g).connect(o); s.start(Math.max(tg, A.currentTime + .01));
      }).catch(() => grzmot(o, tg, blisko ? {moc: 1.15, dal: .45, opozn: .02} : {moc: .75, dal: .9, opozn: .02}));
      return .62 + ile*.334 + 5;
    },
    puf(o, t) {                                    // dmuchnięcie, litery jak piasek od lewej do prawej, powrót
      const d = 3.9;
      oddech(o, t + .02, {wdech: .02, wydech: .3, vol: .3, f: 700});
      for (let i = 0; i < 260; i++) { const u = .15 + Math.pow(R(), 1)*1.1;
        uderz(o, t + u, {f: 5000 + R()*5000, q: 1, dur: .002 + R()*.004, vol: .03 + R()*.06, pan: -.7 + 1.4*(u - .15)/1.1}); }
      const w = src('pink', t + 2.9, .6), bp = filt('bandpass', 400, 1), g = gain(0); w.connect(bp).connect(g).connect(o);
      krzywa(bp.frequency, t + 2.9, .55, u => 400 + 3000*u*u); krzywa(g.gain, t + 2.9, .55, u => .25*u*u*(u > .92 ? (1 - u)/.08 : 1));
      ping(o, t + 3.45, 1760, {mn: [1, 2, 3], dur: .5, vol: .04});
      return d + .8;
    },
    'dwa~'(o, t) {                                 // STARA: dwoje idzie krok za krokiem, dwa tony
      const d = 6.5;
      wiatr(o, t, d, u => .18*envF(u, .2, .3), {gwizd: 0, syk: .03, f0: 200, f1: 380, vol: .6});
      plama(o, t, d, [659.3], {typ: 'sine', lp: 4000, vol: .025, a: .25, b: .3, drzenie: .3});
      plama(o, t + .6, d - .6, [987.8], {typ: 'sine', lp: 4000, vol: .018, a: .25, b: .3, drzenie: .3});
      for (let k = 0; .3 + k*.62 < d - .5; k++) { const u = (.3 + k*.62)/d;
        krok(o, t + .3 + k*.62, .13*envF(u, .15, .25), -.25); krok(o, t + .62 + k*.62, .11*envF(u, .15, .25), .25); }
      return d + .8;
    },
    'choinka~'(o, t) {                             // STARA: dzwonki od dołu
      const d = 6.5, skala = [220, 246.9, 277.2, 329.6, 370];
      wiatr(o, t, d, u => .15*envF(u, .2, .3), {gwizd: 0, syk: .02, f0: 200, f1: 350, vol: .5});
      choinkaCzasy().forEach((tt, i) => { const f = skala[i % 5]*Math.pow(2, Math.floor(i/5)/2 + 1);
        ton(o, t + tt, {f, dur: 1.4, vol: .09*(1 - i/40), atak: .003}); ton(o, t + tt, {f: f*2.01, dur: .5, vol: .02, atak: .003}); });
      return d + 1.5;
    },
    oczami(o, t) {                                 // wysoko: równy wiatr i łopot skrzydła
      const d = 6.4;
      wiatr(o, t, d, u => .45*envF(u, .25, .3), {gwizd: .05, syk: .08, f0: 260, f1: 700});
      const s = src('pink', t, d), bp = filt('bandpass', 260, 1.5), g = gain(0); s.connect(bp).connect(g).connect(o);
      krzywa(g.gain, t, d, u => .25*envF(u, .25, .3)*(.5 + .5*Math.abs(Math.sin(u*d*11 + Math.sin(u*d*1.7)*3))));
      return d + .5;
    },
    kamienie(o, t) {                               // dziewięć kamieni, trzy półki — ta sama fizyka
      const H = innerHeight, col = document.querySelector('article').getBoundingClientRect(), cx = col.left + col.width*(.35 + R()*.3);
      const polki = [.38, .62, .82].map(f => H*f + (R() - .5)*30), glos = przestrzen ? .9 : 1;
      for (let i = 0; i < 9; i++) { const od = .12 + i*.17 + R()*.12; let x = cx + (R() - .5)*50, vx = (R() - .5)*1.4, y = -20 - R()*60, vy = 0, hit = 0;
        for (let k = 0; k < 300 && hit < 3; k++) { vy += .42; y += vy; x += vx;
          for (const py of polki) if (hit < 3 && y > py && y - vy <= py) { y = py; vy = -Math.abs(vy)*.38; vx = (R() - .5)*4;
            const tt = t + od + k*.016, vol = glos*.5*(1 - hit*.25), m = miejsce(o, x, py, .1 + hit*.12);
            uderz(m, tt, {f: 1800 + R()*1600, q: 2.5, dur: .02 + R()*.03, vol});
            uderz(m, tt + .012, {f: 1200 + R()*900, q: 3, dur: .015, vol: vol*.6});
            ton(m, tt, {f: 140 + R()*80, f2: 70, dur: .06, vol: vol*.45}); hit++; } } }
      return 6;
    },
    'brocken~'(o, t) {                             // STARA: eteryczne „aaa” w mgle (kojarzyło się z kościołem)
      const d = 6, f1 = filt('bandpass', 750, 4), f2 = filt('bandpass', 1150, 5), g = gain(0);
      f1.connect(g); f2.connect(g); g.connect(o);
      krzywa(g.gain, t, d, u => .22*envF(u, .3, .35)*(.75 + .25*Math.sin(u*d*1.6)));
      [220, 277.2, 329.6, 440].forEach(f => [-1, 1].forEach(k => { const os = A.createOscillator(); os.type = 'sawtooth'; os.frequency.value = f; os.detune.value = k*7;
        os.connect(f1); os.connect(f2); os.start(t); os.stop(t + d + .1); }));
      wiatr(o, t, d, u => .15*envF(u, .3, .3), {gwizd: 0, syk: .03, vol: .6});
      return d + 1.5;
    },
    czolowka(o, t) {                               // gęsta zamieć za kręgiem, własny oddech i kroki
      const d = 9, lp = filt('lowpass', 1400, .5); lp.connect(o);
      wiatr(lp, t, d, u => envF(u, .1, .2)*clamp(.7 + .2*Math.sin(u*d*1.4) + .1*Math.sin(u*d*4.3), 0, 1), {gwizd: .2, syk: .2, f0: 260, f1: 800});
      for (let k = 0; .5 + k*2.1 < d - 1; k++) oddech(o, t + .5 + k*2.1, {wdech: .8, wydech: 1.1, vol: .2, f: 850});
      for (let k = 0; .3 + k*.75 < d - .5; k++) krok(o, t + .3 + k*.75, .14, k % 2 ? .15 : -.15);
      return d + .4;
    },
    ruch(o, t) {                                   // sekundy, serce przyspiesza, napięcie rośnie
      const dr = A.createOscillator(), lp = filt('lowpass', 200, 1), g = gain(0); dr.type = 'sawtooth'; dr.frequency.value = 49;
      dr.connect(lp).connect(g).connect(o); krzywa(g.gain, t, 6, u => .1 + .12*u); krzywa(lp.frequency, t, 6, u => 160 + 500*u*u);
      dr.start(t); dr.stop(t + 6.05);
      for (let k = 0; k < 6; k++) ping(o, t + k, 1900, {mn: [1, 2.7], dur: .05, vol: .08});
      let tt = .3, okres = 1; while (tt < 6) { serce(o, t + tt, .25 + .35*tt/6); okres = Math.max(.5, okres*.9); tt += okres; }
      ruchStan = {o, t};
      return 9;
    },
    kadr(o, t) {                                   // ostrzenie celownika, potem szelest papierów
      ton(o, t + .05, {f: 2600, dur: .05, vol: .05, typ: 'square'}); ton(o, t + .13, {f: 2600, dur: .05, vol: .05, typ: 'square'});
      for (let i = 0; i < 8; i++) { const tt = t + .6 + i*.45 + R()*.25, pan = (i % 2 ? 1 : -1)*(.4 + R()*.4);
        const s = src('white', tt, .5), bp = filt('bandpass', 3000 + R()*2000, .8), g = gain(0), p = A.createStereoPanner(); p.pan.value = pan;
        s.connect(bp).connect(g).connect(p).connect(o);
        krzywa(g.gain, tt, .45, u => .14*Math.sin(u*Math.PI)*(.4 + .6*Math.abs(Math.sin(u*60 + R()))));
        uderz(o, tt + .38, {f: 500, q: .7, dur: .04, vol: .1, typ: 'lowpass', pan}); }
      return 6.6;
    },
    // ---- refreny ----
    cyk(o, t) {                                    // aparat z lampą: suchy, jasny, z bliska — bez pisku ładowania
      // lampa błyska najwyżej raz na 1,2 s — tak jak w efekcie; przy szybkim klikaniu zostaje sama migawka
      const teraz = performance.now(), flesz = teraz - cykFlesz > 1200; if (flesz) cykFlesz = teraz;
      // spust i lustro: ostre „klik” z twardym atakiem
      uderz(o, t + .22, {f: 6500, q: .7, dur: .004, vol: .45, typ: 'highpass'});
      uderz(o, t + .221, {f: 3200, q: 1.8, dur: .008, vol: .35});
      uderz(o, t + .223, {f: 1700, q: 2.5, dur: .012, vol: .18});
      // błysk lampy: krótki, metaliczny „pstryk” wyładowania
      if (flesz) { uderz(o, t + .33, {f: 8000, q: .7, dur: .006, vol: .4, typ: 'highpass'}); uderz(o, t + .331, {f: 4200, q: 3, dur: .01, vol: .2}); }
      // kurtyna wraca: drugie, ciut niższe „klak”
      uderz(o, t + .36, {f: 5500, q: .7, dur: .004, vol: .35, typ: 'highpass'});
      uderz(o, t + .361, {f: 2600, q: 2, dur: .01, vol: .28});
      return 1.2;
    },
    klik(o, t) {                                   // klik myszy i przytłumiony szum „myślenia”, bez pikania
      const teraz = performance.now(); klikLevel = teraz - klikLast < 2200 ? Math.min(5, klikLevel + 1) : 1; klikLast = teraz;
      const L = klikLevel, d = (450 + 320*L)/1000;
      uderz(o, t, {f: 3500, q: 2, dur: .004, vol: .3}); uderz(o, t + .002, {f: 1100, q: 3, dur: .008, vol: .15});         // wciśnięcie
      uderz(o, t + .085, {f: 4200, q: 2, dur: .003, vol: .16}); uderz(o, t + .087, {f: 1300, q: 3, dur: .006, vol: .07});  // puszczenie
      // praca maszyny: miękki szum jak wentylator, który przyspiesza — przy szybkim klikaniu wyżej i dłużej
      const s = src('pink', t, d + .25), bp = filt('bandpass', 260, 1.1), g = gain(0); s.connect(bp).connect(g).connect(o);
      krzywa(bp.frequency, t, d + .25, u => 240 + 90*L*smooth(u/.6)); krzywa(g.gain, t, d + .25, u => (.08 + .03*L)*envF(u, .3, .25));
      const os = A.createOscillator(), go = gain(0); os.frequency.setValueAtTime(110, t); os.frequency.linearRampToValueAtTime(110 + 8*L, t + d);
      os.connect(go).connect(o); krzywa(go.gain, t, d + .25, u => (.015 + .004*L)*envF(u, .3, .25)); os.start(t); os.stop(t + d + .3);
      uderz(o, t + d + .05, {f: 1800, q: 1, dur: .006, vol: .07});                                                  // tekst wraca
      return d + .5;
    },
    'wtf~'(o, t) {                                 // SYNTEZA (zapas, gdy nagranie się nie wczyta): zacięcie, zawieszenie, restart
      wtfLevel = Math.min(6, wtfLevel + 1);
      const L = wtfLevel, kr = krusz(9 - L), out = gain(1); kr.connect(out).connect(o);
      // 1. zacięcie: jedno krótkie ziarno dźwięku powtarzane jak zacięty bufor, coraz krócej
      let x = 0;
      for (let seria = 0; seria < 2 + Math.floor(L/2); seria++) { const f = 300 + R()*2200, n = 4 + Math.floor(R()*4), pan = R()*1.4 - .7;
        for (let k = 0; k < n; k++) { const len = .045*(1 - k/n*.6);
          uderz(kr, t + x, {f, q: 5, dur: len*.4, vol: .22, pan}); ton(kr, t + x, {f: f/3, dur: len*.5, vol: .1, typ: 'sawtooth', pan}); x += len; } }
      // 2. zawieszenie: buczenie stoi, a potem system gaśnie — dźwięk zjeżdża w dół
      const tz = t + x, os = A.createOscillator(), lp = filt('lowpass', 2600, 1.5), gz = gain(0); os.type = 'sawtooth';
      os.frequency.setValueAtTime(96, tz); os.frequency.setValueAtTime(96, tz + .22); os.frequency.exponentialRampToValueAtTime(24, tz + .75);
      lp.frequency.setValueAtTime(2600, tz + .22); lp.frequency.exponentialRampToValueAtTime(110, tz + .72);
      os.connect(lp).connect(gz).connect(kr); gz.gain.setValueAtTime(.16 + .03*L, tz); gz.gain.setValueAtTime(.16 + .03*L, tz + .3); gz.gain.linearRampToValueAtTime(0, tz + .78);
      os.start(tz); os.stop(tz + .8);
      ton(o, tz + .22, {f: 62, f2: 26, dur: .5, vol: .35 + .05*L});                                                // spadek basu
      // 3. martwy system: ciche buczenie sieci i trzaski
      const th = tz + .78, tr = Math.max(th + .6, t + 2.1), hum = A.createOscillator(), gh = gain(0); hum.frequency.value = 50;
      hum.connect(gh).connect(o); krzywa(gh.gain, th, tr - th, u => .03*envF(u, .1, .1)); hum.start(th); hum.stop(tr);
      for (let k = 0; k < 3 + L; k++) uderz(o, th + R()*(tr - th), {f: 2000 + R()*4000, q: 2, dur: .003, vol: .08});
      // 4. restart: przekaźnik, narastający rozruch, dwa krótkie potwierdzenia
      uderz(o, tr, {f: 3000, q: 2, dur: .008, vol: .3}); ton(o, tr, {f: 120, f2: 60, dur: .05, vol: .2});
      const rs = A.createOscillator(), rl = filt('lowpass', 300, 2), rg = gain(0); rs.type = 'sawtooth';
      rs.frequency.setValueAtTime(55, tr + .05); rs.frequency.exponentialRampToValueAtTime(440, tr + .45);
      rl.frequency.setValueAtTime(300, tr + .05); rl.frequency.exponentialRampToValueAtTime(3500, tr + .45);
      rs.connect(rl).connect(rg).connect(o); krzywa(rg.gain, tr + .05, .45, u => .1*Math.sin(u*Math.PI*.95)); rs.start(tr + .05); rs.stop(tr + .52);
      [.55, .63].forEach(y => uderz(o, tr + y, {f: 2400, q: 3, dur: .005, vol: .12}));
      return tr - t + 1.1;
    },
    'wtf-stary~'(o, t) {                           // SYNTEZA (zapas): zacięcie, twarde szarpnięcie, zgaśnięcie
      const kr = krusz(4), out = gain(1); kr.connect(out).connect(o);
      let x = 0; const f = 400 + R()*1600;
      for (let k = 0; k < 7; k++) { const len = .05*(1 - k/7*.6); uderz(kr, t + x, {f: f*(k % 2 ? 1.5 : 1), q: 5, dur: len*.4, vol: .22, pan: (k % 2 ? .4 : -.4)});
        ton(kr, t + x, {f: f/3, dur: len*.5, vol: .1, typ: 'sawtooth'}); x += len; }
      // szarpnięcie strony (0,85 s): brudny, cyfrowy trzask
      const s = src('white', t, .85), bp = filt('bandpass', 1800, .8), g = gain(0); s.connect(bp).connect(g).connect(kr);
      krzywa(g.gain, t, .85, u => .25*Math.exp(-u*4)*(.5 + .5*Math.sign(Math.sin(u*70))));
      ton(o, t + x, {f: 70, f2: 28, dur: .4, vol: .35});
      return 1.8;
    },

    // WTF i WTF z Orlej Perci: nagranie glitcha (kave_msri, Pixabay; autor 2026-11-16).
    // Każde odtworzenie trochę inaczej (prędkość ±6%); refren WTF z każdym kliknięciem głośniej.
    wtf(o, t) {
      wtfLevel = Math.min(6, wtfLevel + 1); const L = wtfLevel;
      probka('glitch').then(b => { const s = A.createBufferSource(), g = gain(.7 + .05*L);
        s.buffer = b; s.playbackRate.value = .94 + R()*.12; s.connect(g).connect(o); s.start(Math.max(t, A.currentTime + .005)); })
        .catch(() => S['wtf~'](o, t));
      return 2;
    },
    'wtf-stary'(o, t) {
      probka('glitch').then(b => { const s = A.createBufferSource(), g = gain(.85);
        s.buffer = b; s.playbackRate.value = .9 + R()*.1; s.connect(g).connect(o); s.start(Math.max(t, A.currentTime + .005)); })
        .catch(() => S['wtf-stary~'](o, t));
      return 2;
    },
    enter(o, t, btn) {                             // pisanie pytania i wysłanie; dymki łapie obserwator
      const em = btn.parentElement && [...btn.parentElement.querySelectorAll('em')].find(e => btn.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
      uderz(o, t, {f: 2500, q: 1, dur: .01, vol: .25}); ton(o, t, {f: 300, dur: .03, vol: .08});
      if (em) { for (let x = .9; x < 3; x += .07 + R()*.09) uderz(o, t + x, {f: 2500 + R()*1500, q: 2, dur: .006, vol: .06}); return 3.5; }
      const n = 'Z kim my właściwie rozmawiamy?'.length;
      for (let k = 1; k <= n; k++) uderz(o, t + k*.028, {f: 2200 + R()*2000, q: 2, dur: .006, vol: .08 + R()*.05});
      const ws = t + n*.028 + .35, s = src('pink', ws, .3), bp = filt('bandpass', 800, 1), g = gain(0); s.connect(bp).connect(g).connect(o);
      bp.frequency.linearRampToValueAtTime(3000, ws + .25); krzywa(g.gain, ws, .25, u => .15*Math.sin(u*Math.PI));
      return 16;
    },
    dlugo() { return 20; },                        // tylko obserwator dymków
    test(o, t) { uderz(o, t, {f: 1500, q: 1, dur: .01, vol: .1}); return 10; },
    oszus(o, t) {                                  // „t” wyskakuje, chwieje się i odpada
      ton(o, t + .1, {f: 1400, f2: 1900, dur: .05, vol: .06});
      [1.1, 1.3, 1.5].forEach(x => uderz(o, t + x, {f: 2800, q: 6, dur: .01, vol: .06}));
      ton(o, t + 1.75, {f: 900, f2: 300, dur: .5, vol: .04});
      uderz(o, t + 2.9, {f: 1800, q: 3, dur: .012, vol: .12}); uderz(o, t + 2.98, {f: 2200, q: 3, dur: .008, vol: .05});
      return 3.6;
    },
    shipit(o, t) {                                 // tuby z konfetti, owacja całej sali — i nagle zostaje kilka osób
      [[0, 0, 1], [.17, -.5, .7], [.3, .5, .6]].forEach(([x, pan, m]) => {
        uderz(o, t + x, {f: 700, q: .5, dur: .06, vol: .8*m, szum: 'pink', pan}); ton(o, t + x, {f: 140, f2: 50, dur: .1, vol: .6*m, pan});
        uderz(o, t + x, {f: 4000, q: .5, dur: .01, vol: .4*m, typ: 'highpass', pan}); });
      for (let i = 0; i < 220; i++) { const x = .05 + Math.pow(R(), 1.4)*2.4; uderz(o, t + x, {f: 3000 + R()*4000, q: 1, dur: .006, vol: .05*(1 - x/2.6), pan: R()*1.8 - .9}); }
      // owacja: kilkadziesiąt par dłoni; po chwili siada, zostają trzy osoby
      for (let c = 0; c < 46; c++) { const okres = .17 + R()*.14, pan = R()*1.8 - .9, start = .2 + R()*.35, koniec = c < 3 ? 3.7 : 1.3 + R()*.9, f = 900 + R()*1700;
        for (let x = start; x < koniec; x += okres*(1 + (R() - .5)*.15)) uderz(o, t + x, {f: f*(1 + (R() - .5)*.2), q: 1.3, dur: .018, vol: (c < 3 ? .14 : .07)*(1 - .3*x/koniec), pan}); }
      // okrzyki: kilka krótkich „łuuu” z sali
      for (let k = 0; k < 4; k++) { const tt = t + .35 + R()*.5, dd = .7 + R()*.4, s = src('pink', tt, dd), f1 = filt('bandpass', 500 + R()*200, 4), f2 = filt('bandpass', 1000 + R()*300, 5), g = gain(0), pp = A.createStereoPanner();
        pp.pan.value = R()*1.6 - .8; s.connect(f1); s.connect(f2); f1.connect(g); f2.connect(g); g.connect(pp).connect(o);
        krzywa(f1.frequency, tt, dd, u => (500 + 250*u)); krzywa(g.gain, tt, dd, u => .5*Math.sin(u*Math.PI)*(1 - .4*u)); }
      return 4.4;
    },
  };
  const TAU8 = Math.PI*2*8;
  let ruchStan = null;

  // ---------- zdarzenia z DOM-u: dymki, test, ruch ----------
  function zDomu(muts) {
    if (!wlaczony || !A) return;
    const t = A.currentTime + .01;
    let stary = false;
    for (const m of muts) {
      if (m.type === 'childList') for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        if (n.classList.contains('dymek')) {
          const o = szyna(n.classList.contains('dziecko') ? -.25 : .25, .15, poziom('dlugo')).in;
          if (n.querySelector('.pisze')) [0, .18, .36].forEach(x => uderz(o, t + .2 + x, {f: 1800, q: 3, dur: .01, vol: .05}));
          else n.classList.contains('dziecko') ? (ton(o, t, {f: 1046, dur: .1, vol: .07}), ton(o, t + .06, {f: 1318, dur: .12, vol: .06}))
                                               : ton(o, t, {f: 659, dur: .14, vol: .07});
        }
        if (n.classList.contains('msg')) { const o = szyna(n.classList.contains('me') ? .3 : (R() - .5)*.8, .1, poziom('enter')).in;
          ton(o, t, {f: n.classList.contains('me') ? 880 : 520 + R()*300, dur: .07, vol: .045}); }
        if (n.classList.contains('test-czlowieka')) ton(szyna(0, .1, poziom('test')).in, t, {f: 1200, dur: .05, vol: .04});
      }
      if (m.type === 'attributes' && m.target instanceof HTMLElement) {
        const el = m.target, o = k => szyna(0, .15, poziom(k)).in;
        if (el.classList.contains('tc-pole') && el.classList.contains('krec') && !el.dataset.dz) { el.dataset.dz = 1; const b = o('test');
          for (let x = 0; x < 1.55; x += .11) uderz(b, t + x, {f: 2400, q: 5, dur: .006, vol: .04}); }
        if (el.classList.contains('tc-pole') && el.classList.contains('zle') && el.dataset.dz !== '2') { el.dataset.dz = 2; const b = o('test');
          ton(b, t, {f: 330, dur: .14, vol: .08, typ: 'square'}); ton(b, t + .16, {f: 247, dur: .25, vol: .08, typ: 'square'}); }
        // WTF z Orlej Perci odpala się poza silnikiem (script.js: glitch). Restart animacji zdejmuje
        // i zakłada klasę — w jednej paczce zmian są dwa wpisy, a dźwięk ma zagrać raz.
        if (el.dataset.fx === 'wtf-stary' && el.classList.contains('is-glitching') && !stary) { stary = true; zagraj('wtf-stary', el); }
        if (el.classList.contains('ruch-pole') && ruchStan) {
          if (el.classList.contains('zrobione')) { graj.get('ruch')?.stop(t, .08); const b = o('ruch');
            uderz(b, t, {f: 1200, q: .8, dur: .1, vol: .35, szum: 'pink'}); ton(b, t, {f: 90, f2: 45, dur: .2, vol: .5});
            oddech(b, t + .4, {wdech: .5, wydech: 1.2, vol: .3}); ruchStan = null; }
          else if (el.classList.contains('zgaslo')) { const b = o('ruch');
            ton(b, t, {f: 98, dur: 1.4, vol: .25, typ: 'triangle'}); ton(b, t + .02, {f: 92.5, dur: 1.4, vol: .2, typ: 'triangle'}); ruchStan = null; }
        }
      }
    }
  }

  // ---------- mikser: poziom każdego dźwięku z robocze/mikser.html (localStorage) ----------
  let MIX = {};
  const wczytajMix = () => { try { MIX = JSON.parse(localStorage.getItem('alpinista:mikser') || '{}'); } catch { MIX = {}; } };
  wczytajMix();
  addEventListener('storage', e => { if (e.key === 'alpinista:mikser') wczytajMix(); });   // zmiana w drugiej karcie
  const poziom = n => (MIX.efekty?.[n] ?? 1)*(MIX.grupy?.efekty ?? 1);

  // ---------- przełącznik, głośność, podpięcie pod silnik ----------
  let glosnosc = .8;
  // wyrównanie poziomów po pomiarze (Dzwieki.zmierz): ciche szkice podciągnięte do reszty
  const POZIOM = {szron: 1.8, puf: 2, kadr: 1.6, oszus: 1.8, 'dwa~': 1.4, swietliki: .6, dwa: 3.2, choinka: .5, brocken: 2.2, klik: 1.5, wtf: .7, 'wtf-stary': .7, 'most-stary': 1.5, oczami: 1.3};
  const graj = new Map();                          // nazwa → szyna grającego dźwięku
  function zagraj(name, btn) {
    if (!wlaczony || !A || !S[name]) return;
    if (A.state === 'suspended') A.resume();
    const t = A.currentTime + .02, stary = graj.get(name);
    if (stary) stary.stop(t);
    const klucz = staraWersja && S[name + '~'] ? name + '~' : name;
    const sz = szyna(0, name === 'lawinki' || name === 'kamienie' || name === 'szczelina' ? .5 : name === 'cyk' ? .03 : .25, (POZIOM[klucz] || 1)*poziom(name));
    const dl = S[klucz](sz.in, t, btn) || 6;
    // tło rozdziału na chwilę cichnie pod efektem (dzwiek.js)
    dispatchEvent(new CustomEvent('dzwiek:efekt', {detail: {nazwa: name, czas: Math.min(dl, 8)}}));
    graj.set(name, sz);
    setTimeout(() => { if (graj.get(name) === sz) graj.delete(name); }, dl*1000);
  }
  function podepnij() {
    const E = window.Efekty;
    if (!E || E.__dz) return !!E;
    const org = E.uruchom.bind(E);
    E.uruchom = (btn, ev) => {
      const name = btn.dataset.fx, bylo = btn.getAttribute('aria-pressed') === 'true';
      org(btn, ev);
      if (bylo) { const s = graj.get(name); if (s && A) { s.stop(A.currentTime); graj.delete(name); } return; }   // drugie kliknięcie przerywa
      if (!E.czyDziala() && !['klik', 'enter'].includes(name)) return;     // efekt się nie odpalił (np. ograniczony ruch)
      zagraj(name, btn);
    };
    E.__dz = true;
    return true;
  }
  // Na stronie efekty.js wczytuje się dopiero przy pierwszym kliknięciu frazy i od razu uruchamia
  // efekt — podpięcie musi więc nastąpić w chwili, gdy silnik się przedstawi (window.Efekty = …),
  // inaczej pierwszy efekt byłby niemy.
  if (!podepnij()) {
    let czeka;
    Object.defineProperty(window, 'Efekty', {configurable: true, get: () => czeka,
      set(v) { Object.defineProperty(window, 'Efekty', {value: v, writable: true, configurable: true}); podepnij(); }});
  }
  new MutationObserver(zDomu).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});

  const btn = document.getElementById('t-dzwiek'), suw = document.getElementById('t-glosnosc');
  if (btn) btn.addEventListener('click', () => {
    wlaczony = !wlaczony;
    if (wlaczony && !A) przygotuj(wspolny());
    if (A) { if (wlaczony) A.resume(); else { graj.forEach(s => s.stop(A.currentTime, .15)); graj.clear(); } }
    btn.textContent = wlaczony ? 'dźwięk: wł.' : 'dźwięk: wył.';
    btn.setAttribute('aria-pressed', String(wlaczony));
  });
  let staraWersja = false;
  const wer = document.getElementById('t-wersja');
  if (wer) wer.addEventListener('click', () => {
    staraWersja = !staraWersja;
    wer.textContent = staraWersja ? 'noc: stara' : 'noc: nowa';
    wer.setAttribute('aria-pressed', String(staraWersja));
  });
  const prz = document.getElementById('t-przestrzen');
  if (prz) prz.addEventListener('click', () => {
    przestrzen = !przestrzen;
    prz.textContent = przestrzen ? 'przestrzeń: wł.' : 'przestrzeń: wył.';
    prz.setAttribute('aria-pressed', String(przestrzen));
  });
  if (suw) suw.addEventListener('input', () => { glosnosc = +suw.value; if (master) master.gain.setTargetAtTime(glosnosc, A.currentTime, .05); });

  // pomiar do strojenia poziomów: await Dzwieki.zmierz() → szczyt i RMS każdego dźwięku (render offline)
  // atrapa zapalnika na środku ekranu — dla efektów, które liczą tor od miejsca frazy (mikser)
  let atrapa = null;
  const atrapaEl = () => { if (atrapa) return atrapa;
    atrapa = document.createElement('p'); atrapa.style.cssText = 'position:fixed;left:40%;top:30%;width:120px;height:20px;opacity:0;pointer-events:none';
    const sp = document.createElement('span'); sp.style.cssText = 'display:inline-block;width:100px;height:20px'; atrapa.append(sp); document.body.append(atrapa); return atrapa; };
  window.Dzwieki = { _bidon: b => bidonUderzenia(b),
    lista: () => Object.keys(S).filter(k => !k.endsWith('~')),
    ustaw(mix) { MIX = mix || {}; },
    graj(name) {                                   // odsłuch z miksera: bez efektu na ekranie
      if (!A) przygotuj(wspolny());
      wlaczony = true; A.resume();
      const el = atrapaEl().firstChild, t = A.currentTime + .03;
      if (name === 'dlugo') { const o = szyna(0, .15, poziom('dlugo')).in;
        [[1, 'd'], [2.2, 't'], [3.4, 'd'], [4.6, 't']].forEach(([x, k]) => k === 'd'
          ? (ton(o, t + x, {f: 1046, dur: .1, vol: .07}), ton(o, t + x + .06, {f: 1318, dur: .12, vol: .06})) : ton(o, t + x, {f: 659, dur: .14, vol: .07}));
        [0, .18, .36].forEach(x => uderz(o, t + 6 + x, {f: 1800, q: 3, dur: .01, vol: .05})); return; }
      if (name === 'test') { const o = szyna(0, .15, poziom('test')).in; ton(o, t, {f: 1200, dur: .05, vol: .04});
        for (let x = 0; x < 1.55; x += .11) uderz(o, t + .6 + x, {f: 2400, q: 5, dur: .006, vol: .04});
        ton(o, t + 2.2, {f: 330, dur: .14, vol: .08, typ: 'square'}); ton(o, t + 2.36, {f: 247, dur: .25, vol: .08, typ: 'square'}); return; }
      if (name === 'enter') { zagraj('enter', el); const o = szyna(0, .1, poziom('enter')).in;
        let x = 2.1, gap = .9; while (x < 9.4) { ton(o, t + x, {f: 520 + R()*300, dur: .07, vol: .045, pan: (R() - .5)*.8}); x += gap; gap = Math.max(.055, gap*.8); } return; }
      zagraj(name, el);
    },
    stop() { if (A) { graj.forEach(s => s.stop(A.currentTime, .15)); graj.clear(); } },
    // strona (dzwiek.js): dźwięki efektów idą za przełącznikiem „Dźwięki”
    wlacz(on) {
      wlaczony = !!on;
      if (wlaczony) { if (!A) przygotuj(wspolny()); if (A.state === 'suspended') A.resume(); probka('grzmot').catch(() => {}); probka('glitch').catch(() => {}); }
      else if (A) { graj.forEach(s => s.stop(A.currentTime, .3)); graj.clear(); }
    },
    async zmierz(nazwy = Object.keys(S)) {
      const zap = {A, master, wet}, wynik = {}, atrapa = document.querySelector('[data-fx]');
      for (const n of nazwy) {
        const btnN = document.querySelector(`[data-fx="${n}"]`) || atrapa, ctx = new OfflineAudioContext(2, 44100*14, 44100);
        przygotuj(ctx); const sz = szyna(0, .25); S[n](sz.in, .05, btnN);
        const buf = await ctx.startRendering(), d = buf.getChannelData(0);
        let pk = 0, sum = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; sum += v*v; }
        let cisza = d.length; while (cisza > 0 && Math.abs(d[cisza - 1]) < .001) cisza--;
        wynik[n] = {szczyt: +pk.toFixed(3), rms: +Math.sqrt(sum/Math.max(1, cisza)).toFixed(4), s: +(cisza/44100).toFixed(1)};
      }
      ({A, master, wet} = zap);
      return wynik;
    },
  };
})();
