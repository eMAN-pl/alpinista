/* Makiety gór: animowane otwarcia rozdziałów.
   Przeniesione z zatwierdzonego prototypu (assets/makiety-gor/src/template.html, opis
   w assets/makiety-gor/CLAUDE.md). Konfiguracja gór i shader 1:1 — wartości są wyważone
   przez autora, nie podbijać. Różnice wobec prototypu:
   - bez panelu: wszystkie efekty włączone na stałe, zamieć na Babiej w wariancie „porywy”;
   - jedna wspólna pętla klatek zamiast kilkunastu i tylko wtedy, gdy któraś góra jest
     na ekranie; scena i WebGL powstają dopiero przy zbliżeniu do góry;
   - obrazki i maski jako osobne pliki, nie base64;
   - „wyłącz efekty” i prefers-reduced-motion zostawiają sam nieruchomy obrazek;
   - „Kładka” z prototypu to rozdział o Skalce (slug „skalka”). */
(() => {
  const P = 'assets/web/makiety/';
  const CABLE = [0.0002384753362142403, 0.6024127994761487, -300.8828230773494];   // layers.json
  const MOUNTAINS = [
    { id:'pilsko', img:'pilsko.webp', mask:'mask-pilsko.png',
      plants:.0042, fall:.4, wave:1, spark:0, dur:7,
      impact:[719,566], waterfall:{ tile:'wf_tile.webp', splash_src:'wf_splash.webp', curtain:[677,446,762,566], splash:[648,527,792,576] } },
    { id:'dolina-pieciu-stawow', img:'dolina.webp', mask:'mask-dolina.png',
      plants:.0042, fall:0, wave:1, spark:0, dur:7.8,
      fish:{ left:'fishL.png', right:'fishR.png', box:[170,590,430,850],
             clip:[[181,601],[343,632],[343,650],[355,700],[365,750],[360,800],[300,840],[225,800],[186,690]], top:[[181,601],[415,646]],
             paths:[ {x:[212,318], y:660, len:30}, {x:[248,325], y:704, len:27} ] } },
    { id:'kozi-wierch', img:'kozi.webp', mask:'mask-kozi.png',
      plants:.0042, fall:0, wave:0, spark:0, dur:8.6 },
    { id:'mnich', img:'mnich-base.webp', mask:'mask-mnich.png',
      plants:.0042, fall:0, wave:0, spark:0, dur:7.4,
      pieces:[ {cls:'peb', src:'mnich-peb0.png', box:[653,906,698,956], style:'--pd:4.2s;--pr:7deg'},
               {cls:'peb', src:'mnich-peb1.png', box:[698,949,727,981], style:'--pd:3.4s;--pdl:-1.3s;--pr:-9deg'} ] },
    { id:'marmolada', img:'marm-base.webp', mask:'mask-marmolada.png',
      plants:0, rope:.024, fall:0, wave:0, spark:1, dur:8.2,
      pieces:[ {cls:'gondola', src:'marm-gondola.png', box:[700,248,750,328]} ] },
    { id:'everest', img:'everest.webp', mask:'mask-everest.png',
      plants:0, fall:0, wave:0, spark:0, drift:1, dur:8.8,
      clouds:[ {layer:'front', src:'cloudr0.webp', x:24, y:61, w:46, dur:46, delay:-31, amp:3.5, lift:-.5, op:.92, md:23, mdl:-7},
               {layer:'front', src:'cloudr2.webp', x:4, y:69, w:46, dur:38, delay:-15, amp:3,   lift:.5,  op:.9,  md:19, mdl:-11},
               {layer:'front', src:'cloudr1.webp', x:63, y:63, w:40, dur:52, delay:-12, amp:3,   lift:.6,  op:.95, md:21, mdl:-15} ] },
    { id:'babia-gora', img:'babia.webp', mask:'mask-babia.png',
      plants:.0034, fall:0, wave:0, spark:0, drift:2.4, driftSpeed:-1.7, wisps:1, wispsDir:1, gusty:true, dur:9.2,
      blizzard:'snowtile.webp', blizzardMask:'blizmask.png', blizzardBack:'blizmask_back.png',
      lamp:{ x:252, y:378, r:70 } },
    { id:'rysy', img:'rysy.webp', mask:'mask-rysy.png',
      plants:.0034, fall:0, wave:1, spark:0, dur:8.4,
      flash:{ src:'flash.png', x:367, y:20, r:60, every:12, delay:-6 },
      clouds:[ {layer:'back', src:'rysy-cloud.webp', x:30, y:9, w:46, dur:40, delay:-12, amp:3, lift:.6, op:.92, md:24, mdl:-6} ] },
    { id:'gran-paradiso', img:'granparadiso.webp', mask:'mask-granparadiso.png',
      plants:0, fall:0, wave:0, spark:.2, dur:8.6,
      lamps:[[711,464],[778,418],[826,388],[839,390],[420,429],[437,422],[270,406],[288,402],[365,360],[379,353],[521,202]],
      windows:[[212,466,10,15],[278,487,10,15],[230,513,9,16],[364,518,9,25]],
      wake:[ {x:243.5,y:476,w:8,h:13,t:34,d:-6}, {x:308,y:495,w:8,h:13,t:41,d:-27} ],
      dawn:{ x:515, y:132 },
      mist:[ { tile:'gp_mist.png', mask:'gp_mistmask.png', box:[380,60,740,250], op:.45 },
             { tile:'gp_mist.png', mask:'gp_mistmask2.png', box:[430,90,860,250], op:.3, back:true } ],
      beams:[ { x:710, y:463, a:-44, len:125, bt:5.4, bd:-1.2 }, { x:778, y:417, a:-10, len:125, bt:4.7, bd:-3.1 } ] },
    { id:'grossglockner', img:'grossglockner.webp', mask:'mask-grossglockner.png',
      plants:.0042, fall:0, wave:0, spark:0, drift:.875, driftSpeed:2.3, wisps:0, wispsDir:0, wind:true, windOp:.9, dur:9.6,
      gustLines:{ n:34, y:[150, 640], o:.9 },
      plumes:[ { src:'wind2.png', tip:[296,360], len:270, rot:2, ox:.018, oy:.68, ar:.543 },
               { src:'wind1b.png', tip:[432,512], len:280, rot:30, ox:.07, oy:.64, ar:.412, d:-1.4, o:.85, sy:.8 } ],
      windows:[[809,546,10,14],[861,548,6,12]] },
    { id:'skalka', img:'kladka.webp', mask:'mask-kladka.png',
      plants:.0036, fall:0, wave:0, spark:0, bridge:1, dur:9.2,
      shadows:[ { l:6, r:66, b:8.5, o:.95 }, { l:60, r:5, b:8.5, o:.45 } ] },
    { id:'mont-blanc', img:'montblanc.webp', mask:'mask-montblanc.png',
      plants:0, rope:.006, fall:0, wave:0, spark:0, glitter:1, dur:9.8,
      iceSheen:'mb_icemask.png',
      lamps:[[483,177],[608,249]], lampR:7, lampOp:.4,
      beams:[ { x:483, y:177, a:14, len:60, bt:5.6, bd:-1.6, o:.14 }, { x:608, y:249, a:12, len:60, bt:4.9, bd:-3.4, o:.14 } ],
      windows:[[863,529,11,11],[888,526,5,8],[864,509,9,7]] },
  ];

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => !reduce.matches && !root.classList.contains('effects-off');
  const pct = v => (v / 10) + '%';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sm = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  /* ---------- jedna wspólna pętla klatek ----------
     Każdy efekt rejestruje funkcję tick(now). Pętla działa tylko wtedy, gdy któraś góra
     jest na ekranie, efekty są włączone, a karta jest widoczna. */
  const ticks = [];
  let raf = 0;
  const anyVisible = () => MOUNTAINS.some(m => m.visible);
  const loop = now => {
    raf = 0;
    if (!enabled() || document.hidden || !anyVisible()) return;
    for (const f of ticks) f(now);
    raf = requestAnimationFrame(loop);
  };
  const wake = () => { if (!raf && enabled() && !document.hidden && anyVisible()) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', wake);

  /* ---------- wspólny poryw wiatru (zamieć, kosówki, Grossglockner) ---------- */
  let gT = 0, gLast = 0;
  const wind = { gust: 0, wind: 0 };
  ticks.push(now => {
    const dt = gLast ? Math.min(.05, (now - gLast) / 1000) : 0; gLast = now; gT += dt;
    const c = gT % 14;
    wind.gust = sm(0, 2.6, c) * (1 - sm(4, 7.5, c)) * (.85 + .15 * Math.sin(gT * 2.3));   // Babia: „porywy”
    const c2 = gT % 9.3, burst = sm(0, 1.4, c2) * (1 - sm(2.6, 6, c2));
    wind.wind = Math.min(1, .38 + .62 * burst * (.8 + .2 * Math.sin(gT * 3.1)) + .06 * Math.sin(gT * .7));
    MOUNTAINS.forEach(m => { if (m.wind && m.built && m.visible) m.stage.style.setProperty('--g', wind.wind.toFixed(3)); });
  });

  /* ---------- budowa sceny jednej góry ---------- */
  const clouds = (m, layer) => (m.clouds || []).filter(c => c.layer === layer).map(c =>
    `<div class="cl ${layer}" style="--cd:${c.dur}s;--cdl:${c.delay}s;--amp:${c.amp}%;--lift:${c.lift || 0}%;opacity:${c.op}"><img src="${P + c.src}" alt="" style="left:${c.x}%;top:${c.y}%;width:${c.w}%;--md:${c.md || 17}s;--mdl:${c.mdl || 0}s"></div>`).join('');

  function build(m, i) {
    const st = m.stage, still = st.querySelector('img.still'), druk = st.querySelector('img.druk');
    let pieces = '';
    (m.pieces || []).forEach(p => {
      const [x0, y0, x1, y1] = p.box;
      pieces += `<div class="piece ${p.cls}" style="left:${pct(x0)};top:${pct(y0)};width:${pct(x1 - x0)};height:${pct(y1 - y0)};${p.style || ''}"><img src="${P + p.src}" alt=""></div>`;
    });
    if (m.waterfall) { const w = m.waterfall, c = w.curtain, sp = w.splash;
      pieces += `<div class="wf" style="left:${pct(c[0])};top:${pct(c[1])};width:${pct(c[2] - c[0])};height:${pct(c[3] - c[1])}"><div class="wfc"><i style="background-image:url(${P + w.tile})"></i><i class="b" style="background-image:url(${P + w.tile})"></i></div></div>`
        + `<div class="wf" style="left:${pct(sp[0])};top:${pct(sp[1])};width:${pct(sp[2] - sp[0])};height:${pct(sp[3] - sp[1])}"><img class="wfs a" src="${P + w.splash_src}" alt="" style="width:100%;height:100%"><img class="wfs b" src="${P + w.splash_src}" alt="" style="width:100%;height:100%"></div>`; }
    if (m.fish) { const f = m.fish, [x0, y0, x1, y1] = f.box, W = x1 - x0, H = y1 - y0;
      const clip = f.clip.map(([x, y]) => `${((x - x0) / W * 100).toFixed(2)}% ${((y - y0) / H * 100).toFixed(2)}%`).join(',');
      pieces += `<div class="fishbox" style="left:${pct(x0)};top:${pct(y0)};width:${pct(W)};height:${pct(H)};clip-path:polygon(${clip})"><canvas></canvas></div>`; }
    if (m.flash) { const f = m.flash; pieces += `<div class="flash" style="left:${pct(f.x - f.r)};top:${pct(f.y - f.r)};width:${pct(2 * f.r)};height:${pct(2 * f.r)};--fc:${f.every}s;--fd:${f.delay}s"><img src="${P + f.src}" alt=""></div>`; }
    if (m.lamp) { const l = m.lamp; pieces += `<div class="lamp" style="left:${pct(l.x - l.r)};top:${pct(l.y - l.r)};width:${pct(2 * l.r)};height:${pct(2 * l.r)}"></div>`; }
    if (m.lamps) { const R = m.lampR || 13, ys = m.lamps.map(l => l[1]), yMax = Math.max(...ys), yMin = Math.min(...ys);
      m.lamps.forEach(([x, y], k) => { const hb = (1.35 + (k * .37) % .5).toFixed(2), hf = (1.9 + (k * .61) % 1.1).toFixed(2);
        const hwd = ((yMax - y) / (yMax - yMin) * 3.2).toFixed(2);   // fala: najpierw dolne, potem wyższe
        pieces += `<div class="hl" style="${m.lampOp ? `filter:opacity(${m.lampOp});` : ''}left:${pct(x - R)};top:${pct(y - R)};width:${pct(2 * R)};height:${pct(2 * R)};--hb:${hb}s;--hbd:${(-k * .53).toFixed(2)}s;--hf:${hf}s"><i style="--hwd:${hwd}s"></i></div>`; }); }
    if (m.windows) m.windows.forEach(([x, y, w, h], k) => { const W = w * 2.6, H = h * 2.1;
      pieces += `<div class="win" style="left:${pct(x - W / 2)};top:${pct(y - H / 2)};width:${pct(W)};height:${pct(H)};--wf:${(2.6 + k * .45).toFixed(2)}s;--wd:${(-k * .9).toFixed(2)}s"></div>`; });
    if (m.wake) m.wake.forEach(o => {
      pieces += `<div class="wake" style="left:${pct(o.x - o.w / 2)};top:${pct(o.y - o.h / 2)};width:${pct(o.w)};height:${pct(o.h)};--kt:${o.t}s;--kd:${o.d}s"><i></i></div>`; });
    if (m.beams) m.beams.forEach(b => { const h = b.len * .42;
      pieces += `<div class="beam" style="left:${pct(b.x)};top:${pct(b.y - h / 2)};width:${pct(b.len)};height:${pct(h)};--ba:${b.a}deg;--bt:${b.bt}s;--bd:${b.bd}s;--bo:${b.o || 1}"></div>`; });
    let behind = '';
    if (m.mist) m.mist.forEach(o => { const [x0, y0, x1, y1] = o.box;
      const h = `<div class="mist${o.back ? ' far' : ''}" style="left:${pct(x0)};top:${pct(y0)};width:${pct(x1 - x0)};height:${pct(y1 - y0)};opacity:${o.op};--mm:url(${P + o.mask});--mt:url(${P + o.tile})"><i></i><i></i></div>`;
      if (o.back) behind += h; else pieces += h; });
    if (m.plumes) m.plumes.forEach(p => { const w = p.len / .86, h = w * p.ar, x = p.tip[0] - p.ox * w, y = p.tip[1] - p.oy * h;
      pieces += `<div class="plume" style="left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};--ox:${p.ox * 100}%;--oy:${p.oy * 100}%;--r:${p.rot}deg;${m.windOp ? `--wo:${m.windOp};` : ''}${p.o ? `--po:${p.o};` : ''}${p.sy ? `--sy:${p.sy};` : ''}${p.d ? `--pd:${p.d}s;` : ''}"><img src="${P + p.src}" alt=""><img src="${P + p.src}" alt=""></div>`; });
    if (m.gustLines) pieces += `<canvas class="gustl" width="1000" height="1000" style="--gm:url(${P + m.img})" aria-hidden="true"></canvas>`;
    if (m.iceSheen) pieces += `<div class="icesheen" style="--im:url(${P + m.iceSheen})"><i></i></div>`;
    if (m.dawn) pieces += `<div class="dawn" style="--mi:url(${P + m.img});--dx:${m.dawn.x / 10}%;--dy:${m.dawn.y / 10}%"></div>`;

    st.style.setProperty('--dur', m.dur + 's');
    st.style.setProperty('--delay', (-i * 1.7) + 's');
    if (m.wind) st.dataset.wind = '';
    const shadows = m.shadows ? m.shadows.map(o => `<div class="shadow" style="left:${o.l}%;right:${o.r}%;${o.b != null ? `bottom:${o.b}%;` : ''}--so:${o.o}"></div>`).join('') : '<div class="shadow"></div>';
    const enter = document.createElement('div'); enter.className = 'enter';
    enter.innerHTML = `<div class="float">${behind}<canvas class="layer" width="1000" height="1000" aria-hidden="true"></canvas>${pieces}</div>`;
    const flt = enter.firstChild;
    flt.insertBefore(still, flt.querySelector('canvas.layer').nextSibling);     // obrazek zostaje tym samym elementem (alt, lazy)
    st.insertAdjacentHTML('afterbegin', shadows + clouds(m, 'back')
      + (m.blizzardBack ? `<div class="bliz back" aria-hidden="true" style="--bm:url(${P + m.blizzardBack})"><canvas></canvas></div>` : ''));
    st.insertBefore(enter, druk);
    st.insertAdjacentHTML('beforeend', clouds(m, 'front')
      + (m.blizzard ? `<div class="bliz front" aria-hidden="true" style="--bm:url(${P + m.blizzardMask})"><canvas></canvas></div>` : ''));
    m.built = true;

    if (m.id === 'marmolada') gondola(m);
    if (m.blizzard) blizzard(m);
    if (m.blizzardBack) blizzardBack(m);
    if (m.fish) fish(m);
    if (m.gustLines) gustLines(m);
    shader(m);
  }

  /* ---------- kolejka na Marmoladzie: jedzie po linie (krzywa dopasowana do liny) ---------- */
  function gondola(m) {
    const gond = m.stage.querySelector('.gondola');
    const cy = x => CABLE[0] * x * x + CABLE[1] * x + CABLE[2];
    const AX = 726.5, BOX = [700, 248, 750, 328], W = BOX[2] - BOX[0], H = BOX[3] - BOX[1];
    gond.style.transformOrigin = `${(AX - BOX[0]) / W * 100}% ${(cy(AX) - BOX[1]) / H * 100}%`;
    const TOPX = 692, BOTX = 812;            // na dole wagonik znika, zanim dotknie lodowca
    const MOVE = 18, WAIT_B = 4, WAIT_T = 4, CYCLE = 2 * MOVE + WAIT_B + WAIT_T;
    const ease = u => .5 - .5 * Math.cos(Math.PI * u);
    const posAt = t => { const c = ((t % CYCLE) + CYCLE) % CYCLE;
      if (c < MOVE) return TOPX + (BOTX - TOPX) * ease(c / MOVE);
      if (c < MOVE + WAIT_B) return BOTX;
      if (c < 2 * MOVE + WAIT_B) return BOTX - (BOTX - TOPX) * ease((c - MOVE - WAIT_B) / MOVE);
      return TOPX; };
    let gt = WAIT_T * .6, glast = 0, ang = 0, vel = 0, prevV = 0;
    ticks.push(now => {
      const dt = glast ? Math.min(.05, (now - glast) / 1000) : 0; glast = now;
      if (!m.visible) return;
      gt += dt;
      // wahadło: przyspieszanie i hamowanie wagonika rozkołysuje go lekko
      const x = posAt(gt), v = (posAt(gt + .02) - posAt(gt - .02)) / .04, acc = (v - prevV) / Math.max(dt, 1e-3); prevV = v;
      vel += (-9 * ang - 1.1 * vel - acc * 1.2) * dt; ang += vel * dt;
      ang = Math.max(-2, Math.min(2, ang));
      gond.style.transform = `translate(${(x - AX) / W * 100}%, ${(cy(x) - cy(AX)) / H * 100}%) rotate(${ang}deg)`;
    });
    m.reset = () => { gond.style.transform = ''; };
  }

  /* ---------- zamieć: dwie warstwy kafla na płótnie wielkości obszaru śniegu ---------- */
  function blizzard(m) {
    const cv = m.stage.querySelector('.bliz.front canvas'), ctx = cv.getContext('2d');
    const img = new Image(); img.src = P + m.blizzard;
    const LAYERS = [ { k: 2.0, period: 12, alpha: .38 }, { k: 1.17, period: 7.5, alpha: .55 } ];
    let W = 0, H = 0, pats = [], last = 0;
    const fit = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      W = Math.round(r.width * dpr); H = Math.round(r.height * dpr); if (!W) { pats = []; return; }
      cv.width = W; cv.height = H;
      pats = LAYERS.map(L => { const tw = Math.max(40, Math.round(W / L.k)), th = Math.round(tw * 380 / 620);
        const c = document.createElement('canvas'); c.width = tw; c.height = th; c.getContext('2d').drawImage(img, 0, 0, tw, th);
        return { p: ctx.createPattern(c, 'repeat'), tw, th, ph: Math.random(), ...L }; }); };
    img.onload = fit; addEventListener('resize', () => img.complete && fit());
    ticks.push(now => {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      if (!m.visible || !img.complete) return;
      if (!pats.length) fit(); if (!pats.length) return;
      const e = wind.gust;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const L of pats) {
        L.ph += dt * (1 + 1.25 * e) / L.period;                     // w porywie śnieg przyspiesza
        const u = L.ph % 1, ox = -(u * 2 * L.tw) % L.tw, oy = (u * L.th) % L.th;
        ctx.globalAlpha = Math.min(1, L.alpha * (1 + .55 * e)); ctx.fillStyle = L.p;
        ctx.setTransform(1, 0, 0, 1, Math.round(ox), Math.round(oy));
        ctx.fillRect(-L.tw, -L.th, W + 2 * L.tw, H + 2 * L.th);
      }
    });
  }

  /* ---------- śnieg za bryłą: drobny, wolniejszy, rzadszy ---------- */
  function blizzardBack(m) {
    const cv = m.stage.querySelector('.bliz.back canvas'), ctx = cv.getContext('2d');
    const img = new Image(); img.src = P + m.blizzard;
    let W = 0, H = 0, pat = null, tw = 0, th = 0, ph = Math.random(), last = 0;
    const fit = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      W = Math.round(r.width * dpr); H = Math.round(r.height * dpr); if (!W) { pat = null; return; }
      cv.width = W; cv.height = H; tw = Math.max(40, Math.round(W / 3.2)); th = Math.round(tw * 380 / 620);
      const c = document.createElement('canvas'); c.width = tw; c.height = th; c.getContext('2d').drawImage(img, 0, 0, tw, th);
      pat = ctx.createPattern(c, 'repeat'); };
    img.onload = fit; addEventListener('resize', () => img.complete && fit());
    ticks.push(now => {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      if (!m.visible || !img.complete) return;
      if (!pat) fit(); if (!pat) return;
      const e = wind.gust;
      ph += dt * (1 + .6 * e) / 18;                                   // wolniej niż z przodu: daleko
      const u = ph % 1, ox = -(u * 2 * tw) % tw, oy = (u * 1.25 * th) % th;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = .28 * (1 + .25 * e); ctx.fillStyle = pat;
      ctx.setTransform(1, 0, 0, 1, Math.round(ox), Math.round(oy));
      ctx.fillRect(-tw, -th, W + 2 * tw, H + 2 * th);
    });
  }

  /* ---------- ryby: przepływają przez przekrój stawu, zawracają, chowają się w głąb ---------- */
  function fish(m) {
    const F = m.fish, [bx0, by0, bx1, by1] = F.box, BW = bx1 - bx0;
    const cv = m.stage.querySelector('.fishbox canvas'), ctx = cv.getContext('2d');
    const imgs = { L: new Image(), R: new Image() }; imgs.L.src = P + F.left; imgs.R.src = P + F.right;
    const topAt = x => F.top[0][1] + (x - F.top[0][0]) * (F.top[1][1] - F.top[0][1]) / (F.top[1][0] - F.top[0][0]);
    const school = F.paths.map(p => { const d = Math.random() < .5 ? -1 : 1, sp = rnd(6, 11);
      return { x: rnd(p.x[0] + 15, p.x[1] - 15), y0: p.y, dir: d, face: d, v: d * sp, sp, ph: rnd(0, 6.3), xr: p.x, len: p.len, pause: 0, wig: rnd(2.2, 3.2),
               z: 0, zt: 0, hide: 0 }; });
    let W = 0, H = 0, last = 0, t = 0;
    const fit = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      W = Math.round(r.width * dpr); H = Math.round(r.height * dpr); cv.width = W; cv.height = H; };
    addEventListener('resize', fit);
    ticks.push(now => {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      if (!m.visible || !imgs.L.complete || !imgs.R.complete) return;
      if (!W || !cv.width) fit(); if (!W) return;
      t += dt; const s = W / BW;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const f of school) {
        const margin = 18;
        const atEdge = (f.dir > 0 && f.x > f.xr[1] - margin) || (f.dir < 0 && f.x < f.xr[0] + margin);
        if (atEdge && f.zt === 0 && !f.decided) {                 // przy krawędzi: zawraca albo odpływa w głąb
          f.decided = true;
          const forward = Math.abs(f.face - f.dir) < .05 && f.v * f.dir > f.sp * .5;
          if (Math.random() < .5 || !forward) { f.dir *= -1; f.pause = rnd(.4, 1.4); }
          else { f.zt = 1; f.pause = 0; }
        }
        if (!atEdge) f.decided = false;
        if (f.pause > 0) f.pause -= dt; else if (f.zt === 0 && f.z < .02 && Math.random() < dt * .04) { f.pause = rnd(.8, 2.2); f.sp = rnd(6, 11); }
        const target = f.pause > 0 ? 0 : f.dir * f.sp * (f.zt || f.z > .02 ? .45 : 1);
        f.v += (target - f.v) * Math.min(1, dt * 1.6); f.x += f.v * dt;
        const faceTarget = Math.abs(f.v) < f.sp * .45 ? f.dir : Math.sign(f.v) || f.dir;
        f.face += Math.max(-dt * 2.5, Math.min(dt * 2.5, (f.zt || f.z > .02 ? f.dir : faceTarget) - f.face));
        if (f.zt === 1 && f.z > .97) {
          f.hide = f.hide || rnd(2.5, 6);
          f.hide -= dt;
          if (f.hide <= 0) {
            f.dir = f.face = Math.random() < .5 ? -1 : 1; f.x = f.dir > 0 ? rnd(f.xr[0] + 20, (f.xr[0] + f.xr[1]) / 2) : rnd((f.xr[0] + f.xr[1]) / 2, f.xr[1] - 20); f.v = f.dir * f.sp * .45; f.pause = 0;
            f.zt = 0; f.hide = 0; f.decided = false;
          }
        }
        f.z += Math.max(-dt / 3.6, Math.min(dt / 4.8, f.zt - f.z));
        if (f.z > .99 && f.zt === 1) continue;
        const zs = f.z * f.z * (3 - 2 * f.z);
        const y = Math.max(topAt(f.x) + 12, f.y0 + Math.sin(t * .5 + f.ph) * 6) + zs * 8;
        const img = imgs.R, w = f.len, h = w * img.height / img.width;
        const swim = Math.min(1, Math.abs(f.v) / 8);
        const wig = .015 + .04 * swim;
        const fc = Math.sign(f.face) * Math.max(.12, Math.abs(f.face));
        const k = 1 - .55 * zs;
        const sx = fc * k * (1 - wig * (.5 + .5 * Math.sin(t * f.wig * 3 + f.ph)));
        ctx.setTransform(s * sx, 0, 0, s * k, (f.x - bx0) * s, (y - by0) * s);
        ctx.globalAlpha = .9 * Math.pow(1 - zs, 1.3); ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    });
  }

  /* ---------- kreski wiatru (Grossglockner): tylko w mocniejszej części porywu ---------- */
  function gustLines(M) {
    const cv = M.stage.querySelector('canvas.gustl'), ctx = cv.getContext('2d'), G = M.gustLines;
    const spawn = (l, init) => { l.x = init ? rnd(-100, 1000) : rnd(-260, -40); l.y = rnd(G.y[0], G.y[1]);
      l.len = rnd(32, 95); l.v = rnd(420, 700); l.a = rnd(.4, 1); l.w = rnd(2.4, 4.2); l.sl = rnd(.05, .14); return l; };
    const L = Array.from({ length: G.n }, () => spawn({}, true));
    let last = 0, shown = 0;
    ticks.push(now => {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      const on = M.visible;
      const g = wind.wind, e = Math.pow(Math.max(0, (g - .45) / .55), 1.6);
      shown += ((on ? e : 0) - shown) * Math.min(1, dt * 3);
      if (!on && shown <= .002) return;
      ctx.clearRect(0, 0, 1000, 1000);
      const sp = .55 + .45 * g;
      for (const l of L) {
        l.x += l.v * sp * dt; l.y += l.v * sp * dt * l.sl;
        if (l.x - l.len > 1000) spawn(l, false);
        const x0 = l.x - l.len, y0 = l.y - l.len * l.sl, gr = ctx.createLinearGradient(x0, y0, l.x, l.y);
        gr.addColorStop(0, 'rgba(240,244,250,0)'); gr.addColorStop(.75, `rgba(242,246,252,${(.7 * (G.o || 1) * l.a * shown).toFixed(3)})`); gr.addColorStop(1, 'rgba(240,244,250,0)');
        ctx.strokeStyle = gr; ctx.lineWidth = l.w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(l.x, l.y); ctx.stroke();
      }
    });
  }

  /* ---------- shader: rośliny, woda, lód, kładka, śnieg — na oryginalnym obrazie ---------- */
  const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p*.5+.5; uv.y = 1.-uv.y; gl_Position = vec4(p,0.,1.); }`;
  const FS = `precision mediump float;
  varying vec2 uv; uniform sampler2D img, msk; uniform float t, kP, kF, kW, kS, kD, ds, kQ, wd, kR, kI, kB, kG; uniform vec2 pc;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  void main(){
    vec3 m = texture2D(msk, uv).rgb;
    vec2 q = uv;
    float sway = sin(t*1.1 + uv.x*11.) * .55 + sin(t*1.9 + uv.x*23. + uv.y*6.) * .3 + (n(uv*45. + t*.7) - .5) * .5;
    q.x += kP * m.r * sway;
    q.x += kR * m.r * (sin(t*.6325)*.85 + sin(t*1.4605 + 1.)*.15);
    float sp = m.b;
    float vb = sin(t*.92)*.7 + sin(t*1.71 + 1.)*.3;
    float lt = sin(t*.57 + .5)*.8 + sin(t*1.23)*.2;
    float m2 = sin(t*1.37 + 2.) * 2. * cos(3.14159*sp);
    q -= kB * m.g * (vec2(0., 1.)*(vb*.0024 + m2*.0007) + vec2(.6, .8)*lt*.0015);
    float f = n(vec2(uv.x*70., uv.y*22. - t*2.6)) - .5;
    q += kF * m.g * vec2(f*.0009, f*.0030);
    float wx = sin(uv.x*60. + uv.y*140. - t*1.2) * .6 + sin(uv.x*130. - uv.y*60. + t*.9) * .4;
    float wy = sin(uv.x*90. + uv.y*30. - t*1.0) * .6 + sin(uv.x*40. - uv.y*170. - t*1.4) * .4;
    vec2 dI = (uv - pc) * vec2(1., 2.4); float rI = length(dI);
    float edgeB = 1. + kI * 1.3 * smoothstep(.05, .16, rI);
    q += kW * m.b * vec2(wx * .0018, wy * .0024) * edgeB;
    float ring = sin(rI * 260. - t * 5.2) * .65 + sin(rI * 150. - t * 3.4 + 1.3) * .35;
    float near = exp(-rI / .045);
    q += kI * kW * m.b * normalize(dI + 1e-5) * ring * near * .0042;
    float wv = sin(uv.x*42. + t*2.1)*.6 + sin(uv.x*90. - uv.y*34. + t*3.6)*.4;
    float fl = n(vec2(uv.x*22. + t*1.6, uv.y*70. + t*.4)) - .5;
    float fv = n(vec2(uv.x*60. + t*.3, uv.y*20. - t*1.4)) - .5;
    float sv = sin(uv.y*38. - t*1.6)*.6 + sin(uv.y*80. + uv.x*20. - t*2.7)*.4;
    vec2 offH = vec2(fl*.0065 + .0018*sin(t*1.2), wv*.003);
    vec2 offV = vec2(sv*.0035 + .0015*sin(t*1.1), fv*.0075);
    q += kQ * m.g * mix(offH, offV, wd);
    q.x -= (1. - wd) * kQ * m.g * .0032;
    vec4 c = texture2D(img, q);
    float s = smoothstep(.68, .95, n(vec2(uv.x*55., uv.y*9. - t*3.2)));
    c.rgb += kF * m.g * s * .16 * c.a;
    float g = smoothstep(.62, .9, n(vec2(uv.x*38. + t*.22, uv.y*85. - t*.15)) * .6 + n(vec2(uv.x*90. - t*.3, uv.y*140.)) * .4);
    vec3 tint = clamp(c.rgb * 1.55 + vec3(.04, .10, .13), 0., 1.);
    c.rgb += kW * m.b * g * .14 * c.a * mix(vec3(1.), tint, .78);
    vec2 cell = floor(uv * 330.);
    float r = h(cell), ph = fract(t * .3 + r * 7.);
    float tw = step(.965, r) * smoothstep(0., .12, ph) * smoothstep(.32, .12, ph);
    float band = exp(-pow((uv.x*.8 + uv.y*.5 - fract(t*.06)*2.2 + .4) * 10., 2.));
    c.rgb += kS * m.b * (tw * .55 + band * .07) * c.a;
    vec2 sc = floor(uv * 520.);
    float sr = h(sc), sp2 = fract(t * .22 + sr * 11.);
    float sg = step(.988, sr) * smoothstep(0., .05, sp2) * smoothstep(.16, .05, sp2);
    c.rgb += kG * m.g * sg * .9 * c.a * vec3(1., .97, .9);
    vec2 w = vec2(uv.x*7. - t*.55*ds, uv.y*34. + uv.x*9.);
    float streak = smoothstep(.6, .92, n(w)) * smoothstep(.35, .8, n(vec2(uv.x*2.5 - t*.2*ds, uv.y*5.)));
    c.rgb += kD * m.b * streak * .14 * c.a;
    float lum = dot(c.rgb, vec3(.333));
    float glr = exp(-pow((sp - fract(t*.05)*1.6 + .3) * 7., 2.)) * (.65 + .35*lt);
    c.rgb += kB * step(.004, m.g) * smoothstep(.42, .78, lum) * glr * .2 * c.a * vec3(1., .97, .9);
    gl_FragColor = c;
  }`;
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

  function shader(M) {
    const cv = M.stage.querySelector('canvas.layer');
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return;                                       // bez WebGL: sam obrazek z unoszeniem
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit, image) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); };
    Promise.all([load(P + M.img), load(P + M.mask)]).then(([a, b]) => {
      tex(0, a); tex(1, b);
      gl.uniform1i(gl.getUniformLocation(pr, 'img'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'msk'), 1);
      const U = n => gl.getUniformLocation(pr, n);
      const u = { t: U('t'), P: U('kP'), F: U('kF'), W: U('kW'), S: U('kS'), D: U('kD'), DS: U('ds'), Q: U('kQ'), WD: U('wd'), R: U('kR'), I: U('kI'), B: U('kB'), G: U('kG'), PC: U('pc') };
      gl.clearColor(0, 0, 0, 0); gl.viewport(0, 0, 1000, 1000);
      let t = 0, last = 0, kP = 0, kF = 0, kW = 0, kS = 0, kD = 0, kQ = 0, kR = 0, kB = 0, kG = 0;
      const ease = (k, target, dt) => k + (target - k) * Math.min(1, dt * 4);
      const draw = dt => {
        const gw = M.wind ? wind.wind : M.gusty ? wind.gust : 0;
        kP = ease(kP, M.plants * (1 + 1.1 * gw), dt); kF = ease(kF, M.fall, dt);
        kW = ease(kW, M.wave, dt); kS = ease(kS, M.spark, dt);
        kR = ease(kR, M.rope || 0, dt); kB = ease(kB, M.bridge || 0, dt); kG = ease(kG, M.glitter || 0, dt);
        kD = ease(kD, (M.drift || 0) * (1 + .9 * gw), dt); kQ = ease(kQ, (M.wisps || 0) * (1 + 1.3 * gw), dt);
        t += dt; gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(u.t, t); gl.uniform1f(u.P, kP); gl.uniform1f(u.F, kF); gl.uniform1f(u.W, kW); gl.uniform1f(u.S, kS); gl.uniform1f(u.D, kD);
        gl.uniform1f(u.DS, M.driftSpeed || 1); gl.uniform1f(u.Q, kQ); gl.uniform1f(u.WD, M.wispsDir || 0); gl.uniform1f(u.R, kR); gl.uniform1f(u.B, kB); gl.uniform1f(u.G, kG);
        gl.uniform1f(u.I, M.impact ? 1 : 0); gl.uniform2f(u.PC, M.impact ? M.impact[0] / 1000 : .5, M.impact ? M.impact[1] / 1000 : .5);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      draw(0);
      ticks.push(now => { const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; if (M.visible) draw(dt); });
      M.stage.classList.add('gl-on');
      wake();
    }).catch(() => {});
  }

  /* ---------- wejście, widoczność, przełącznik efektów ---------- */
  const ANIM = '.float,.shadow,.peb,.cl,.cl img,.lamp,.wfc i,.wfs,.flash,.hl,.hl i,.win,.wake,.icesheen i,.plume img,.mist i,.dawn,.beam';
  const pause = m => { if (!m.built) return;
    m.stage.querySelectorAll(ANIM).forEach(el => el.style.animationPlayState = m.visible ? '' : 'paused'); };
  const applyState = () => {
    const on = enabled();
    MOUNTAINS.forEach(m => { if (m.stage) m.stage.classList.toggle('gfx-off', !on); if (!on && m.reset) m.reset(); });
    if (on) wake();
  };

  MOUNTAINS.forEach((m, i) => {
    m.stage = document.querySelector(`.gora[data-gora="${m.id}"]`);
    if (!m.stage) return;
    // scena powstaje z wyprzedzeniem ekranu, żeby wejście nie startowało od pustego miejsca
    new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); build(m, i); applyState(); pause(m); } },
      { rootMargin: '600px 0px' }).observe(m.stage);
    new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { m.stage.classList.add('visible'); o.disconnect(); } },
      { threshold: .3 }).observe(m.stage);
    new IntersectionObserver(e => { m.visible = e[0].isIntersecting; pause(m); wake(); }).observe(m.stage);
  });
  new MutationObserver(applyState).observe(root, { attributes: true, attributeFilter: ['class'] });
  reduce.addEventListener?.('change', applyState);
  applyState();
})();
