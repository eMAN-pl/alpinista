(() => {
  const root = document.documentElement, main = document.querySelector('article');

  // Warstwy efektów powstają dopiero tutaj — strona bez kliknięcia nie ma ich w ogóle.
  const warstwa = (tag, id, klasa) => {
    const el = document.createElement(tag);
    el.id = id;
    if (klasa) el.className = klasa;
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    return el;
  };
  warstwa('canvas', 'back');
  warstwa('div', 'tunnel', 'veil');
  warstwa('div', 'frost', 'veil');
  warstwa('canvas', 'front');
  const filmEl = warstwa('div', 'film', 'film');
  filmEl.setAttribute('aria-live', 'polite');
  filmEl.removeAttribute('aria-hidden');
  const back = document.getElementById('back'), front = document.getElementById('front');
  const tunnel = document.getElementById('tunnel'), frostV = document.getElementById('frost');
  const bctx = back.getContext('2d'), fctx = front.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    for (const c of [back, front]) { c.width = Math.round(W*dpr); c.height = Math.round(H*dpr); }
    bctx.setTransform(dpr,0,0,dpr,0,0); fctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize); resize();

  const v = n => getComputedStyle(root).getPropertyValue(n).trim();
  const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
  const rgba = (n, a) => `rgba(${v(n)},${clamp(a,0,1).toFixed(3)})`;
  const smooth = t => { t = clamp(t,0,1); return t*t*(3-2*t); };
  const env = (p, a=.15, b=.25) => p < a ? smooth(p/a) : (p > 1-b ? smooth((1-p)/b) : 1);
  const R = Math.random, TAU = Math.PI*2;
  const colRect = () => main.getBoundingClientRect();
  const rama = main.parentElement && main.parentElement !== document.body ? main.parentElement : null;

  // katalog strony liczony od adresu tego skryptu: avatar ma działać także ze strony testowej w robocze/
  const BAZA = document.currentScript && document.currentScript.src ? new URL('.', document.currentScript.src).href : '';

  /* ================= efekty ================= */
  const FX = {

    tlen: { dur: 5200,
      draw(c, s, p, t, dt, M){
        const e = env(p,.38,.3);
        const hb = Math.pow(Math.max(0, Math.sin(t/820*TAU)), 10);
        const r1 = 58 - 46*e;
        M.tunnel = {r1, r2: r1 + 40 - 12*e, b: 10*e, a: .9*e};
        M.blur += e*(1.6 + 1.1*Math.sin(t/430)) + 1.4*hb*e;
        const g = 4*e*(1 + .6*Math.sin(t/300));
        M.shadow.push(`${g.toFixed(1)}px ${(g*.35).toFixed(1)}px 0 rgba(${v('--fg-rgb')},${(.32*e).toFixed(3)})`);
        M.sat *= 1 - .55*e; M.bright *= 1 - .18*e*hb;
      }},

    zamiec: { dur: 6000,
      init(s){
        s.f = []; s.g = 1;
        s.blobs = Array.from({length:10}, () => ({x:R()*W*1.4 - W*.2, y:R()*H, r:(.28+R()*.4)*Math.max(W,H), sp:.5+R()*.9}));
      },
      draw(c, s, p, t, dt, M){
        const e = env(p,.28,.3), k = dt/16;
        s.g += ((1 + .8*Math.sin(t/640) + .35*Math.sin(t/210)) - s.g)*.06*k;
        c.fillStyle = rgba('--fog-rgb', .5*e); c.fillRect(0,0,W,H);
        for (const b of s.blobs) {
          b.x += 7*s.g*b.sp*k; if (b.x - b.r > W) { b.x = -b.r; b.y = R()*H; }
          const gr = c.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
          gr.addColorStop(0, rgba('--fog-rgb', .5*e)); gr.addColorStop(1, rgba('--fog-rgb', 0));
          c.fillStyle = gr; c.fillRect(b.x-b.r,b.y-b.r,b.r*2,b.r*2);
        }
        let n = e*26*k;
        while (n > 0) { if (n >= 1 || R() < n) { const d = R(), side = R() < .45;
          s.f.push({x: side ? -10 : R()*W*1.3 - W*.3, y: side ? R()*H : -10, d, vy: .8+R()*1.6}); } n--; }
        s.f = s.f.filter(f => {
          const sp = .5 + f.d*1.7;
          f.x += (2.5 + 6*s.g)*sp*k; f.y += f.vy*sp*k + Math.sin((f.x+t*.2)/40)*.4;
          const r = .6 + f.d*3.6, a = (.35 + .55*f.d)*Math.min(1, e*1.5);
          if (f.d > .78) { const gr = c.createRadialGradient(f.x,f.y,0,f.x,f.y,r*2.2);
            gr.addColorStop(0, rgba('--snow-rgb', a)); gr.addColorStop(1, rgba('--snow-rgb', 0));
            c.fillStyle = gr; c.fillRect(f.x-r*2.2,f.y-r*2.2,r*4.4,r*4.4); }
          else { c.fillStyle = rgba('--snow-rgb', a); c.beginPath(); c.arc(f.x,f.y,r,0,TAU); c.fill(); }
          return f.y < H+20 && f.x < W+20;
        });
        M.blur += 3.4*e; M.op *= 1 - .7*e;
      }},

    szron: { dur: 6000,
      init(s){
        const g = 4, gw = Math.ceil(W/g), gh = Math.ceil(H/g), n = valueNoise(), m = Math.min(W,H);
        const fbm = (x,y) => (n(x,y) + .5*n(x*2.1,y*2.1) + .25*n(x*4.3,y*4.3))/1.75;
        s.g = g; s.gw = gw; s.gh = gh; s.tm = new Float32Array(gw*gh);
        for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) {
          const px = x*g, py = y*g, de = Math.min(px, W-px, py, H-py)/(m*.5);
          const dc = Math.min(Math.hypot(px,py), Math.hypot(W-px,py), Math.hypot(px,H-py), Math.hypot(W-px,H-py))/m;
          s.tm[y*gw+x] = Math.min(de*1.05, dc*.95) + (fbm(px/110, py/110) - .5)*.42;
        }
        const tmAt = (x,y) => s.tm[clamp(Math.floor(y/g),0,gh-1)*gw + clamp(Math.floor(x/g),0,gw-1)];
        s.mask = document.createElement('canvas'); s.mask.width = gw; s.mask.height = gh;
        s.mctx = s.mask.getContext('2d'); s.img = s.mctx.createImageData(gw, gh);
        for (let i=0;i<gw*gh;i++) { s.img.data[i*4] = s.img.data[i*4+1] = s.img.data[i*4+2] = 255; }
        const sf = Math.min(dpr, 1.5), fr = v('--frost-rgb');
        const fi = document.createElement('canvas'); fi.width = Math.round(W*sf); fi.height = Math.round(H*sf);
        const f = fi.getContext('2d'); f.setTransform(sf,0,0,sf,0,0);
        const cw = Math.ceil(W/3), ch = Math.ceil(H/3), cc = document.createElement('canvas'); cc.width = cw; cc.height = ch;
        const cx = cc.getContext('2d'), cd = cx.createImageData(cw, ch), [r0,g0,b0] = fr.split(',').map(Number);
        for (let y=0;y<ch;y++) for (let x=0;x<cw;x++) {
          const X = x*3, Y = y*3, t = tmAt(X,Y), a = clamp(.08 + .3*fbm(X/80, Y/80) + .14*fbm(X/22, Y/22) + (.3 - t)*.55, 0, .62), i = (y*cw+x)*4;
          cd.data[i] = Math.max(0, r0-12); cd.data[i+1] = Math.min(255, g0+4); cd.data[i+2] = Math.min(255, b0+7); cd.data[i+3] = a*255;
        }
        cx.putImageData(cd, 0, 0); f.imageSmoothingEnabled = true; f.imageSmoothingQuality = 'high'; f.drawImage(cc, 0, 0, W, H);
        const near = lim => { for (let k=0;k<40;k++) { const x = R()*W, y = R()*H; if (tmAt(x,y) < lim*Math.sqrt(R())) return [x,y]; } return null; };
        f.fillStyle = 'rgba(255,255,255,.45)';
        for (let i=0;i<2600;i++) { const q = near(.5); if (q) f.fillRect(q[0], q[1], .5 + R()*.9, .5 + R()*.9); }
        const branch = (x, y, a, len, depth) => {
          f.moveTo(x,y); let px = x, py = y;
          for (let d=0; d<len; d+=2) {
            a += (R()-.5)*.13; const nx = px + Math.cos(a)*2, ny = py + Math.sin(a)*2; f.lineTo(nx,ny);
            if (depth > 0 && R() < .5) { const sgn = R() < .5 ? 1 : -1, bl = (len-d)*(.2 + R()*.4);
              if (bl > 2) { branch(nx, ny, a + sgn*(Math.PI/3 + (R()-.5)*.3), bl, depth-1); f.moveTo(nx,ny); } }
            px = nx; py = ny;
          }
        };
        const inward = (x,y) => Math.atan2(H/2 - y, W/2 - x);
        f.lineCap = 'round';
        f.beginPath();
        for (let i=0;i<950;i++) { const q = near(.46); if (!q) continue; const [x,y] = q, t = tmAt(x,y);
          branch(x, y, inward(x,y) + (R()-.5)*2.6, (8 + R()*26)*(1.25 - t), 2); }
        f.strokeStyle = `rgba(${fr},.42)`; f.lineWidth = .5; f.stroke();
        f.beginPath();
        for (let i=0;i<42;i++) { const q = near(.18); if (!q) continue; const [x,y] = q;
          branch(x, y, inward(x,y) + (R()-.5)*1.3, 60 + R()*80, 3); }
        f.strokeStyle = `rgba(${fr},.62)`; f.lineWidth = .6; f.stroke();
        f.strokeStyle = 'rgba(255,255,255,.28)'; f.lineWidth = .3; f.stroke();
        s.fi = fi;
        s.comp = document.createElement('canvas'); s.comp.width = fi.width; s.comp.height = fi.height;
        s.cc = s.comp.getContext('2d');
        const tg = s.target; tg.style.transition = 'color 1.4s, text-shadow 1.4s';
        tg.style.color = `rgb(${v('--frosttext-rgb')})`; tg.style.textShadow = `0 0 4px rgba(${fr},.6)`;
      },
      stop(s){ const tg = s.target; tg.style.color = ''; tg.style.textShadow = ''; setTimeout(() => tg.style.transition = '', 1500); },
      draw(c, s, p, t, dt, M, cb){
        const grow = 1 - Math.pow(1 - clamp(p/.55,0,1), 2.4), melt = 1 - smooth((p-.74)/.26);
        const th = .5*grow*melt - .02, d = s.img.data, tm = s.tm;
        for (let i=0;i<tm.length;i++) d[i*4+3] = clamp((th - tm[i])/.045, 0, 1)*255;
        s.mctx.putImageData(s.img, 0, 0);
        if (p > .74 && !s.thaw) { s.thaw = true; s.target.style.color = ''; s.target.style.textShadow = ''; }
        const cc = s.cc, w = s.comp.width, h = s.comp.height;
        cc.globalCompositeOperation = 'source-over'; cc.clearRect(0,0,w,h); cc.drawImage(s.fi, 0, 0);
        cc.globalCompositeOperation = 'destination-in'; cc.imageSmoothingEnabled = true; cc.drawImage(s.mask, 0, 0, w, h);
        c.drawImage(s.comp, 0, 0, W, H);
        const fe = Math.max(0, th)*Math.min(W,H)*.62;
        const ziab = Math.min(1, Math.max(0, th)*3.5)*Math.min(1, p/.12);
        M.cold = Math.max(M.cold, ziab); M.coldVar = '--frostbg';
        M.noc = Math.max(M.noc, Math.min(1, Math.max(0, th)*4)*Math.min(1, p/.12));
        // Poświata za tekstem: zimne światło wchodzi od krawędzi razem ze szronem, środek
        // zostaje ciemny — tło zamarza, a nie tylko zmienia odcień (autor, 2026-11-15).
        const R1 = Math.hypot(W, H)*.62, po = cb.createRadialGradient(W/2, H/2, R1*.18, W/2, H/2, R1);
        po.addColorStop(0, rgba('--frost-rgb', 0)); po.addColorStop(.6, rgba('--frost-rgb', .1*ziab));
        po.addColorStop(1, rgba('--frost-rgb', .34*ziab));
        cb.fillStyle = po; cb.fillRect(0, 0, W, H);
        M.frost = {fe, fr: fe*1.7, fb: 9*Math.min(1, th*4), fa: .16*Math.min(1, th*4)};
      }},

    swietliki: { dur: 6500,
      init(s){
        const ways = [-1, 0, .55];
        s.l = Array.from({length:17}, (_,i) => ({b:ways[i%3], j:(R()-.5)*40, d:R()*.28, sp:.85+R()*.35, ph:R()*6, tr:[], px:null, py:null}));
      },
      draw(c, s, p, t, dt, M){
        const e = env(p,.12,.2), cx = W/2;
        c.fillStyle = `rgba(3,4,9,${(.74*e).toFixed(3)})`; c.fillRect(0,0,W,H);
        M.sat *= 1 - .7*e; M.noc = Math.max(M.noc, e);
        c.globalCompositeOperation = 'lighter';
        for (const l of s.l) {
          const q = clamp((p-l.d)/.6*l.sp,0,1); if (q <= 0) continue;
          const y = H+30 - q*H*1.05, sp = q > .4 ? (q-.4)/.6 : 0;
          const x = cx + l.j + l.b*Math.pow(sp,1.5)*W*.36 + Math.sin(q*7+l.ph)*4;
          let a = e*(.75 + .25*Math.sin(t/90+l.ph)); if (q < .05) a *= q/.05; if (q > .92) a *= (1-q)/.08;
          const ang = l.px === null ? -Math.PI/2 : Math.atan2(y-l.py, x-l.px);
          l.px = x; l.py = y; l.tr.push([x,y]); if (l.tr.length > 16) l.tr.shift();
          c.save(); c.translate(x,y); c.rotate(ang);
          const bg = c.createLinearGradient(0,0,110,0);
          bg.addColorStop(0, rgba('--glow-rgb', .22*a)); bg.addColorStop(1, rgba('--glow-rgb', 0));
          c.fillStyle = bg; c.beginPath(); c.moveTo(0,0); c.lineTo(110,-30); c.lineTo(110,30); c.closePath(); c.fill();
          c.restore();
          l.tr.forEach(([tx,ty],i) => { c.fillStyle = rgba('--glow-rgb', .25*a*i/l.tr.length); c.beginPath(); c.arc(tx,ty,1.1,0,TAU); c.fill(); });
          const g = c.createRadialGradient(x,y,0,x,y,26);
          g.addColorStop(0, rgba('--glow-rgb', .5*a)); g.addColorStop(1, rgba('--glow-rgb', 0));
          c.fillStyle = g; c.fillRect(x-26,y-26,52,52);
          c.fillStyle = `rgba(255,250,236,${a.toFixed(3)})`; c.beginPath(); c.arc(x,y,2.2,0,TAU); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }},

    /* Szczelina — wersja pierwotna, przywrócona na życzenie autora (2026-11-15). Próby
       „poprawy” (szersza z lodem, ściany z brył, samo rozsunięcie) autor odrzucił:
       ta była najciekawsza. Nie przerabiać bez jego prośby. */
    szczelina: { dur: 4200,
      init(s){
        const tg = s.target, r = tg.getBoundingClientRect(), mr = main.getBoundingClientRect();
        const w = r.width, h = r.height;
        const wrap = document.createElement('div'); wrap.className = 'crackwrap';
        Object.assign(wrap.style, {left:(r.left-mr.left)+'px', top:(r.top-mr.top)+'px', width:w+'px', height:h+'px'});
        s.pts = []; let yy = 0;
        for (let x = 0; x <= w; x += 8) { yy = clamp(yy + (R()-.5)*10, -12, 12); s.pts.push([x, h*.55 + yy]); }
        s.pts.push([w, s.pts[s.pts.length-1][1]]);
        const P = a => a.map(([x,y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',');
        const top = tg.cloneNode(true), bot = tg.cloneNode(true);
        [top, bot].forEach(n => { n.removeAttribute('id'); n.querySelectorAll('[data-fx]').forEach(b => b.setAttribute('tabindex','-1')); });
        top.style.clipPath = `polygon(0px -60px, ${w}px -60px, ${P(s.pts.slice().reverse())})`;
        bot.style.clipPath = `polygon(${P(s.pts)}, ${w}px ${h+60}px, 0px ${h+60}px)`;
        wrap.append(top, bot); main.appendChild(wrap); tg.style.visibility = 'hidden';
        s.wrap = wrap; s.top = top; s.bot = bot; s.w = w; s.h = h;
        s.br = Array.from({length:6}, () => {
          const i = 2 + Math.floor(R()*(s.pts.length-4)), dir = R() < .5 ? -1 : 1, b = [s.pts[i].slice()];
          for (let k=0;k<4;k++) { const [px,py] = b[b.length-1]; b.push([px + (R()-.3)*12, py + dir*(4+R()*7)]); }
          return {i, b, dir};
        });
      },
      stop(s){ s.wrap.remove(); s.target.style.visibility = ''; },
      draw(c, s, p, t, dt, M){
        const r = s.wrap.getBoundingClientRect(), ox = r.left, oy = r.top;
        const e = env(p,.02,.15);
        const n = Math.max(2, Math.floor(smooth(p/.22)*s.pts.length));
        const gap = 9*smooth((p-.22)/.1)*(1 - smooth((p-.78)/.16));
        if (p > .22 && !s.jolt) s.jolt = t;
        if (s.jolt) { const d = t - s.jolt; M.dy += 5*Math.exp(-d/140)*Math.cos(d/40); }
        s.top.style.transform = `translate(${(-gap*.12).toFixed(2)}px, ${(-gap*.5).toFixed(2)}px) rotate(${(-gap*.035).toFixed(3)}deg)`;
        s.bot.style.transform = `translate(${(gap*.12).toFixed(2)}px, ${(gap*.5).toFixed(2)}px) rotate(${(gap*.035).toFixed(3)}deg)`;
        const pts = s.pts.slice(0, n);
        if (gap > .4) {
          c.beginPath();
          pts.forEach(([x,y],i) => { const X = ox+x-gap*.12, Y = oy+y-gap*.5; i ? c.lineTo(X,Y) : c.moveTo(X,Y); });
          for (let i=pts.length-1;i>=0;i--) { const [x,y] = pts[i]; c.lineTo(ox+x+gap*.12, oy+y+gap*.5); }
          c.closePath(); c.fillStyle = rgba('--crack-rgb', e); c.fill();
        }
        c.lineJoin = 'round';
        c.beginPath(); pts.forEach(([x,y],i) => i ? c.lineTo(ox+x,oy+y) : c.moveTo(ox+x,oy+y));
        c.strokeStyle = rgba('--crack-rgb', e); c.lineWidth = 2.6; c.stroke();
        c.beginPath();
        for (const br of s.br) if (br.i < n) br.b.forEach(([x,y],i) => { const Y = oy + y + br.dir*gap*.5; i ? c.lineTo(ox+x,Y) : c.moveTo(ox+x,Y); });
        c.lineWidth = 1.2; c.stroke();
      }},

    burza: { dur: 6200,
      init(s){
        const n = valueNoise(), fbm = (x,y) => (n(x,y) + .5*n(x*2.2,y*2.2) + .25*n(x*4.7,y*4.7))/1.75;
        const cw = Math.ceil(W/4), ch = Math.ceil(H*.75/4), cc = document.createElement('canvas'); cc.width = cw; cc.height = ch;
        const cx = cc.getContext('2d'), d = cx.createImageData(cw, ch);
        for (let y=0;y<ch;y++) for (let x=0;x<cw;x++) {
          const v0 = fbm(x/26, y/14), fade = 1 - y/ch*.6, i = (y*cw+x)*4;
          d.data[i] = 175; d.data[i+1] = 188; d.data[i+2] = 228; d.data[i+3] = clamp(v0*1.5 - .35, 0, 1)*fade*255;
        }
        cx.putImageData(d, 0, 0); s.clouds = cc;
        const ridge = (base, amp, sc) => { const a = []; for (let x=-10; x<=W+10; x+=6) a.push([x, H*base - fbm(x/sc, 3.7)*H*amp - n(x/38, 9.1)*H*.02]); return a; };
        s.far = ridge(.86, .2, 300); s.near = ridge(.95, .14, 190); s.rain = [];
        const bolt = (x0,y0,x1,y1,lv,rough) => {
          let pts = [[x0,y0],[x1,y1]];
          for (let k=0;k<lv;k++) { const np = [pts[0]];
            for (let i=1;i<pts.length;i++) { const [ax,ay] = pts[i-1], [bx,by] = pts[i], L = Math.hypot(bx-ax,by-ay), off = (R()-.5)*L*rough;
              np.push([(ax+bx)/2 + off, (ay+by)/2 + off*.15], [bx,by]); }
            pts = np; }
          return pts;
        };
        s.strikes = [.14, .44, .73].map(at => {
          const i = 2 + Math.floor(R()*(s.near.length-4)), [tx,ty] = s.near[i], sx = tx + (R()-.5)*260, sy = H*(.06 + R()*.12);
          const main = bolt(sx, sy, tx, ty, 8, .32), branches = [];
          for (let b=0;b<4;b++) { const j = 10 + Math.floor(R()*(main.length*.55)), [bx,by] = main[j];
            branches.push(bolt(bx, by, bx + (R()-.5)*260, by + 70 + R()*170, 6, .38)); }
          return {at, main, branches, x: tx, buzzed:false};
        });
      },
      draw(c, s, p, t, dt, M){
        const e = env(p,.08,.2), k = dt/16, tms = p*this.dur;
        c.fillStyle = `rgba(2,3,7,${(.72*e).toFixed(3)})`; c.fillRect(0,0,W,H);
        M.op *= 1 - .3*e; M.sat *= 1 - .8*e; M.cold = Math.max(M.cold, .55*e); M.noc = Math.max(M.noc, e);
        let f = 0, fx = W/2;
        for (const st of s.strikes) {
          const d = tms - st.at*this.dur;
          if (d >= 0 && d < 700) { const a = Math.exp(-d/150); if (a > f) { f = a; fx = st.x; }
            if (!st.buzzed) { st.buzzed = true; try { navigator.vibrate && navigator.vibrate(35); } catch(_){} } }
          if (d > 380 && d < 1300) { const q = d - 380, amp = 7*Math.exp(-q/240); M.dx += amp*Math.sin(q*.1); M.dy += amp*.65*Math.cos(q*.127); }
        }
        if (f > .01) {
          const sky = c.createRadialGradient(fx, H*.25, 0, fx, H*.25, Math.max(W,H)*.8);
          sky.addColorStop(0, `rgba(150,165,225,${(.42*f*e).toFixed(3)})`); sky.addColorStop(1, 'rgba(150,165,225,0)');
          c.fillStyle = sky; c.fillRect(0,0,W,H);
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = .75*f*e; c.drawImage(s.clouds, 0, 0, W, H*.75);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          const shape = pts => { c.beginPath(); c.moveTo(-10,H); pts.forEach(([x,y]) => c.lineTo(x,y)); c.lineTo(W+10,H); c.closePath(); };
          shape(s.far); c.fillStyle = `rgba(22,25,38,${(.95*f*e).toFixed(3)})`; c.fill();
          c.beginPath(); s.far.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
          c.strokeStyle = `rgba(185,198,245,${(.45*f).toFixed(3)})`; c.lineWidth = 1; c.stroke();
          shape(s.near); c.fillStyle = `rgba(3,3,6,${(.98*f*e).toFixed(3)})`; c.fill();
          M.bright *= 1 + 1.4*f;
        }
        c.globalCompositeOperation = 'lighter';
        for (const st of s.strikes) {
          const d = tms - st.at*this.dur; if (d < 0 || d > 420) continue;
          const b = Math.max(Math.exp(-d/55), d > 75 ? .8*Math.exp(-(d-75)/45) : 0, d > 170 ? .55*Math.exp(-(d-170)/50) : 0);
          const path = pts => { c.beginPath(); pts.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); };
          c.lineJoin = 'round'; c.lineCap = 'round';
          path(st.main);
          c.strokeStyle = `rgba(120,140,255,${(.22*b).toFixed(3)})`; c.lineWidth = 10; c.stroke();
          c.strokeStyle = `rgba(185,200,255,${(.5*b).toFixed(3)})`; c.lineWidth = 3.2; c.stroke();
          c.strokeStyle = `rgba(250,252,255,${b.toFixed(3)})`; c.lineWidth = 1.3; c.stroke();
          st.branches.forEach(br => { path(br); c.strokeStyle = `rgba(170,190,255,${(.3*b).toFixed(3)})`; c.lineWidth = 3; c.stroke();
            c.strokeStyle = `rgba(235,240,255,${(.7*b).toFixed(3)})`; c.lineWidth = .8; c.stroke(); });
        }
        c.globalCompositeOperation = 'source-over';
        let n = 26*e*k; while (n > 0) { if (n >= 1 || R() < n) { const z = R(); s.rain.push({x:R()*W*1.3 - W*.1, y:-40, l:18 + z*30, v:16 + z*14, a:.08 + z*.22, w:.5 + z*.7}); } n--; }
        c.lineCap = 'round';
        s.rain = s.rain.filter(r => { r.y += r.v*k; r.x -= r.v*.2*k;
          c.strokeStyle = `rgba(185,195,220,${Math.min(1, (r.a + .5*f)*e).toFixed(3)})`; c.lineWidth = r.w;
          c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x + r.l*.2, r.y - r.l); c.stroke(); return r.y < H + 40; });
      }},

    wiatr: { dur: 5000,
      init(s){ s.q = []; s.g = 0; s.v = 0; s.x = 0; },
      draw(c, s, p, t, dt, M, cb){
        const e = env(p,.1,.25), k = dt/16;
        const target = (.35 + .65*clamp(p/.6,0,1))*(.65 + .35*Math.sin(t/380) + .22*Math.sin(t/127));
        s.g += (target - s.g)*.08*k;
        const sp = 4 + s.g*22;
        let n = (1.5 + 7*s.g)*e*k;
        while (n > 0) { if (n >= 1 || R() < n) s.q.push({x:-40, y:R()*H, m:.5+R()*.9, ph:R()*6, r:.6+R()*1.6, fr:R() < .3}); n--; }
        c.lineCap = cb.lineCap = 'round';
        // Liczy się tylko wiatr, który wchodzi w sam akapit z zapalnikiem — nie ten, który
        // przelatuje nad nagłówkiem albo pod ostatnim wierszem. Pas jest o 40 px szerszy
        // od akapitu, żeby smuga tuż nad tekstem też się liczyła.
        const akapit = (s.target || main).getBoundingClientRect();
        const gora = akapit.top - 40, dol = akapit.bottom + 40, lewa = akapit.left;
        let uderzenie = 0;
        s.q = s.q.filter(o => {
          const przed = o.x;
          o.x += sp*o.m*k; o.y += Math.sin(o.x/70+o.ph)*.8*k;
          const len = sp*o.m*2.2, ctx = o.fr ? c : cb;
          ctx.strokeStyle = rgba('--wind-rgb', (o.fr ? .5 : .28)*e); ctx.lineWidth = o.fr ? o.r*1.4 : o.r;
          ctx.beginPath(); ctx.moveTo(o.x-len,o.y); ctx.lineTo(o.x,o.y); ctx.stroke();
          // smuga liczy się tylko w chwili, gdy wchodzi na kolumnę, i tym mocniej, im bliżej
          if (przed < lewa && o.x >= lewa && o.y > gora && o.y < dol) uderzenie += o.m*(o.fr ? 1 : .45);
          return o.x - len < W;
        });
        const g = s.g*e;
        const slabnie = 1 - .45*clamp(p, 0, 1);
        // Tekst jest nieruchomy, dopóki wiatr do niego nie dojdzie. Dopiero smuga, która
        // wchodzi na kolumnę, podbija amplitudę kołysania; między podmuchami amplituda opada,
        // więc średnie przesunięcie zostaje zerowe i kolumna nie ucieka w bok.
        // Rozmycie i smuga za literami też idą z tej amplitudy, a nie z siły wiatru za ekranem —
        // inaczej tekst reagowałby, zanim cokolwiek do niego doleci.
        s.v = Math.min(.85, s.v + uderzenie * 1.6 * e);   // smug w pasie akapitu jest mało, więc każda waży więcej
        s.v *= Math.pow(.93, k);
        const drganie = Math.sin(t/57) + Math.sin(t/23)*.5 + Math.sin(t/11)*.28;   // -1,8…1,8
        const sila = s.v * slabnie;                // szczyt poniżej 2 px: tekst ma drgnąć, nie chodzić
        M.dx += sila * drganie;
        M.skew += sila * .14 * Math.sin(t/83);
        M.blur += .4*sila;
        M.shadow.push(`${(-6*sila).toFixed(1)}px 0 1px rgba(${v('--fg-rgb')},${(.26*sila).toFixed(3)})`, `${(-13*sila).toFixed(1)}px 0 3px rgba(${v('--fg-rgb')},${(.12*sila).toFixed(3)})`);
      }},

    /* Lawinki (Rysy, „co kilka minut schodziła kolejna lawinka”): trzy małe lawiny pyłowe,
       jedna po drugiej, każda innym żlebem. Czoło zsuwa się ukosem i zwalnia, za nim rośnie
       i rzednie obłok pyłu. Wcześniejsza wersja sypała drobinami z góry ekranu i wyglądała
       jak zwykły śnieg (przegląd 2026-11-15). */
    lawinki: { dur: 6500,
      init(s){
        const bok = R() < .5 ? 1 : -1;
        // start poza kolumną tekstu, zjazd w stronę środka; kolejne lawiny na zmianę z obu stron
        s.zleby = [.06, .34, .6].map((at, i) => { const strona = i % 2 ? -bok : bok;
          const x0 = W*(.5 - strona*(.3 + R()*.14)), y0 = H*(.04 + R()*.1), kat = (38 + R()*16)*Math.PI/180;
          return {at, x0, y0, dx: strona*Math.cos(kat), dy: Math.sin(kat), dl: H*(.5 + R()*.2), ost: -1}; });
        s.pyl = []; s.grudki = [];
      },
      draw(c, s, p, t, dt, M){
        const k = dt/16, e = env(p,.03,.2), ms = p*this.dur;
        let rum = 0;
        for (const z of s.zleby) {
          const q = (ms - z.at*this.dur)/1900; if (q < 0 || q > 1) continue;
          const u = 1 - Math.pow(1 - q, 2.2), sila = Math.sin(Math.min(1, q*1.15)*Math.PI);   // zwalnia przy końcu
          const x = z.x0 + z.dx*z.dl*u, y = z.y0 + z.dy*z.dl*u;
          rum = Math.max(rum, sila);
          // obłok: rzadkie, szerokie kłęby, które wloką się za czołem i unoszą
          let n = (2.4 + 3.4*sila)*k;
          while (n > 0) { if (n >= 1 || R() < n) { const w = (R()-.5)*(40 + 110*q), tyl = R()*70*q;
            s.pyl.push({x: x - z.dy*w - z.dx*tyl + (R()-.5)*14, y: y + z.dx*w - z.dy*tyl + (R()-.5)*14,
              vx: z.dx*(1.3*(1-q) + .15) + (R()-.5)*.7, vy: z.dy*(1.3*(1-q) + .15) - .3 - R()*.5,
              r: 9 + R()*16, rr: .45 + R()*.7, age: 0, life: 700 + R()*1100, a: (.07 + R()*.1)*(.45 + .55*sila)}); } n--; }
          // czoło: grudki śniegu wyrzucane przed lawinę — to one mówią, że coś się sypie
          let g = 7*sila*k;
          while (g > 0) { if (g >= 1 || R() < g) { const w = (R()-.5)*(30 + 70*q), sp = 2.5 + R()*3.5;
            s.grudki.push({x: x - z.dy*w, y: y + z.dx*w, vx: z.dx*sp + (R()-.5)*1.4, vy: z.dy*sp - R()*1.6,
              r: .6 + R()*1.3, age: 0, life: 380 + R()*420}); } g--; }
        }
        c.fillStyle = rgba('--powder-rgb', 1);
        s.grudki = s.grudki.filter(d => { d.age += dt; const a = 1 - d.age/d.life; if (a <= 0) return false;
          d.vy += .11*k; d.x += d.vx*k; d.y += d.vy*k;
          c.globalAlpha = .85*a*e; c.fillRect(d.x, d.y, d.r*2, d.r*2); return true; });
        c.globalAlpha = 1;
        s.pyl = s.pyl.filter(d => { d.age += dt; const a = 1 - d.age/d.life; if (a <= 0) return false;
          d.x += d.vx*k; d.y += d.vy*k; d.vx *= Math.pow(.975, k); d.vy *= Math.pow(.975, k); d.r += d.rr*k;
          const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
          g.addColorStop(0, rgba('--powder-rgb', d.a*a*e)); g.addColorStop(1, rgba('--powder-rgb', 0));
          c.fillStyle = g; c.fillRect(d.x - d.r, d.y - d.r, d.r*2, d.r*2); return true; });
        // huk odbity od ścian: tekst drży tylko wtedy, gdy lawina idzie
        M.dx += 1.5*rum*e*(Math.sin(t*.052) + .5*Math.sin(t*.17)); M.dy += 1.1*rum*e*(Math.sin(t*.061) + .5*Math.sin(t*.21));
      }},

    bidon: { dur: 7000,
      init(s){
        const r = s.btn.getBoundingClientRect(), col = colRect();
        let x = W - col.right > 100 ? col.right + 50 : clamp(r.right + 24, 30, W - 30), y = r.top + r.height/2;
        const y0 = y; let vx = .9, vy = -3.4, rot = 0, spin = .05;
        const ledges = [120, 250, 395, 560, 745, 950, 1180].map(d => y0 + d);
        s.path = []; s.rocks = []; let hit = 0;
        for (let i=0; i<520; i++) {
          const py = y; vy += .34; x += vx; y += vy; rot += spin;
          if (hit < ledges.length && py < ledges[hit] && y >= ledges[hit]) {
            y = ledges[hit]; vy = -Math.abs(vy)*.4 - .6; vx = (hit%2 ? 1 : -1)*(1.4 + hit*.4); spin = vx*.05;
            s.rocks.push({x, y: y+20, w:46+R()*40, h:16+R()*14, step:i, seed:[R(),R(),R(),R()]}); hit++;
          }
          if (x < 16 || x > W-16) { vx *= -1; x = clamp(x,16,W-16); }
          s.path.push([x,y,rot,vx,vy]);
          if (y > H + 90) break;
        }
        s.y0 = y0; s.dust = []; s.last = -1; s.hitT = 0;
        s.btn.style.color = v('--pink');
      },
      stop(s){ s.btn.style.color = ''; },
      draw(c, s, p, t, dt, M){
        const idx = clamp(Math.floor((t - s.start)/16), 0, s.path.length-1);
        if (idx >= s.path.length-1) { s.done = true; return; }
        const [x,y] = s.path[idx], depth = clamp((y - s.y0)/H, 0, 1), e = env(p,.02,.06);
        const ab = c.createLinearGradient(0,H*.5,0,H);
        ab.addColorStop(0,'rgba(0,0,0,0)'); ab.addColorStop(1,`rgba(0,0,0,${(.8*depth*e).toFixed(3)})`);
        c.fillStyle = ab; c.fillRect(0,H*.5,W,H*.5);
        for (const rk of s.rocks) {
          if (s.last < rk.step && idx >= rk.step) {
            s.hitT = t;
            for (let i=0;i<14;i++) s.dust.push({x:rk.x+(R()-.5)*16, y:rk.y-18, vx:(R()-.5)*2.6, vy:-R()*1.8, age:0, life:600+R()*500, spark:false});
            for (let i=0;i<7;i++) { const a = -Math.PI/2 + (R()-.5)*2.4, sp = 2 + R()*4; s.dust.push({x:rk.x, y:rk.y-18, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, age:0, life:160+R()*160, spark:true}); }
          }
        }
        s.last = idx;
        if (s.hitT) { const d = t - s.hitT; M.dy += 2.5*Math.exp(-d/90)*Math.cos(d/25); }
        s.dust = s.dust.filter(d => { d.age += dt; d.x += d.vx; d.y += d.vy; d.vy += d.spark ? .18 : .04; if (!d.spark) { d.vx *= .97; } const a = 1 - d.age/d.life; if (a <= 0) return false;
          if (d.spark) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,230,180,${a.toFixed(3)})`; c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(d.x,d.y); c.lineTo(d.x - d.vx*2.5, d.y - d.vy*2.5); c.stroke(); c.globalCompositeOperation = 'source-over'; }
          else { const r = 2 + (1-a)*7, g = c.createRadialGradient(d.x,d.y,0,d.x,d.y,r); g.addColorStop(0, `rgba(165,158,150,${(.35*a).toFixed(3)})`); g.addColorStop(1, 'rgba(165,158,150,0)');
            c.fillStyle = g; c.fillRect(d.x-r,d.y-r,r*2,r*2); }
          return true; });
        const sc = 1 - .4*depth;
        [9,6,3].forEach((g,i) => { const j = idx - g; if (j < 0) return; const [gx,gy,gr,,gvy] = s.path[j]; if (Math.abs(gvy) < 6) return;
          bottle(c, gx, gy, gr, sc, [.06,.1,.18][i]*e); });
        const [, , rot] = s.path[idx];
        bottle(c, x, y, rot, sc, e);
      }},

    wtf: { dur: 1600, level: 0,
      lines: ['Badania pokazały, że użytkownicy preferują o 37% więcej przycisków.',
        'Zgodnie z heurystyką Nielsena nr 14 ten ekran jest w pełni dostępny.',
        'Ticket wdrożono w poprzednim sprincie. Klient był zachwycony.',
        'Na podstawie ośmiu wywiadów ustalono, że wszyscy użytkownicy myślą tak samo.',
        'Ten design system powstał w 1786 roku na szczycie Mont Blanc.',
        'Model potwierdził, że model miał rację.'],
      // Halucynacja dopasowana do każdego „WTF” po kolei (autor, 16.11): pewna siebie, pasuje
      // do kontekstu akapitu i jest zła. Lista ogólna wyżej zostaje na zapas.
      wlasne: [
        'Ten ekran jest w produkcie od 2019 roku. Model widział go w dokumentacji, której nikt inny nie widział.',
        'Kryteria akceptacji: przycisk ma być jednocześnie widoczny i ukryty. Wycena: 2 punkty.',
        'Makieta gotowa do wdrożenia: 14 ekranów, wszystkie przyciski główne, wszystkie najważniejsze.',
        'Kod przeszedł review. Recenzentem był agent, który go napisał. Zatwierdzono w 100%.',
        'Ustalono: premiera w piątek. Odpowiada Krzysztof z działu, którego nie ma.',
        'Zespół jest pewny kierunku. Źródło: zespół.'],
      init(s){
        this.level = Math.min(6, this.level + 1); s.lv = this.level;
        // fazy w milisekundach: wejście w glitch, halucynacja do przeczytania, wyjście.
        // Halucynacja stoi 1,4 s (wcześniej ok. 0,4 s — nie dało się jej przeczytać).
        s.g1 = 320 + s.lv*40; s.hold = 1400 + s.lv*60; s.dur = s.g1 + s.hold + 340;
        hud(`halucynacje ${s.lv}`);
        const tg = s.target, r = tg.getBoundingClientRect(), mr = main.getBoundingClientRect();
        const wrap = document.createElement('div'); wrap.className = 'glitchwrap';
        Object.assign(wrap.style, {left:(r.left-mr.left)+'px', top:(r.top-mr.top)+'px', width:r.width+'px', height:r.height+'px'});
        const orig = () => { const n = tg.cloneNode(true); n.removeAttribute('id'); n.querySelectorAll('[data-fx]').forEach(b => b.setAttribute('tabindex','-1')); return n; };
        const hal = document.createElement('p'); hal.className = 'halluc'; const nr = [...document.querySelectorAll('[data-fx="wtf"]')].indexOf(s.btn);
        hal.textContent = this.wlasne[nr] ?? this.lines[Math.floor(R()*this.lines.length)];
        s.base = orig(); s.hal = hal; s.r = orig(); s.r.classList.add('rgb-r'); s.c = orig(); s.c.classList.add('rgb-c');
        s.sl = Array.from({length: 2 + s.lv}, () => orig());
        wrap.append(s.base, hal, s.r, s.c, ...s.sl); main.appendChild(wrap); tg.style.visibility = 'hidden';
        s.wrap = wrap; s.h = r.height; s.next = 0;
      },
      stop(s){ s.wrap.remove(); s.target.style.visibility = ''; },
      draw(c, s, p, t, dt, M){
        const ms = (t - s.start), q = ms/s.dur; if (q >= 1) { s.done = true; return; }
        const halPhase = ms > s.g1 && ms < s.g1 + s.hold, glitching = !halPhase || ms < s.g1 + 140 || ms > s.g1 + s.hold - 140;
        s.base.style.visibility = halPhase ? 'hidden' : 'visible'; s.hal.style.visibility = halPhase ? 'visible' : 'hidden';
        if (t >= s.next) {
          s.next = t + 45 + R()*40;
          const amp = 3 + s.lv*4, show = glitching ? 'visible' : 'hidden';
          const src = halPhase ? s.hal : s.base;
          [s.r, s.c, ...s.sl].forEach(n => { if (n.textContent !== src.textContent) { n.textContent = ''; n.append(...[...src.cloneNode(true).childNodes]); } n.style.visibility = show; });
          const off = 1.5 + s.lv*1.2;
          s.r.style.transform = `translate(${(-off + (R()-.5)*2).toFixed(1)}px,${((R()-.5)*1.5).toFixed(1)}px)`;
          s.c.style.transform = `translate(${(off + (R()-.5)*2).toFixed(1)}px,${((R()-.5)*1.5).toFixed(1)}px)`;
          for (const n of s.sl) { const top = R()*s.h, sh = 3 + R()*(6 + s.lv*3);
            n.style.clipPath = `inset(${top.toFixed(0)}px 0 ${Math.max(0, s.h - top - sh).toFixed(0)}px 0)`;
            n.style.transform = `translateX(${((R()-.5)*2*amp).toFixed(1)}px)`; }
        }
        if (s.lv >= 3 && glitching) { M.dx += (R()-.5)*(s.lv-2)*1.6; }
        if (s.lv >= 5 && glitching && R() < .15) { c.fillStyle = `rgba(${v('--fg-rgb')},.05)`; c.fillRect(0, R()*H, W, 2 + R()*6); }
      }},

    drzenie: { dur: 3600,
      init(s){ s.sp = splitText(s.btn, 'char'); s.n = 0; },
      stop(s){ s.sp.restore(); },
      draw(c, s, p, t){
        if (t < s.n) return; s.n = t + 34;
        const e = env(p,.15,.3), amp = 2*e;
        for (const ch of s.sp.units) ch.style.transform = `translate(${((R()-.5)*2*amp).toFixed(2)}px,${((R()-.5)*2*amp).toFixed(2)}px) rotate(${((R()-.5)*4*e).toFixed(1)}deg)`;
      }},

    /* Odpadasz (Mnich): lot na linie, liczony jak prawdziwy. Słowo odrywa się, leci swobodnie
       i obraca się w locie, lina jest luźna i wlecze się łukiem. Gdy się napnie, szarpie:
       rozciąga się i oddaje (lina dynamiczna), a słowo idzie wahadłem pod ostatni punkt
       asekuracji i kołysze się, aż wytraci ruch. Na koniec lina je wybiera z powrotem na
       miejsce. Ruch wychodzi z symulacji (grawitacja, lina jako jednostronna sprężyna,
       tłumienie), nie z rozpisanej krzywej — poprzednia wersja zjeżdżała sztywno w dół
       po prostej kresce i wyglądała jak spadający klocek (autor, 2026-11-15). */
    odpadasz: { dur: 5600,
      init(s){
        const b = s.btn.style, r = s.btn.getBoundingClientRect(), pr = s.target.getBoundingClientRect();
        b.display = 'inline-block'; b.willChange = 'transform'; b.position = 'relative'; b.zIndex = '4';
        b.transformOrigin = '50% 0';                       // lina trzyma słowo za środek górnej krawędzi
        const tlo = v('--bg');                             // otok w kolorze tła: słowo nie zlewa się z tekstem, nad którym leci
        b.textShadow = `0 0 3px ${tlo}, 0 0 3px ${tlo}, 0 0 6px ${tlo}, 0 0 6px ${tlo}`;
        s.dom = {x: r.left + r.width/2 - pr.left, y: r.top - pr.top};      // miejsce słowa względem akapitu
        // ostatni punkt asekuracji: trochę w bok i tuż nad wierszem — stąd bierze się wahadło
        const bok = Math.min(70, Math.max(34, r.width*.8));
        s.punkt = {x: -bok, y: -3};
        s.L0 = Math.hypot(bok, 3);                         // tyle liny jest między punktem a wspinaczem
        s.L = s.L0 + clamp(H*.13, 70, 120);                // + luz: tyle leci, zanim lina zacznie trzymać
        s.x = 0; s.y = 0; s.vx = 26; s.vy = -40;           // odpada lekko od ściany
        s.kat = 0; s.w = (R() < .5 ? -1 : 1)*(2.2 + R()*1.4);              // obrót w locie
        s.czas = 0; s.zlapane = 0;
      },
      stop(s){ const b = s.btn.style; b.transform = ''; b.willChange = ''; b.display = ''; b.position = ''; b.zIndex = '';
        b.transformOrigin = ''; b.textShadow = ''; },
      draw(c, s, p, t, dt, M){
        const ms = p*this.dur, WYB = 3500, wyb = smooth((ms - WYB)/(this.dur - WYB - 250));    // wybieranie liny
        // punkt i długość liny: przy wybieraniu punkt schodzi na miejsce słowa, a lina się skraca
        const ax = s.punkt.x*(1 - wyb), ay = s.punkt.y*(1 - wyb), L = s.L*(1 - wyb);
        // symulacja małymi krokami — sprężyna liny jest sztywna, duży krok by ją rozsadził
        let zostalo = Math.min(48, dt)/1000;
        while (zostalo > 0) { const h = Math.min(.004, zostalo); zostalo -= h;
          let fx = 0, fy = 1500;                                           // grawitacja, px/s²
          const dx = s.x - ax, dy = s.y - ay, d = Math.hypot(dx, dy) || 1, napiecie = d - L;
          if (napiecie > 0) {                                              // lina trzyma tylko rozciągnięta
            const ux = dx/d, uy = dy/d, vr = s.vx*ux + s.vy*uy;
            const sila = 260*napiecie + (16 + 60*wyb)*vr;
            fx -= sila*ux; fy -= sila*uy;
            if (!s.zlapane && napiecie > 2) s.zlapane = t;
            // słowo wisi za górną krawędź, więc ustawia się wzdłuż liny
            const cel = (Math.atan2(dy, dx) - Math.PI/2)*(1 - wyb);
            s.w += (-46*(s.kat - cel) - 7*s.w)*h;
          } else s.w -= .5*s.w*h;                                          // w locie obraca się prawie bez oporu
          const opor = .55 + 5*wyb;
          s.vx += (fx - opor*s.vx)*h; s.vy += (fy - opor*s.vy)*h;
          s.x += s.vx*h; s.y += s.vy*h; s.kat += s.w*h;
        }
        if (wyb > .985) { s.x *= .5; s.y *= .5; s.kat *= .5; }             // ostatnie piksele: dosiada na miejsce
        if (s.zlapane) { const d = t - s.zlapane; M.dy += 3.5*Math.exp(-d/130)*Math.cos(d/32); }
        s.btn.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) rotate(${s.kat.toFixed(3)}rad)`;

        // lina na płótnie: od punktu do górnej krawędzi słowa
        const pr = s.target.getBoundingClientRect(), hx = pr.left + s.dom.x, hy = pr.top + s.dom.y;
        const Ax = hx + ax, Ay = hy + ay, Bx = hx + s.x, By = hy + s.y, e = env(p, .01, .06);
        const d = Math.hypot(Bx - Ax, By - Ay), luz = Math.max(0, L - d);
        // luźna lina zwisa łukiem; napięta drga jak struna tuż po szarpnięciu
        let kx = (Ax + Bx)/2, ky = (Ay + By)/2 + Math.min(60, luz*.75);
        if (s.zlapane && !luz) { const q = t - s.zlapane, drg = 7*Math.exp(-q/260)*Math.sin(q/21);
          kx += -(By - Ay)/d*drg; ky += (Bx - Ax)/d*drg; }
        const fg = v('--fg-rgb');
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(Ax, Ay); c.quadraticCurveTo(kx, ky, Bx, By);
        c.strokeStyle = `rgba(${fg},${(.7*e).toFixed(3)})`; c.lineWidth = 1.2; c.stroke();
        // punkt asekuracji: kółko w tekście, tam gdzie ostatnio się wpiął
        c.beginPath(); c.arc(Ax, Ay, 3, 0, TAU);
        c.strokeStyle = `rgba(${fg},${(.85*e*(1 - wyb)).toFixed(3)})`; c.lineWidth = 1.3; c.stroke();
      }},

    most: { dur: 5200,
      init(s){
        s.sec = s.btn.closest('section'); s.ps = [...s.sec.querySelectorAll('p:not(.fxnote)')];
        s.sp = s.ps.map(pp => splitText(pp, 'word')); s.words = s.sp.flatMap(x => x.units);
        s.xs = s.words.map(w => w.offsetLeft + w.offsetWidth/2);
      },
      stop(s){ s.sp.forEach(x => x.restore()); s.sec.style.transform = ''; },
      draw(c, s, p, t){
        const e = env(p,.2,.3);
        s.words.forEach((w, i) => { w.style.transform = `translateY(${(7*e*Math.sin(t/230 - s.xs[i]/90)).toFixed(2)}px)`; });
        s.sec.style.transform = `rotate(${(.5*e*Math.sin(t/700)).toFixed(3)}deg) translateX(${(4*e*Math.sin(t/700)).toFixed(2)}px)`;
      }},

    /* Błysk (wstęp, „Błysk. / Liczysz do dziewięciu. / Grzmot.”): błyskawica, ciche liczenie
       przy następnej linijce i grzmot jako drżenie. Drugi „Błysk.” liczy do sześciu i grzmi
       mocniej — burza jest bliżej. Pierwszy zapalnik eseju, zaraz po burzy z intro. */
    blysk: { dur: 4800,
      init(s){
        let n = s.btn.closest('.line');
        do { n = n && n.nextElementSibling; } while (n && !n.classList.contains('line'));
        s.ile = n && /sześciu/.test(n.textContent) ? 6 : 9;
        s.dur = 620 + s.ile*290 + 1500;
        // Liczenie idzie pionowo pod linijką, cyfra pod cyfrą, i zostaje na stronie (autor, 16.11):
        // wstęp może się wydłużyć, a tekst nie skacze drugi raz, gdy liczba by znikała.
        // Wszystkie cyfry powstają od razu (jeden skok układu), potem kolejno się zapalają.
        s.licz = n && n.nextElementSibling?.classList.contains('fx-liczenie') ? n.nextElementSibling : null;
        s.juz = !!s.licz;                                 // drugie kliknięcie: liczenie już stoi
        if (n && !s.licz) {
          s.licz = document.createElement('span'); s.licz.className = 'fx-liczenie'; s.licz.setAttribute('aria-hidden', 'true');
          for (let i = 1; i <= s.ile; i++) { const d = document.createElement('i'); d.textContent = i; s.licz.append(d); }
          n.after(s.licz);
        }
      },
      draw(c, s, p, t, dt, M){
        const ms = t - s.start;
        // podwójny błysk — ta sama krzywa co burza w intro (dwa błyski w 180 ms, potem cisza)
        const fo = ms < 55 ? .85 : ms < 120 ? .12 : ms < 180 ? .6 : ms < 900 ? .6*Math.exp(-(ms-180)/140) : 0;
        if (fo > .004) {
          const jasny = root.getAttribute('data-theme') === 'jasny';   // na jasnej stronie błysk jest mrugnięciem w ciemność
          c.fillStyle = jasny ? `rgba(22,25,28,${(fo*.5).toFixed(3)})` : `rgba(228,236,250,${(fo*.5).toFixed(3)})`;
          c.fillRect(0,0,W,H);
          if (!jasny) M.bright *= 1 + .45*fo;
        }
        const k = clamp(Math.floor((ms - 620)/290) + 1, 0, s.ile);
        if (s.licz && !s.juz && k !== s.k) { s.k = k; [...s.licz.children].forEach((d, i) => d.classList.toggle('on', i < k)); }
        const g = ms - (620 + s.ile*290);
        if (g > 0) {
          const moc = s.ile === 6 ? 1.6 : 1, a = moc*4.2*Math.exp(-g/420)*Math.min(1, g/60);
          M.dx += a*(Math.sin(g*.071) + .5*Math.sin(g*.19)); M.dy += a*.7*(Math.sin(g*.083) + .5*Math.sin(g*.23));
          if (!s.buzz) { s.buzz = true; try { navigator.vibrate && navigator.vibrate(s.ile === 6 ? [40, 60, 90] : 60); } catch(_){} }
        }
      }},

    /* Puf (Marmolada, „zniknęły też jego myśli. Puf.”): litery akapitu rozsypują się w pył,
       od lewej do prawej — na końcu także samo „Puf.” (autor, 16.11) — i po chwili tekst wraca. */
    puf: { dur: 3900,
      init(s){
        s.sp = splitText(s.target, 'char');
        const lit = s.sp.units;                          // razem z „Puf.” — znika wszystko
        s.lit = lit.map((u, i) => ({u, od: 150 + i/Math.max(1, lit.length)*950 + R()*140,
          dx: 6 + R()*26, dy: -(8 + R()*30), ob: (R()-.5)*50, pyl: false}));
        s.pyl = [];
      },
      stop(s){ s.sp.restore(); },
      draw(c, s, p, t, dt){
        const ms = t - s.start, k = dt/16, WROC = 2900, wraca = smooth((ms - WROC)/550);
        for (const l of s.lit) {
          const q = clamp((ms - l.od)/520, 0, 1), e = 1 - Math.pow(1 - q, 2);
          if (ms >= WROC) { l.u.style.transform = ''; l.u.style.opacity = wraca.toFixed(2); continue; }
          if (q <= 0) continue;
          if (!l.pyl) { l.pyl = true; const r = l.u.getBoundingClientRect();
            for (let i = 0; i < 2; i++) s.pyl.push({x: r.left + R()*r.width, y: r.top + R()*r.height, vx: .3 + R()*1.1, vy: -(.2 + R()*.9), age: 0, life: 500 + R()*700, r: .5 + R()*.9}); }
          l.u.style.transform = `translate(${(l.dx*e).toFixed(1)}px,${(l.dy*e).toFixed(1)}px) rotate(${(l.ob*e).toFixed(1)}deg) scale(${(1 - .5*e).toFixed(2)})`;
          l.u.style.opacity = (1 - e).toFixed(2);
        }
        c.fillStyle = `rgb(${v('--fg-rgb')})`;
        s.pyl = s.pyl.filter(d => { d.age += dt; const a = 1 - d.age/d.life; if (a <= 0) return false;
          d.x += d.vx*k; d.y += d.vy*k; d.vy -= .004*k; c.globalAlpha = .55*a; c.fillRect(d.x, d.y, d.r*2, d.r*2); return true; });
        c.globalAlpha = 1;
      }},

    /* Dwa świetliki (Mont Blanc, „Dwa świetliki odłączone od swojego roju. Krok za krokiem.
       W jednym rytmie, pośród ciemnego lasu.”): noc, dwa światła idą razem. Bez rysowanych pni —
       pionowe pasy wyglądały jak błąd obrazu (autor, 2026-11-15).
       Powrót motywu z Gran Paradiso — tam był rój, tu zostało dwoje. */
    dwa: { dur: 6500,
      init(s){ s.slad = [[], []]; },
      draw(c, s, p, t, dt, M){
        const e = env(p, .12, .2);
        c.fillStyle = `rgba(3,4,9,${(.78*e).toFixed(3)})`; c.fillRect(0,0,W,H);
        M.sat *= 1 - .7*e; M.noc = Math.max(M.noc, e);
        c.globalCompositeOperation = 'lighter';
        [0, 1].forEach(i => {
          const q = clamp(p*1.02 - i*.075, 0, 1);                       // drugie idzie krok za pierwszym
          const x = W*.36 + q*W*.2 + Math.sin(q*9 + i)*5 + i*16, y = H*.9 - q*H*.72 + Math.sin(t/250 + i*.4)*1.6;   // ten sam rytm
          const sl = s.slad[i]; sl.push([x, y]); if (sl.length > 14) sl.shift();
          const ang = sl.length > 3 ? Math.atan2(y - sl[sl.length-4][1], x - sl[sl.length-4][0]) : -Math.PI/2;
          czolowka(c, x, y, ang, e*(.8 + .2*Math.sin(t/110 + i*2)), sl);
        });
        c.globalCompositeOperation = 'source-over';
      }},

    /* Choinka (Mont Blanc, „korytarz świetlików. Wyglądało to jak choinka.”): sznur świateł
       zakosami od Tête Rousse do Goûter — szeroko na dole, wąsko u góry. */
    choinka: { dur: 6500,
      init(s){
        const N = 8; s.sciezka = [];
        for (let i = 0; i <= N; i++) { const u = i/N, bok = (i % 2 ? 1 : -1)*(W*.02 + Math.min(W*.2, 230)*(1 - u));
          s.sciezka.push([W/2 + bok, H*.9 - u*H*.8]); }
        s.dl = [0]; for (let i = 1; i < s.sciezka.length; i++) s.dl.push(s.dl[i-1] + Math.hypot(s.sciezka[i][0] - s.sciezka[i-1][0], s.sciezka[i][1] - s.sciezka[i-1][1]));
        s.sw = Array.from({length: 30}, (_, i) => ({u: i/30 + (R()-.5)*.012, ph: R()*6, j: (R()-.5)*8}));
      },
      draw(c, s, p, t, dt, M){
        const e = env(p, .12, .2), cala = s.dl[s.dl.length-1];
        c.fillStyle = `rgba(3,4,9,${(.78*e).toFixed(3)})`; c.fillRect(0,0,W,H);
        M.sat *= 1 - .7*e; M.noc = Math.max(M.noc, e);
        c.globalCompositeOperation = 'lighter';
        for (const z of s.sw) {
          const u = z.u*.9 + p*.09; if (u > smooth(p/.35) + .02) continue;      // sznur zapala się od dołu
          const d = u*cala; let i = 1; while (i < s.dl.length-1 && s.dl[i] < d) i++;
          const f = (d - s.dl[i-1])/Math.max(1, s.dl[i] - s.dl[i-1]);
          const x = s.sciezka[i-1][0] + (s.sciezka[i][0] - s.sciezka[i-1][0])*f + z.j, y = s.sciezka[i-1][1] + (s.sciezka[i][1] - s.sciezka[i-1][1])*f;
          const a = e*(.6 + .4*Math.sin(t/140 + z.ph)), r = 13 - 6*u;            // wyżej = dalej = mniejsze
          const g = c.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, rgba('--glow-rgb', .5*a)); g.addColorStop(1, rgba('--glow-rgb', 0));
          c.fillStyle = g; c.fillRect(x - r, y - r, r*2, r*2);
          c.fillStyle = `rgba(255,250,236,${a.toFixed(3)})`; c.beginPath(); c.arc(x, y, 1.9 - .8*u, 0, TAU); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }},

    /* ===== Propozycje z 2026-11-16 (plan-poprawek.md, sekcja D) — do oceny autora ===== */

    /* Jego oczami (Mont Blanc, „zobaczyć naszą dwójkę jego oczami. Dwie małe postaci na białym
       zboczu, połączone liną. Tuż obok ogromnej szczeliny.”): widok z paralotni. Tekst oddala się
       i blednie jak teren widziany z góry, zalewa go biel zbocza, a na niej dwie maleńkie
       postaci na linie idą powoli w górę — tuż obok miękkiej, ciemnej szczeliny. */
    oczami: { dur: 6400,
      init(s){
        const r = s.btn.getBoundingClientRect();
        main.style.transformOrigin = `${(r.left + r.width/2 - colRect().left).toFixed(0)}px ${(scrollY + r.top - main.getBoundingClientRect().top - scrollY).toFixed(0)}px`;
        s.x0 = W*(.46 + R()*.08); s.y0 = H*.56;
      },
      stop(s){ main.style.transformOrigin = ''; },
      draw(c, s, p, t, dt, M){
        const e = env(p, .22, .22), jasny = root.getAttribute('data-theme') === 'jasny';
        M.scale *= 1 - .16*e; M.blur += 1.4*e; M.op *= 1 - .55*e;
        // biel zbocza z lekkim cieniem od dołu
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(242,245,248,${(.86*e).toFixed(3)})`); g.addColorStop(1, `rgba(208,215,224,${(.86*e).toFixed(3)})`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // Kadr jak na zdjęciu z paralotni (autor, 16.11): wielka szczelina łukiem przez zbocze —
        // niebieski cień w lodzie z jasną krawędzią — a dwie postaci daleko od siebie, połączone
        // długą, zwisającą liną, z długimi cieniami. Rysujemy cień i światło, nie bryłę.
        const sx = s.x0, sy = s.y0;
        const luk = (dx) => [sx - 150 + dx, sy + 120 - dx*.25];
        c.save(); c.lineCap = 'round';
        const cien = c.createLinearGradient(sx - 220, sy - 200, sx + 40, sy + 160);
        cien.addColorStop(0, `rgba(70,110,160,0)`); cien.addColorStop(.35, `rgba(70,110,160,${(.5*e).toFixed(3)})`);
        cien.addColorStop(.75, `rgba(55,90,140,${(.42*e).toFixed(3)})`); cien.addColorStop(1, `rgba(70,110,160,0)`);
        c.strokeStyle = cien; c.lineWidth = 26; c.filter = 'blur(6px)';
        c.beginPath(); c.moveTo(sx - 210, sy - 210); c.bezierCurveTo(sx - 260, sy - 60, sx - 200, sy + 40, sx - 40, sy + 150); c.stroke();
        c.filter = 'blur(1px)'; c.strokeStyle = `rgba(255,255,255,${(.45*e).toFixed(3)})`; c.lineWidth = 1.5;   // jasna krawędź lodu
        c.beginPath(); c.moveTo(sx - 196, sy - 212); c.bezierCurveTo(sx - 244, sy - 62, sx - 184, sy + 36, sx - 26, sy + 146); c.stroke();
        c.restore();
        // dwie postaci na linie, daleko od siebie, idą powoli w górę
        const u = smooth(p), x1 = sx - 120 + u*14, y1 = sy + 70 - u*24, x2 = sx + 10 + u*14, y2 = sy - 10 - u*24;
        c.strokeStyle = `rgba(250,252,255,${(.85*e).toFixed(3)})`; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2)/2, (y1 + y2)/2 + 26, x2, y2); c.stroke();
        for (const [x, y] of [[x1, y1], [x2, y2]]) {
          c.strokeStyle = `rgba(60,70,85,${(.35*e).toFixed(3)})`; c.lineWidth = 2.5;      // długi cień postaci
          c.beginPath(); c.moveTo(x, y + 3); c.lineTo(x + 16, y + 14); c.stroke();
          c.fillStyle = `rgba(30,34,40,${e.toFixed(3)})`; c.beginPath(); c.ellipse(x, y - 3, 2.6, 5, 0, 0, TAU); c.fill();
        }
      }},

    /* Kamienie (Mont Blanc, „usłyszeliśmy kamienie. Poleciały dokładnie tamtędy.”): przez kolumnę
       tekstu, dokładnie tam, gdzie przed chwilą była ścieżka, leci kilka kamieni i odbija się od półek. */
    kamienie: { dur: 4800,
      init(s){
        const col = colRect(), cx = col.left + col.width*(.35 + R()*.3);
        s.polki = [.38, .62, .82].map(f => H*f + (R()-.5)*30);
        s.k = Array.from({length: 9}, (_, i) => ({x: cx + (R()-.5)*50, y: -20 - R()*60, vx: (R()-.5)*1.4, vy: 0, od: 120 + i*170 + R()*120,
          r: 3 + R()*5, rot: R()*6, w: (R()-.5)*.3, hit: 0, ks: Array.from({length: 6}, () => .7 + R()*.5)}));
        s.pyl = []; s.cx = cx;
      },
      draw(c, s, p, t, dt, M){
        const ms = t - s.start, k = dt/16, e = env(p, .02, .12);
        let rum = 0;
        for (const st of s.k) {
          if (ms < st.od) continue;
          st.vy += .42*k; st.x += st.vx*k; st.y += st.vy*k; st.rot += st.w*k;
          for (const py of s.polki) if (st.hit < 3 && st.y > py && st.y - st.vy*k <= py) {
            st.y = py; st.vy = -Math.abs(st.vy)*.38; st.vx = (R()-.5)*4; st.hit++; rum = 1;
            for (let i = 0; i < 6; i++) s.pyl.push({x: st.x, y: py, vx: (R()-.5)*2.4, vy: -R()*1.6, age: 0, life: 500 + R()*500});
          }
          c.save(); c.translate(st.x, st.y); c.rotate(st.rot); c.beginPath();
          st.ks.forEach((q, i) => { const a = i/6*TAU; const X = Math.cos(a)*st.r*q, Y = Math.sin(a)*st.r*q; i ? c.lineTo(X, Y) : c.moveTo(X, Y); });
          c.closePath(); c.fillStyle = `rgba(150,146,140,${e.toFixed(3)})`; c.fill(); c.restore();
        }
        s.pyl = s.pyl.filter(d => { d.age += dt; const a = 1 - d.age/d.life; if (a <= 0) return false; d.x += d.vx*k; d.y += d.vy*k; d.vy += .03*k;
          const r = 2 + (1 - a)*8, g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
          g.addColorStop(0, `rgba(165,158,150,${(.3*a*e).toFixed(3)})`); g.addColorStop(1, 'rgba(165,158,150,0)'); c.fillStyle = g; c.fillRect(d.x - r, d.y - r, r*2, r*2); return true; });
        if (rum) s.rum = t;
        if (s.rum) { const d = t - s.rum; M.dx += 2.2*Math.exp(-d/110)*Math.sin(d/17); M.dy += 1.4*Math.exp(-d/110)*Math.cos(d/23); }
      }},

    /* Widmo Brockenu (Grossglockner): miękka tęczowa poświata w mgle, jak światło świetlików —
       bez obrysowanych kręgów, rozmycia tekstu i rysowanej postaci (wcześniejsza wersja wyszła
       „tragicznie”, autor 16.11). Pośrodku ledwie widoczny, rozmyty cień — widmo. */
    brocken: { dur: 6000,
      init(s){ const col = colRect(); s.cx = Math.min(W - 120, col.right - col.width*.18); s.cy = H*.4; },
      draw(c, s, p, t){
        const e = env(p, .3, .32), jasny = root.getAttribute('data-theme') === 'jasny';
        const R0 = Math.min(W, H)*.2*(1 + .03*Math.sin(t/900)), cx = s.cx + Math.sin(t/2300)*10, cy = s.cy + Math.cos(t/1900)*6;
        const a = (jasny ? .22 : .3)*e*(.85 + .15*Math.sin(t/700));
        // delikatna mgła wokół, żeby światło miało w czym świecić
        const mg = c.createRadialGradient(cx, cy, 0, cx, cy, R0*2.6);
        mg.addColorStop(0, rgba('--fog-rgb', .1*e)); mg.addColorStop(1, rgba('--fog-rgb', 0));
        c.fillStyle = mg; c.fillRect(cx - R0*2.6, cy - R0*2.6, R0*5.2, R0*5.2);
        c.globalCompositeOperation = jasny ? 'multiply' : 'lighter';
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, R0*1.6);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(.34, `hsla(200,85%,72%,0)`);
        g.addColorStop(.46, `hsla(200,85%,72%,${(a*.7).toFixed(3)})`);
        g.addColorStop(.56, `hsla(140,70%,66%,${(a*.6).toFixed(3)})`);
        g.addColorStop(.66, `hsla(50,95%,66%,${(a*.6).toFixed(3)})`);
        g.addColorStop(.77, `hsla(12,90%,62%,${(a*.7).toFixed(3)})`);
        g.addColorStop(.9, `hsla(290,60%,68%,${(a*.25).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(cx - R0*1.6, cy - R0*1.6, R0*3.2, R0*3.2);
        c.globalCompositeOperation = 'source-over';
        // widmo: miękki, wydłużony cień w środku kręgu
        c.save(); c.translate(cx, cy); c.scale(.55, 1.6);
        const w = c.createRadialGradient(0, R0*.18, 0, 0, R0*.18, R0*.4);
        w.addColorStop(0, `rgba(10,14,20,${((jasny ? .1 : .22)*e).toFixed(3)})`); w.addColorStop(1, 'rgba(10,14,20,0)');
        c.fillStyle = w; c.fillRect(-R0*.4, -R0*.3, R0*.8, R0*1);
        c.restore();
      }},

    /* Oszus (Everest): ktoś zgubił literę. Na chwilę pojawia się „t”, chwieje się i spada. */
    oszus: { dur: 3400,
      init(s){ s.html = s.btn.innerHTML; s.btn.innerHTML = s.html.replace(/Oszus/, 'Oszus<span class="os-t" aria-hidden="true">t</span>'); s.t = s.btn.querySelector('.os-t'); s.w0 = s.t ? s.t.offsetWidth : 0; },
      stop(s){ s.btn.innerHTML = s.html; },
      draw(c, s, p){
        if (!s.t) { s.done = true; return; }
        const pojaw = smooth(p/.18), chwiej = p > .3 && p < .5 ? Math.sin((p - .3)/.2*Math.PI*3)*12*(1 - (p - .3)/.2) : 0;
        const spad = smooth((p - .5)/.45);
        s.t.style.opacity = (pojaw*(1 - smooth((p - .8)/.2))).toFixed(2);
        s.t.style.width = (s.w0*(1 - spad)).toFixed(1) + 'px';      // po odpadnięciu kropka dosuwa się do „Oszus”
        s.t.style.transform = `translate(${(spad*6).toFixed(1)}px,${(spad*spad*70).toFixed(1)}px) rotate(${(chwiej + spad*80).toFixed(1)}deg)`;
      }},

    /* Ship it! (Rysy, konferencja): konfetti wystrzeliwuje ze słowa i smętnie opada. */
    shipit: { dur: 4200,
      init(s){
        const r = s.btn.getBoundingClientRect(), kol = [v('--accent') || '#c0392b', '#f2c94c', '#56ccf2', '#bb6bd9', '#6fcf97'];
        s.c = Array.from({length: 70}, () => { const a = -Math.PI/2 + (R()-.5)*1.6, sp = 5 + R()*7;
          return {x: r.left + r.width/2, y: r.top, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, kol: kol[Math.floor(R()*kol.length)], rot: R()*6, w: (R()-.5)*.4, ph: R()*6}; });
        hud('sala bije brawo');
      },
      draw(c, s, p, t, dt){
        const k = dt/16, e = env(p, .01, .2);
        for (const q of s.c) { q.vy = Math.min(q.vy + .22*k, 1.6); q.vx *= Math.pow(.96, k); q.x += (q.vx + Math.sin(t/300 + q.ph)*.5)*k; q.y += q.vy*k; q.rot += q.w*k;
          c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.globalAlpha = e; c.fillStyle = q.kol; c.fillRect(-4, -2, 8, 4); c.restore(); }
        c.globalAlpha = 1;
      }},

    /* ===== Propozycje z 2026-11-16, druga runda (pomysły Fable 5.2, wybrane przez autora) ===== */

    /* Czołówka (Babia Góra, „światło czołówek, które po kilku metrach grzęzło w gęstym śniegu”):
       strona tonie w bieli, czytelny zostaje tylko krąg światła wokół kursora albo palca.
       Bez ruchu krąg dryfuje sam. Czytelnik szuka tekstu tak, jak oni szukali kopca. */
    czolowka: { dur: 9000,
      init(s){
        const r = s.btn.getBoundingClientRect();
        s.x = r.left + r.width/2; s.y = r.top + r.height/2; s.tx = s.x; s.ty = s.y; s.ruch = 0;
        const v0 = document.createElement('div'); v0.className = 'czolowka'; v0.setAttribute('aria-hidden', 'true');
        const sw = document.createElement('div'); sw.className = 'czolowka-swiatlo'; sw.setAttribute('aria-hidden', 'true');
        document.body.append(v0, sw); s.v = v0; s.sw = sw;
        s.on = ev => { const q = ev.touches ? ev.touches[0] : ev; if (!q) return; s.tx = q.clientX; s.ty = q.clientY; s.ruch = performance.now(); };
        addEventListener('pointermove', s.on, {passive: true}); addEventListener('touchmove', s.on, {passive: true});
      },
      stop(s){ s.v.remove(); s.sw.remove(); removeEventListener('pointermove', s.on); removeEventListener('touchmove', s.on); },
      draw(c, s, p, t, dt){
        const e = env(p, .12, .14), k = Math.min(1, dt/16);
        if (t - s.ruch > 1400) { s.tx = W*.5 + Math.sin(t/1700)*W*.22; s.ty = H*.5 + Math.sin(t/1100)*H*.16; }   // krąg błądzi sam
        s.x += (s.tx - s.x)*.18*k; s.y += (s.ty - s.y)*.18*k;
        const rr = Math.min(W, H)*(.16 + .015*Math.sin(t/240));        // światło lekko pulsuje — oddech
        s.v.style.setProperty('--x', s.x.toFixed(0) + 'px'); s.v.style.setProperty('--y', s.y.toFixed(0) + 'px');
        s.v.style.setProperty('--r', rr.toFixed(0) + 'px'); s.v.style.opacity = e.toFixed(3);
        for (const k of ['--x', '--y', '--r']) s.sw.style.setProperty(k, s.v.style.getPropertyValue(k));
        s.sw.style.opacity = e.toFixed(3);
        // płatki: gęsto w świetle, jaśniejsze bliżej środka; poza kręgiem ich nie widać
        const jasny = root.getAttribute('data-theme') === 'jasny';
        for (let i = 0; i < 46; i++) { const a = (i*2.399 + t/1300) % TAU, d = ((i*29 + t*.07) % (rr*1.05));
          const x = s.x + Math.cos(a)*d + Math.sin(t/300 + i)*3, y = s.y + Math.sin(a)*d*.75 + ((t*.05 + i*17) % 40) - 20;
          const al = e*(1 - d/(rr*1.05))*.9;
          c.strokeStyle = jasny ? `rgba(120,135,155,${al.toFixed(3)})` : `rgba(255,250,240,${al.toFixed(3)})`; c.lineWidth = 1.3;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y + 3.5); c.stroke(); }
      }},

    /* Ruch (Mnich, paraliż — „Strach każe kurczowo ściskać chwyt.”): pod akapitem pojawia się
       „Zrób ruch”. Z każdą sekundą wahania akapit blednie i drży jak puchnące przedramiona.
       Kto kliknie, wraca do tekstu szarpnięciem. Kto czeka za długo, zostaje mu tylko zdanie
       z tego samego akapitu: „stanie w miejscu też jest decyzją”. */
    ruch: { dur: 9000,
      // Przycisk unosi się NAD akapitem i drży coraz mocniej — jak ręka, która traci siłę;
      // trudno w niego trafić. W środku odliczanie 6 → 1, a wypełnienie spływa z góry na dół
      // jak siła w przedramionach (autor, 16.11).
      init(s){
        const tg = s.target, mr = main.getBoundingClientRect(), r = tg.getBoundingClientRect();
        s.box = document.createElement('div'); s.box.className = 'ruch-pole';
        s.box.innerHTML = '<button type="button" class="ruch-btn"><span class="ruch-napis">Zrób ruch</span><b class="ruch-czas" aria-live="polite">6</b></button>';
        s.cx = r.left - mr.left + r.width/2; s.cy = r.top - mr.top + r.height/2;
        Object.assign(s.box.style, {left: s.cx + 'px', top: s.cy + 'px'});
        main.append(s.box); s.btnR = s.box.querySelector('.ruch-btn'); s.czas = s.box.querySelector('.ruch-czas');
        s.maxX = Math.max(10, Math.min(r.width/2 - 90, 140)); s.maxY = Math.max(10, Math.min(r.height/2 - 20, 70));
        s.btnR.addEventListener('click', () => { if (s.zrobil || s.zgaslo) return; s.zrobil = performance.now(); s.box.classList.add('zrobione'); s.czas.textContent = '✓'; });
        // zdanie, które zostaje na końcu, gdy nikt nie kliknie
        s.html = tg.innerHTML;
        // zostaje „Wtedy stanie w miejscu też jest decyzją. Często najgorszą” — druga część na czerwono (autor, 16.11)
        tg.innerHTML = tg.innerHTML.replace(/(Wtedy stanie w(?:\s|&nbsp;| )miejscu też jest decyzją\.)(\s+)(Często najgorszą)/,
          '<span class="ruch-zdanie">$1</span>$2<span class="ruch-zdanie ruch-czerwone">$3</span>');
      },
      stop(s){ s.box.remove(); s.target.innerHTML = s.html; s.target.style.opacity = ''; s.target.style.filter = ''; s.target.style.transform = ''; s.target.classList.remove('ruch-cisza'); },
      draw(c, s, p, t){
        const ms = t - s.start, tg = s.target;
        if (s.zrobil) {                                                  // ruch zrobiony: szarpnięcie i powrót
          const d = t - s.zrobil; tg.style.opacity = ''; tg.style.filter = '';
          tg.style.transform = `translateY(${(-6*Math.exp(-d/120)*Math.cos(d/30)).toFixed(2)}px)`;
          s.box.style.opacity = Math.max(0, 1 - d/700).toFixed(2);
          if (d > 1600) s.done = true; return;
        }
        const w = Math.min(1, ms/6000);
        if (ms < 6000) {
          s.czas.textContent = String(6 - Math.floor(ms/1000));
          s.btnR.style.setProperty('--sila', (100*(1 - w)).toFixed(1) + '%');
          // dryf i drżenie rosną z czasem: wolne kołysanie + szybkie drgania
          const dx = (Math.sin(t/430) + .6*Math.sin(t/170))*s.maxX*(.25 + .75*w) + (R()-.5)*6*w;
          const dy = (Math.cos(t/510) + .5*Math.sin(t/210))*s.maxY*(.25 + .75*w) + (R()-.5)*5*w;
          s.box.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) rotate(${(Math.sin(t/260)*4*w).toFixed(2)}deg)`;
          tg.style.opacity = (1 - .72*w).toFixed(3); tg.style.filter = `blur(${(1.6*w*w).toFixed(2)}px)`;
          const a = 1.4*w*w; tg.style.transform = `translate(${((R()-.5)*a).toFixed(2)}px,${((R()-.5)*a).toFixed(2)}px)`;
        } else {                                                          // za długo: zostaje jedno zdanie
          if (!s.zgaslo) { s.zgaslo = true; s.box.classList.add('zgaslo'); s.czas.textContent = '0'; s.btnR.style.setProperty('--sila', '0%'); }
          s.box.style.opacity = Math.max(0, 1 - (ms - 6000)/600).toFixed(2);
          tg.style.transform = ''; tg.style.filter = ''; tg.style.opacity = '1';
          tg.classList.add('ruch-cisza');
          if (ms > 8600) tg.classList.remove('ruch-cisza');
        }
      }},

    /* Poza kadrem (Everest, Podragu — „Z tyłu, poza kadrem, wszystko, czego nikt nie zniósł
       na dół.”): wokół akapitu celownik, ładny kadr. Poza nim, na marginesach, wychodzą z tła
       porzucone napisy: dokumenty ze „Slopowiska” kilka akapitów wyżej. Kadr zostaje czysty. */
    kadr: { dur: 6200,
      init(s){
        const tg = s.target, mr = main.getBoundingClientRect(), r = tg.getBoundingClientRect();
        const smieci = ['Polityka użycia AI', 'Matryca odpowiedzialności', 'Karta oceny ryzyka', 'standardy_promptowania_v3_FINAL.pdf',
          'makieta_47.fig', 'podsumowanie spotkania (wygenerowane)', 'Rejestr przypadków użycia', 'Wytyczne dla zespołów', 'makieta_48_v2.fig',
          'raport_badan_kopia(3).docx', 'Standardy promptowania', 'roadmapa_Q3_nowa_NOWA.pptx', 'transkrypcja_auto.txt', 'persona_07.png'];
        const lay = document.createElement('div'); lay.className = 'kadr-smieci'; lay.setAttribute('aria-hidden', 'true');
        const waski = r.left - mr.left < 150;                            // telefon: brak marginesów — nad i pod akapitem
        smieci.forEach((txt, i) => { const el = document.createElement('span'); el.textContent = txt;
          const lewa = i % 2 === 0, rz = Math.floor(i/2);
          let x, y;
          if (waski) { x = (r.left - mr.left) + (R()*.7)*r.width; y = (r.top - mr.top) + (i % 2 ? r.height + 18 + rz*15 : -24 - rz*15); }
          else { x = lewa ? (r.left - mr.left) - 40 - R()*Math.min(260, r.left - mr.left - 60) : (r.right - mr.left) + 40 + R()*120;
                 y = (r.top - mr.top) - 30 + rz*((r.height + 60)/7) + (R()-.5)*14; }
          el.style.cssText = `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;transform:rotate(${((R()-.5)*14).toFixed(1)}deg);`
            + `font-size:${(10 + R()*4).toFixed(1)}px;--o:${(.35 + R()*.35).toFixed(2)};transition-delay:${(.5 + i*.09).toFixed(2)}s`;
          if (lewa && !waski) el.style.transform += ' translateX(-100%)';
          lay.append(el); });
        main.append(lay); s.lay = lay; s.r = () => tg.getBoundingClientRect();
        requestAnimationFrame(() => lay.classList.add('widac'));
      },
      stop(s){ s.lay.remove(); },
      draw(c, s, p, t){
        const e = env(p, .06, .14), r = s.r(), m = 14, L = 28;
        if (p > .82 && !s.zanik) { s.zanik = true; s.lay.classList.remove('widac'); }
        c.strokeStyle = `rgba(${v('--fg-rgb')},${(.8*e).toFixed(3)})`; c.lineWidth = 1.5; c.beginPath();
        [[r.left - m, r.top - m, 1, 1], [r.right + m, r.top - m, -1, 1], [r.left - m, r.bottom + m, 1, -1], [r.right + m, r.bottom + m, -1, -1]]
          .forEach(([x, y, sx, sy]) => { c.moveTo(x, y + sy*L); c.lineTo(x, y); c.lineTo(x + sx*L, y); });
        c.stroke();
      }},

    cyk: { dur: 1500, lastFlash: -1e9,
      init(s){ s.flash = s.start - this.lastFlash > 1200; if (s.flash) this.lastFlash = s.start; },
      draw(c, s, p, t, dt, M){
        const ms = p*1500, fg = v('--fg-rgb');
        if (ms < 330) {
          const a = smooth(ms/110), m = 28, L = 34;
          c.strokeStyle = `rgba(${fg},${(.85*a).toFixed(3)})`; c.lineWidth = 2; c.beginPath();
          [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]].forEach(([x,y,sx,sy]) => { c.moveTo(x,y+sy*L); c.lineTo(x,y); c.lineTo(x+sx*L,y); });
          c.moveTo(W/2-10,H/2); c.lineTo(W/2+10,H/2); c.moveTo(W/2,H/2-10); c.lineTo(W/2,H/2+10); c.stroke();
        }
        let q = 0;
        if (ms >= 230 && ms < 300) q = (ms-230)/70; else if (ms >= 300 && ms < 330) q = 1; else if (ms >= 330 && ms < 480) q = 1 - (ms-330)/150;
        if (q > 0) { const h = smooth(q)*H/2; c.fillStyle = 'rgba(0,0,0,.95)'; c.fillRect(0,0,W,h); c.fillRect(0,H-h,W,h); }
        if (ms >= 300 && !s.counted) { s.counted = true; tick(s.btn); }
        if (s.flash && ms >= 330 && ms < 700) {
          const f = Math.exp(-(ms-330)/110), light = root.getAttribute('data-theme') === 'jasny';
          const g = c.createRadialGradient(W/2, H*.42, 0, W/2, H*.42, Math.max(W,H)*.75);
          g.addColorStop(0, `rgba(255,248,236,${((light ? .3 : .38)*f).toFixed(3)})`); g.addColorStop(1, `rgba(255,248,236,${((light ? .12 : .16)*f).toFixed(3)})`);
          c.fillStyle = g; c.fillRect(0,0,W,H);
        }
        if (ms >= 330) {
          const back = smooth((ms-1050)/420);
          M.sat *= back; M.bright *= 1 + .1*(1-back);
          c.strokeStyle = `rgba(${fg},${(.55*(1-back)).toFixed(3)})`; c.lineWidth = 1; c.strokeRect(14.5,14.5,W-29,H-29);
        }
      }},
  };

  function valueNoise(){
    const perm = new Uint16Array(512), rnd = new Float32Array(256), base = [...Array(256).keys()];
    for (let i=255;i>0;i--) { const j = Math.floor(R()*(i+1)); [base[i],base[j]] = [base[j],base[i]]; }
    for (let i=0;i<512;i++) perm[i] = base[i & 255];
    for (let i=0;i<256;i++) rnd[i] = R();
    const val = (x,y) => rnd[perm[(x & 255) + perm[y & 255]]];
    return (x,y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x-ix, fy = y-iy, u = fx*fx*(3-2*fx), w = fy*fy*(3-2*fy);
      const a = val(ix,iy), b = val(ix+1,iy), c = val(ix,iy+1), d = val(ix+1,iy+1);
      return a + (b-a)*u + (c-a)*w + (a-b-c+d)*u*w; };
  }

  function splitText(root, mode){
    const nodes = [], tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    const units = [], pairs = [];
    for (const node of nodes) {
      const wrap = document.createElement('span');
      for (const part of node.nodeValue.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { wrap.append(document.createTextNode(part)); continue; }
        const w = document.createElement('span'); w.style.display = 'inline-block'; w.style.whiteSpace = 'nowrap';
        if (mode === 'char') { for (const ch of part) { const cs = document.createElement('span'); cs.style.display = 'inline-block'; cs.textContent = ch; w.append(cs); units.push(cs); } }
        else { w.textContent = part; units.push(w); }
        wrap.append(w);
      }
      node.replaceWith(wrap); pairs.push([wrap, node]);
    }
    return {units, restore(){ pairs.forEach(([w, nd]) => w.replaceWith(nd)); }};
  }

  // Czołówka: snop, poświata, ślad i jasny punkt — ten sam rysunek co w roju z Gran Paradiso
  function czolowka(c, x, y, ang, a, slad){
    c.save(); c.translate(x, y); c.rotate(ang);
    const bg = c.createLinearGradient(0, 0, 110, 0);
    bg.addColorStop(0, rgba('--glow-rgb', .22*a)); bg.addColorStop(1, rgba('--glow-rgb', 0));
    c.fillStyle = bg; c.beginPath(); c.moveTo(0, 0); c.lineTo(110, -30); c.lineTo(110, 30); c.closePath(); c.fill();
    c.restore();
    if (slad) slad.forEach(([tx, ty], i) => { c.fillStyle = rgba('--glow-rgb', .25*a*i/slad.length); c.beginPath(); c.arc(tx, ty, 1.1, 0, TAU); c.fill(); });
    const g = c.createRadialGradient(x, y, 0, x, y, 26);
    g.addColorStop(0, rgba('--glow-rgb', .5*a)); g.addColorStop(1, rgba('--glow-rgb', 0));
    c.fillStyle = g; c.fillRect(x - 26, y - 26, 52, 52);
    c.fillStyle = `rgba(255,250,236,${clamp(a,0,1).toFixed(3)})`; c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill();
  }

  let _tex = null;
  function snowTexture(){
    if (_tex) return _tex;
    const t = document.createElement('canvas'); t.width = t.height = 256; const g = t.getContext('2d');
    for (let i=0;i<900;i++) { g.fillStyle = `rgba(120,140,175,${(.04+R()*.14).toFixed(3)})`; g.beginPath(); g.arc(R()*256,R()*256,.4+R()*1.6,0,TAU); g.fill(); }
    for (let i=0;i<50;i++) { g.strokeStyle = `rgba(140,160,190,${(.05+R()*.07).toFixed(3)})`; g.lineWidth = .7; const x = R()*256, y = R()*256;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+(R()-.5)*5, y+10+R()*20); g.stroke(); }
    for (let i=0;i<140;i++) { g.fillStyle = `rgba(255,255,255,${(.5+R()*.5).toFixed(3)})`; g.fillRect(R()*256,R()*256,1,1); }
    return _tex = t;
  }

  function bottle(c, x, y, rot, sc, alpha){
    if (alpha <= 0) return;
    c.save(); c.globalAlpha = alpha; c.translate(x,y); c.rotate(rot); c.scale(sc*1.5, sc*1.5);
    const pink = v('--pink'), body = c.createLinearGradient(-8,0,8,0);
    body.addColorStop(0,'#9e2b5f'); body.addColorStop(.3,pink); body.addColorStop(.5,'#ffb3d3'); body.addColorStop(.72,pink); body.addColorStop(1,'#8a2453');
    c.fillStyle = body; c.beginPath(); c.roundRect ? c.roundRect(-8,-20,16,40,6) : c.rect(-8,-20,16,40); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-8,5,16,3);
    const cap = c.createLinearGradient(-5,0,5,0);
    cap.addColorStop(0,'#5d5d61'); cap.addColorStop(.45,'#dcdce0'); cap.addColorStop(1,'#636367');
    c.fillStyle = cap; c.beginPath(); c.roundRect ? c.roundRect(-5,-28,10,9,2) : c.rect(-5,-28,10,9); c.fill();
    c.strokeStyle = '#b9b9be'; c.lineWidth = 1.5; c.beginPath(); c.arc(0,-31.5,3.4,0,TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(-4.6,-16,2,31);
    c.restore();
  }

  /* ================= silnik ================= */
  const active = new Map();
  let raf = 0, last = 0, frames = 0;
  const film = document.getElementById('film'); let filmTimer = 0;
  function hud(text){ film.textContent = text; film.classList.add('show');
    clearTimeout(filmTimer); filmTimer = setTimeout(() => film.classList.remove('show'), 1800); }
  const KLATEK = document.querySelectorAll('[data-fx="cyk"]').length || 1;
  // Klisza liczy RÓŻNE zdjęcia: każde „Cyk” w tekście to jedna klatka (jest ich tyle, ile zapalników
  // Cyk na stronie — dziś 10). Ponowne kliknięcie tego samego „Cyk” nie przewija kliszy dalej.
  const klatki = new Set();
  function tick(btn){ if (btn) klatki.add(btn); frames = Math.min(KLATEK, klatki.size);
    hud(`klisza ${frames}/${KLATEK}`); }
  const fresh = () => ({cold:0, coldVar:'', noc:0, scale:1, blur:0, op:1, dx:0, dy:0, skew:0, bright:1, sat:1, shadow:[], tunnel:null, frost:null});
  // kolor z tokenu: „#rrggbb” albo „rgb(r, g, b)” (ten drugi, gdy paleta nocna już go nadpisała)
  const hex = h => { h = h.trim();
    if (h[0] === '#') { h = h.slice(1); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); }
    return (h.match(/[\d.]+/g) || [0,0,0]).slice(0,3).map(Number); };

  // Paleta nocna: sceny nocne (świetliki, burza) w jasnym motywie pożyczają na swój czas
  // ciemne kolory strony — tło, tekst i linie przechodzą płynnie w noc i z powrotem.
  // Bez tego jasna strona tylko szarzała, a światła były matowymi plamami (przegląd 2026-11-15).
  const NOC = {'--bg':[22,25,28], '--text':[211,216,220], '--text-strong':[242,245,247], '--text-quiet':[166,174,181],
               '--rule':[69,75,81], '--nav-quiet':[69,73,78], '--dot':[90,97,104]};
  let dzien = null;
  function noc(m){
    if (root.getAttribute('data-theme') !== 'jasny' || m < .004) {
      if (dzien) { for (const kl in NOC) root.style.removeProperty(kl); dzien = null; }
      return;
    }
    if (!dzien) { dzien = {}; for (const kl in NOC) dzien[kl] = hex(v(kl)); }
    const u = smooth(m);
    for (const kl in NOC) root.style.setProperty(kl,
      `rgb(${dzien[kl].map((x,i) => Math.round(x + (NOC[kl][i]-x)*u)).join(',')})`);
  }
  function apply(M){
    noc(M.noc);
    if (M.cold > .002) { const a = hex(v('--bg')), b = hex(v(M.coldVar || '--cold')), m = clamp(M.cold,0,1);
      const col = `rgb(${a.map((x,i) => Math.round(x + (b[i]-x)*m)).join(',')})`;
      root.style.backgroundColor = col; document.body.style.backgroundColor = col; }
    else { root.style.backgroundColor = ''; document.body.style.backgroundColor = ''; }
    const f = [];
    if (M.blur > .02) f.push(`blur(${M.blur.toFixed(2)}px)`);
    if (Math.abs(M.bright-1) > .002) f.push(`brightness(${M.bright.toFixed(3)})`);
    if (Math.abs(M.sat-1) > .002) f.push(`saturate(${M.sat.toFixed(3)})`);
    main.style.filter = f.join(' ');
    main.style.transform = (Math.abs(M.dx) > .05 || Math.abs(M.dy) > .05 || Math.abs(M.skew) > .01 || Math.abs(M.scale - 1) > .001)
      ? `translate(${M.dx.toFixed(2)}px,${M.dy.toFixed(2)}px) skewX(${M.skew.toFixed(3)}deg)${Math.abs(M.scale - 1) > .001 ? ` scale(${M.scale.toFixed(4)})` : ''}` : '';
    main.style.opacity = M.op < .998 ? M.op.toFixed(3) : '';
    main.style.textShadow = M.shadow.join(',');
    main.style.willChange = active.size ? 'filter, transform' : '';
    // Przesunięty tekst wystawał pod koniec strony, więc jej wysokość zmieniała się co klatkę
    // i suwak przewijania migał. Rama (element <main>) przycina to, co wystaje (w pionie i w poziomie).
    if (rama) rama.style.overflow = active.size ? 'clip' : '';
    if (M.tunnel) { const T = M.tunnel; tunnel.style.opacity = '1';
      tunnel.style.setProperty('--r1', T.r1.toFixed(1)+'%'); tunnel.style.setProperty('--r2', T.r2.toFixed(1)+'%');
      tunnel.style.setProperty('--b', T.b.toFixed(2)+'px'); tunnel.style.setProperty('--a', T.a.toFixed(3)); }
    else tunnel.style.opacity = '0';
    if (M.frost) { const F = M.frost; frostV.style.opacity = '1';
      frostV.style.setProperty('--fe', F.fe.toFixed(0)+'px'); frostV.style.setProperty('--fr', F.fr.toFixed(0)+'px'); frostV.style.setProperty('--fb', F.fb.toFixed(2)+'px'); frostV.style.setProperty('--fa', F.fa.toFixed(3)); }
    else frostV.style.opacity = '0';
  }

  // Czy efekty są włączone, decyduje strona (przełącznik w stopce + ograniczenie ruchu).
  let enabled = true;

  function clearAll(){ bctx.clearRect(0,0,W,H); fctx.clearRect(0,0,W,H); apply(fresh()); }
  function stop(name){
    const s = active.get(name); if (!s) return;
    active.delete(name); s.btn.setAttribute('aria-pressed','false');
    const def = FX[name]; def.stop && def.stop(s);
  }
  function start(name, btn){
    const def = FX[name];
    const s = {btn, start: performance.now(), target: btn.dataset.target ? document.getElementById(btn.dataset.target) : btn.closest('p')};
    def.init && def.init(s);
    active.set(name, s); btn.setAttribute('aria-pressed','true');
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function loop(now){
    const dt = Math.min(48, now - last); last = now;
    bctx.clearRect(0,0,W,H); fctx.clearRect(0,0,W,H);
    const M = fresh();
    for (const [name, s] of [...active]) {
      const def = FX[name], p = (now - s.start)/(s.dur || def.dur);
      if (p >= 1 || s.done) { stop(name); continue; }
      fctx.save(); bctx.save();
      def.draw.call(def, fctx, s, p, now, dt, M, bctx);
      fctx.restore(); bctx.restore();
      if (s.done) stop(name);
    }
    apply(M);
    if (active.size) raf = requestAnimationFrame(loop); else { clearAll(); raf = 0; }
  }
  /* ---------- Klik: szkielet ładowania zamiast treści ----------
     Kliknięcie zabiera tekst i zostawia migoczące prostokąty w miejscach słów — to, co
     widać, zanim model skończy „generować”. Nic nie jest dopisywane do treści i nic nie
     zmienia układu strony: bloki leżą absolutnie nad tekstem, a sam tekst tylko znika. */
  let klikCount = 0, klikLast = 0, klikLevel = 0;
  let klikRun = null;        // {warstwa, cele, timer}

  // Prostokąty pojedynczych słów — przez Range, więc łamanie wierszy liczy się samo
  function wordRects(el, baza){
    const out = [], spacer = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = spacer.nextNode())) {
      const txt = node.nodeValue;
      if (!txt.trim()) continue;
      for (const m of txt.matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(node, m.index);
        r.setEnd(node, m.index + m[0].length);
        for (const box of r.getClientRects()) {
          if (box.width < 1 || box.height < 1) continue;
          out.push({x: box.left - baza.left, y: box.top - baza.top, w: box.width, h: box.height});
        }
      }
    }
    return out;
  }

  function clearKlik(){
    if (!klikRun) return;
    clearTimeout(klikRun.timer);
    klikRun.warstwa.remove();
    klikRun.cele.forEach(el => el.classList.remove('is-loading'));
    klikRun = null;
  }

  function klik(btn, ev){
    const teraz = performance.now();
    klikLevel = teraz - klikLast < 2200 ? Math.min(5, klikLevel + 1) : 1;
    klikLast = teraz;
    clearKlik();                                   // nowe kliknięcie kończy poprzednie

    const akapit = document.getElementById(btn.dataset.target) || btn.closest('p');
    const sekcja = akapit.closest('section') || akapit.parentElement;
    // od poziomu 3 szkielet zabiera cały rozdział, bez metryki i odliczania
    // Od poziomu 3 szkielet zabiera cały rozdział — ale bloki stawiamy tylko dla akapitów,
    // które widać (plus ekran zapasu). Rozdział potrafi mieć kilkaset słów na ekran i kilka
    // tysięcy w całości; niewidocznych i tak nikt nie zobaczy, a każdy blok to animacja.
    const widoczny = el => {
      const r = el.getBoundingClientRect();
      return r.bottom > -H * .5 && r.top < H * 1.5;
    };
    const cele = klikLevel >= 3
      ? [...sekcja.querySelectorAll('p')].filter(el => !el.closest('.footnotes')
          && !el.classList.contains('chapter-meta') && !el.classList.contains('chapter-end')
          && widoczny(el))
      : [akapit];

    const baza = main.getBoundingClientRect();
    const warstwa = document.createElement('div');
    warstwa.className = 'skel-layer';
    warstwa.setAttribute('aria-hidden', 'true');
    main.append(warstwa);

    for (const el of cele) {
      for (const r of wordRects(el, baza)) {
        const blok = document.createElement('span');
        blok.className = 'skel';
        blok.style.cssText = `left:${r.x.toFixed(1)}px;top:${(r.y + r.h*.28).toFixed(1)}px;`
          + `width:${r.w.toFixed(1)}px;height:${(r.h*.5).toFixed(1)}px;`
          + `animation-delay:${(-(r.x + r.y) % 900)}ms`;
        warstwa.append(blok);
      }
      el.classList.add('is-loading');
    }

    // pierścień w miejscu kliknięcia
    const pkt = btn.getBoundingClientRect();
    const krag = document.createElement('span');
    krag.className = 'ripple';
    krag.style.left = ((ev && ev.clientX ? ev.clientX : pkt.left + pkt.width/2) - baza.left) + 'px';
    krag.style.top = ((ev && ev.clientY ? ev.clientY : pkt.top + pkt.height/2) - baza.top) + 'px';
    warstwa.append(krag);

    klikCount++;
    hud(`wygenerowano ${klikCount}`);
    klikRun = {warstwa, cele, timer: 0};
    klikRun.timer = setTimeout(clearKlik, 450 + 320*klikLevel);
  }

  /* ---------- Długo: rozmowa z dzieckiem ----------
     Kliknięcie od razu zaczyna rozmowę — rozciągane „długooo???” wypadło, skoro jest ten
     efekt (autor, 2026-11-15). Pod akapitem z „czy długo jeszcze?” pojawiają się dymki jak w komunikatorze: dziecko
     (avatar z makiety Pilska) marudzi i pyta, tata odpowiada krótko. Ostatnie pytanie
     („Czy góry czują łaskotki…”, autor) zostaje bez odpowiedzi. „Jeszcze kawałek.” wraca na końcu rozdziału 11.
     Inaczej niż w „Enter”: bez ramki i etykiet, pismo tekstu — tam gadają modele, tu ludzie. */
  const CZAT_DZIECKA = [
    ['d', 'Czy długo jeszcze?', 200],
    ['t', 'Jeszcze kawałek.', 1100],
    ['d', 'Nogi mnie bolą.', 1300],
    ['d', 'A teraz? Długo jeszcze?', 1500],
    ['t', 'Jeszcze kawałek.', 1100],
    ['d', 'Czy góry czują łaskotki, kiedy po nich chodzimy?', 1700],
    ['t', '…', 1500],
  ];
  let czatRun = null;
  function stopCzat(){ if (!czatRun) return; czatRun.timers.forEach(clearTimeout); czatRun.box.remove();
    czatRun.btn.setAttribute('aria-pressed', 'false'); czatRun = null; }
  function czatDziecka(btn){
    if (czatRun) { stopCzat(); return; }            // drugie kliknięcie przerywa
    const tg = btn.closest('p'); if (!tg) return;
    btn.setAttribute('aria-pressed', 'true');
    const box = document.createElement('div'); box.className = 'czat-dziecka';
    box.setAttribute('role', 'log'); box.setAttribute('aria-label', 'Rozmowa dziecka z tatą');
    tg.after(box);
    const run = czatRun = {box, btn, timers: []}, at = (ms, fn) => run.timers.push(setTimeout(fn, ms));
    let tm = 0, poprzedni = '';
    for (const [kto, tekst, przerwa] of CZAT_DZIECKA) {
      tm += przerwa; const ciag = kto === poprzedni; poprzedni = kto;
      at(tm, () => {
        const m = document.createElement('div'); m.className = 'dymek ' + (kto === 'd' ? 'dziecko' : 'tata') + (ciag ? ' ciag' : '');
        // avatary obu stron, wycięte z makiety Pilska: dziecko w czerwonej kurtce i tata obok (autor, 16.11)
        const im = document.createElement('img'); im.src = BAZA + `assets/web/${kto === 'd' ? 'dziecko' : 'tata'}-132.webp`;
        im.alt = ''; im.width = 36; im.height = 36; m.append(im);
        const sp = document.createElement('span');
        if (tekst === '…') { sp.className = 'pisze'; sp.setAttribute('aria-label', 'tata pisze'); sp.innerHTML = '<i></i><i></i><i></i>'; } else sp.textContent = tekst;
        m.append(sp); box.append(m);
      });
    }
    at(tm + 2800, () => { box.style.maxHeight = box.offsetHeight + 'px'; box.style.opacity = '0';
      requestAnimationFrame(() => { box.style.maxHeight = '0px'; box.style.marginBlock = '0px'; }); });
    at(tm + 3700, stopCzat);
  }

  /* ---------- Test na człowieka (Rysy, „Może powinienem zrobić test?”) ----------
     Pod akapitem pojawia się okienko „Jestem człowiekiem”. Czytelnik może kliknąć sam —
     jeśli nie kliknie, test robi się sam. Wynik zawsze negatywny; kolejne powody są
     z tekstu („Unikają myślników. Celowo robią nierówne akapity.”). */
  // Jedna próba, wszystko w jednym wierszu (autor, 2026-11-16): w miejscu pola wyboru kręci się
  // kółko, potem krzyżyk, a „Jestem człowiekiem” zmienia się na czerwone „Ups. Nie jestem.”
  let testRun = null;
  function stopTest(){ if (!testRun) return; testRun.timers.forEach(clearTimeout); testRun.box.remove();
    testRun.btn.setAttribute('aria-pressed', 'false'); testRun = null; }
  function testCzlowieka(btn){
    if (testRun) { stopTest(); return; }
    const tg = btn.closest('p'); if (!tg) return;
    const box = document.createElement('div'); box.className = 'test-czlowieka';
    // Znak „usługi” po prawej jest wymyślony (góra w tarczy) — nie udaje żadnej prawdziwej firmy.
    box.innerHTML = '<button type="button" class="tc-pole" aria-label="Jestem człowiekiem — zaznacz"></button>'
      + '<span class="tc-napis" aria-live="polite">Jestem człowiekiem</span>'
      + '<div class="tc-marka" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>'
      + '<path class="tc-gora" d="m7.5 15 3-4.5 2 2.5 1.5-2 2.5 4z"/></svg><b>weryfikacja</b><small>Prywatność · Warunki</small></div>';
    tg.after(box); btn.setAttribute('aria-pressed', 'true');
    const pole = box.querySelector('.tc-pole'), napis = box.querySelector('.tc-napis');
    const run = testRun = {box, btn, timers: []}, at = (ms, fn) => run.timers.push(setTimeout(fn, ms));
    let zaczete = false;
    const sprawdz = () => {
      if (zaczete) return; zaczete = true;
      pole.className = 'tc-pole krec'; pole.disabled = true;
      at(1600, () => {
        pole.className = 'tc-pole zle'; napis.textContent = 'Ups. Nie jestem.'; napis.classList.add('zle');
        at(3600, () => { box.style.opacity = '0'; at(650, stopTest); });
      });
    };
    pole.addEventListener('click', sprawdz);
    at(2400, sprawdz);                                   // nikt nie kliknął: test robi się sam
  }

  /* ---------- Enter: model rozmawia z modelem ---------- */
  // Rozmowa z kontekstu rozdziału (Gran Paradiso, „Wypolerowany czekan”, 16.11.2026):
  // wygenerowane ogłoszenie i odpowiedzi, wymóg „biegłości w AI”, filtr, który za to samo CV
  // daje dwie różne oceny, zamyślenie jako podejrzenie, wygenerowana kawa i wygenerowane
  // podziękowanie — a na końcu „Masz absolutną rację”. Przy przyspieszeniu rozmowa się zapętla.
  const CHAT = [
    ['a','Rekruter (model)','Dziękujemy za aplikację! Twój profil idealnie pasuje do naszych wartości.'],
    ['b','Kandydat (model)','Dziękuję! Jestem pasjonatem tworzenia wartości i ciągłego rozwoju.'],
    ['a','Rekruter (model)','Wymagamy biegłości w pracy z AI. Opisz swoje doświadczenie.'],
    ['b','Kandydat (model)','Na co dzień biegle współpracuję z AI, co pozwala mi dowozić szybciej.'],
    ['c','Filtr CV (model)','Dopasowanie: 87/100.'],
    ['a','Rekruter (model)','Czy zdarza Ci się odrywać wzrok od ekranu podczas rozmowy?'],
    ['b','Kandydat (model)','Nigdy. Patrzę wyłącznie w kamerę.'],
    ['a','Rekruter (model)','Doskonale. Zamyślenie budzi nasze wątpliwości.'],
    ['c','Filtr CV (model)','To samo CV. Dopasowanie: 41/100.'],
    ['a','Rekruter (model)','Zapraszamy na kawę z naszym asystentem.'],
    ['a','Asystent (model)','Kawa gotowa. Opowiedz o swoich mocnych stronach.'],
    ['b','Kandydat (model)','Moją mocną stroną jest komunikacja i praca zespołowa.'],
    ['a','Rekruter (model)','Dziękujemy! Zdecydowaliśmy się kontynuować z innymi kandydatami.'],
    ['b','Kandydat (model)','Dziękuję za cenną informację zwrotną. Masz absolutną rację.'],
  ];
  let enterRun = null;
  function stopEnter(){ if (!enterRun) return; enterRun.timers.forEach(clearTimeout); enterRun.box.remove(); enterRun.btn.setAttribute('aria-pressed','false'); enterRun = null; }
  /* ---------- Enter na końcu fragmentu: „Masz absolutną rację.” generuje się ----------
     „Może zabrakło testu na człowieczeństwo? Klik. Enter. Masz absolutną rację.” — drugie Enter
     nie otwiera rozmowy, tylko wysyła prompt: odpowiedź znika i wraca tak, jak pisze model —
     kropki „pisze…”, potem tekst kawałkami z kursorem, na końcu przebiega po nim połysk.
     Bez kliknięcia zdanie stoi w tekście normalnie (autor, 2026-11-16). */
  let odpRun = null;
  function stopOdp(){ if (!odpRun) return; odpRun.timers.forEach(clearTimeout); odpRun.em.innerHTML = odpRun.html;
    odpRun.em.classList.remove('gen', 'gen-blysk'); odpRun.btn.setAttribute('aria-pressed', 'false'); odpRun = null; }
  function odpowiedzModelu(btn, em){
    if (odpRun) { stopOdp(); return; }
    const run = odpRun = {btn, em, html: em.innerHTML, timers: []}, at = (ms, fn) => run.timers.push(setTimeout(fn, ms));
    const tekst = em.textContent; btn.setAttribute('aria-pressed', 'true');
    em.classList.add('gen'); em.innerHTML = '<span class="gen-kropki" aria-hidden="true"><i></i><i></i><i></i></span>';
    let tm = 900, i = 0;
    const krok = () => { const ile = 1 + Math.floor(R()*3); i = Math.min(tekst.length, i + ile);
      em.innerHTML = ''; em.append(tekst.slice(0, i)); const k = document.createElement('span'); k.className = 'gen-kursor'; k.setAttribute('aria-hidden', 'true'); em.append(k); };
    while (i < tekst.length) { const t0 = tm; at(t0, krok); tm += 45 + R()*90; i += 2; }
    i = 0;
    at(tm + 80, () => { em.textContent = tekst; em.classList.add('gen-blysk'); });
    at(tm + 1500, stopOdp);
  }

  function enter(btn){
    if (enterRun) { stopEnter(); return; }
    const tg = document.getElementById(btn.dataset.target) || btn.closest('p');
    const box = document.createElement('div'); box.className = 'chat';
    box.innerHTML = '<div class="log"></div><div class="input"><span class="txt"></span><span>↵</span></div>';
    tg.after(box); btn.setAttribute('aria-pressed','true');
    const log = box.querySelector('.log'), txt = box.querySelector('.txt'), run = enterRun = {box, btn, timers:[]};
    const at = (ms, fn) => run.timers.push(setTimeout(fn, ms));
    const add = (cls, who, text) => { const m = document.createElement('div'); m.className = 'msg ' + cls; m.innerHTML = `<b>${who}</b>`; m.append(text); log.appendChild(m);
      while (log.children.length > 14) log.firstChild.remove(); return m; };
    const q = 'Z kim my właściwie rozmawiamy?';
    let k = 0; const typeQ = () => { k++; txt.textContent = q.slice(0, k); if (k < q.length) at(28, typeQ); };
    typeQ();
    at(q.length*28 + 350, () => { txt.textContent = ''; const me = add('me','Ty', q); const i = document.createElement('i'); i.textContent = 'wysłano'; me.append(i); run.me = i; });
    let tm = q.length*28 + 1300, gap = 900, n = 0;
    while (tm < q.length*28 + 8600) { const [cls, who, t] = CHAT[n % CHAT.length]; at(tm, () => add(cls, who, t)); n++; tm += gap; gap = Math.max(55, gap*.8); }
    at(tm + 200, () => { if (run.me) run.me.textContent = 'wysłano · bez odpowiedzi'; log.style.transition = 'opacity .8s'; log.style.opacity = '.25';
      txt.innerHTML = '<span class="cur"></span>'; hud('wiadomości od ludzi: 1'); });
    at(tm + 4200, () => { box.style.opacity = '0'; box.style.maxHeight = '0px'; });
    at(tm + 5100, () => stopEnter());
  }
  // API dla script.js: to strona decyduje, co jest zapalnikiem i kiedy efekty są włączone.
  window.Efekty = {
    uruchom(btn, ev) {
      const name = btn.dataset.fx;
      if (name === 'klik') { if (enabled) klik(btn, ev); return; }
      if (name === 'dlugo') { if (enabled || czatRun) czatDziecka(btn); return; }
      if (name === 'test') { if (enabled || testRun) testCzlowieka(btn); return; }
      if (name === 'enter') {
        const em = btn.parentElement && [...btn.parentElement.querySelectorAll('em')].find(e => btn.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (em) { if (enabled || odpRun) odpowiedzModelu(btn, em); return; }
        if (enabled || enterRun) enter(btn); return;
      }
      if (active.has(name)) { stop(name); if (!active.size) clearAll(); return; }
      if (!enabled) return;
      start(name, btn);
    },
    enter(btn) { if (enabled) enter(btn); },
    wlacz(flag) {
      enabled = !!flag;
      if (!enabled) { [...active.keys()].forEach(stop); clearAll(); clearKlik(); stopEnter(); stopCzat(); stopTest(); stopOdp(); }
    },
    czyDziala() { return active.size > 0 || !!enterRun || !!czatRun || !!testRun; },
  };
})();
