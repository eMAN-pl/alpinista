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
        tg.style.color = `rgb(${fr})`; tg.style.textShadow = `0 0 4px rgba(${fr},.6)`;
      },
      stop(s){ const tg = s.target; tg.style.color = ''; tg.style.textShadow = ''; setTimeout(() => tg.style.transition = '', 1500); },
      draw(c, s, p, t, dt, M){
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
        M.cold = Math.max(M.cold, .9*Math.min(1, th*3.5)*Math.min(1, p/.12));
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
        M.sat *= 1 - .7*e;
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
        [top, bot].forEach(n => { n.removeAttribute('id'); n.querySelectorAll('button').forEach(b => b.setAttribute('tabindex','-1')); });
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
        M.op *= 1 - .3*e; M.sat *= 1 - .8*e; M.cold = Math.max(M.cold, .55*e);
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
      init(s){ s.q = []; s.g = 0; },
      draw(c, s, p, t, dt, M, cb){
        const e = env(p,.1,.25), k = dt/16;
        const target = (.35 + .65*clamp(p/.6,0,1))*(.65 + .35*Math.sin(t/380) + .22*Math.sin(t/127));
        s.g += (target - s.g)*.08*k;
        const sp = 4 + s.g*22;
        let n = (1.5 + 7*s.g)*e*k;
        while (n > 0) { if (n >= 1 || R() < n) s.q.push({x:-40, y:R()*H, m:.5+R()*.9, ph:R()*6, r:.6+R()*1.6, fr:R() < .3}); n--; }
        c.lineCap = cb.lineCap = 'round';
        s.q = s.q.filter(o => {
          o.x += sp*o.m*k; o.y += Math.sin(o.x/70+o.ph)*.8*k;
          const len = sp*o.m*2.2, ctx = o.fr ? c : cb;
          ctx.strokeStyle = rgba('--snow-rgb', (o.fr ? .5 : .28)*e); ctx.lineWidth = o.fr ? o.r*1.4 : o.r;
          ctx.beginPath(); ctx.moveTo(o.x-len,o.y); ctx.lineTo(o.x,o.y); ctx.stroke();
          return o.x - len < W;
        });
        const g = s.g*e;
        M.dx += 11*g; M.skew += -3.2*g; M.blur += .5*g;
        M.shadow.push(`${(-6*g).toFixed(1)}px 0 1px rgba(${v('--fg-rgb')},${(.28*e).toFixed(3)})`, `${(-14*g).toFixed(1)}px 0 3px rgba(${v('--fg-rgb')},${(.13*e).toFixed(3)})`);
      }},

    lawinki: { dur: 6500,
      init(s){ s.g = []; s.sed = []; s.colH = new Float32Array(Math.ceil(W/3)+1); },
      draw(c, s, p, t, dt, M){
        const k = dt/16, e = env(p,.05,.2);
        const rum = p < .12 ? smooth(p/.12)*.5 : (p < .4 ? .5 + .5*Math.sin((p-.12)/.28*Math.PI) : Math.max(0, .5 - (p-.4)*1.6));
        M.dx += 2.2*rum*(Math.sin(t*.052) + .5*Math.sin(t*.17)); M.dy += 1.6*rum*(Math.sin(t*.061) + .5*Math.sin(t*.21));
        const fall = p < .1 ? 0 : (p < .55 ? smooth((p-.1)/.12) : 1 - smooth((p-.55)/.25));
        const hz = c.createLinearGradient(0,0,0,H*.32);
        hz.addColorStop(0, rgba('--powder-rgb', .22*fall*e)); hz.addColorStop(1, rgba('--powder-rgb', 0));
        c.fillStyle = hz; c.fillRect(0,0,W,H*.32);
        let n = 18*fall*k;
        while (n > 0) { if (n >= 1 || R() < n) { const big = R() < .06;
          s.g.push({x:R()*W, y:-6 - R()*20, vx:(R()-.5)*.6, vy:big ? 2 + R()*2 : .5 + R()*1.1, r:big ? 1.3 + R()*1.2 : .35 + R()*.8, big, ph:R()*6, a:.45 + R()*.5}); } n--; }
        c.fillStyle = rgba('--powder-rgb', 1);
        s.g = s.g.filter(g => {
          if (g.big) g.vy += .12*k; else g.vx += Math.sin(g.y/30 + g.ph + t/400)*.03*k;
          g.x += g.vx*k; g.y += g.vy*k;
          const i = clamp(Math.round(g.x/3), 0, s.colH.length-1), floor = H - 2 - s.colH[i];
          if (g.y >= floor) { s.colH[i] = Math.min(10, s.colH[i] + g.r*.9); s.sed.push({x:g.x, y:floor - R()*1.5, r:g.r, a:g.a}); return false; }
          c.globalAlpha = g.a*e; c.fillRect(g.x, g.y, g.r*2, g.r*2); return true;
        });
        for (const d of s.sed) { c.globalAlpha = d.a*e*.9; c.fillRect(d.x, d.y, d.r*2, d.r*2); }
        c.globalAlpha = 1;
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
      init(s){
        this.level = Math.min(6, this.level + 1); s.lv = this.level; s.dur = 900 + s.lv*260;
        hud(`halucynacje ${s.lv}`);
        const tg = s.target, r = tg.getBoundingClientRect(), mr = main.getBoundingClientRect();
        const wrap = document.createElement('div'); wrap.className = 'glitchwrap';
        Object.assign(wrap.style, {left:(r.left-mr.left)+'px', top:(r.top-mr.top)+'px', width:r.width+'px', height:r.height+'px'});
        const orig = () => { const n = tg.cloneNode(true); n.removeAttribute('id'); n.querySelectorAll('button').forEach(b => b.setAttribute('tabindex','-1')); return n; };
        const hal = document.createElement('p'); hal.className = 'halluc'; hal.textContent = this.lines[Math.floor(R()*this.lines.length)];
        s.base = orig(); s.hal = hal; s.r = orig(); s.r.classList.add('rgb-r'); s.c = orig(); s.c.classList.add('rgb-c');
        s.sl = Array.from({length: 2 + s.lv}, () => orig());
        wrap.append(s.base, hal, s.r, s.c, ...s.sl); main.appendChild(wrap); tg.style.visibility = 'hidden';
        s.wrap = wrap; s.h = r.height; s.next = 0;
      },
      stop(s){ s.wrap.remove(); s.target.style.visibility = ''; },
      draw(c, s, p, t, dt, M){
        const ms = (t - s.start), q = ms/s.dur; if (q >= 1) { s.done = true; return; }
        const halPhase = q > .32 && q < .68, glitching = !halPhase || (q > .32 && q < .37) || (q > .63 && q < .68);
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

    odpadasz: { dur: 4600,
      init(s){ s.target.style.willChange = 'transform'; },
      stop(s){ s.target.style.transform = ''; s.target.style.willChange = ''; },
      draw(c, s, p, t, dt, M){
        const ms = Math.max(0, t - s.start), T1 = 520, Y1 = 150, L = 118; let y, rot = 0;
        if (ms < T1) { const q = ms/T1; y = Y1*q*q; }
        else if (ms < 2600) { const tau = ms - T1; y = L + (Y1 - L)*Math.exp(-tau/260)*Math.cos(tau/62); rot = 1.3*Math.exp(-tau/700)*Math.sin(tau/320); if (!s.caught) s.caught = t; }
        else { y = L*(1 - smooth((ms - 2600)/1700)); }
        if (s.caught) { const d = t - s.caught; M.dy += 4*Math.exp(-d/120)*Math.cos(d/30); }
        s.target.style.transform = `translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
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
        if (ms >= 300 && !s.counted) { s.counted = true; tick(); }
        if (s.flash && ms >= 330 && ms < 700) {
          const f = Math.exp(-(ms-330)/110), light = root.getAttribute('data-theme') === 'light';
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
  function tick(){ frames = Math.min(36, frames + 1); hud(`klisza ${frames}/36`); }
  const fresh = () => ({cold:0, blur:0, op:1, dx:0, dy:0, skew:0, bright:1, sat:1, shadow:[], tunnel:null, frost:null});
  const hex = h => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
  function apply(M){
    if (M.cold > .002) { const a = hex(v('--bg')), b = hex(v('--cold')), m = clamp(M.cold,0,1);
      const col = `rgb(${a.map((x,i) => Math.round(x + (b[i]-x)*m)).join(',')})`;
      root.style.backgroundColor = col; document.body.style.backgroundColor = col; }
    else { root.style.backgroundColor = ''; document.body.style.backgroundColor = ''; }
    const f = [];
    if (M.blur > .02) f.push(`blur(${M.blur.toFixed(2)}px)`);
    if (Math.abs(M.bright-1) > .002) f.push(`brightness(${M.bright.toFixed(3)})`);
    if (Math.abs(M.sat-1) > .002) f.push(`saturate(${M.sat.toFixed(3)})`);
    main.style.filter = f.join(' ');
    main.style.transform = (Math.abs(M.dx) > .05 || Math.abs(M.dy) > .05 || Math.abs(M.skew) > .01) ? `translate(${M.dx.toFixed(2)}px,${M.dy.toFixed(2)}px) skewX(${M.skew.toFixed(3)}deg)` : '';
    main.style.opacity = M.op < .998 ? M.op.toFixed(3) : '';
    main.style.textShadow = M.shadow.join(',');
    main.style.willChange = active.size ? 'filter, transform' : '';
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
  /* ---------- Klik: zawsze ta sama odpowiedź ---------- */
  const KLIK_TEXT = 'Nowoczesny, intuicyjny i przyjazny użytkownikowi interfejs, który zwiększa zaangażowanie i buduje wartość.';
  let klikCount = 0, klikLast = 0;
  const klikState = new Map();
  function klik(btn){
    const tg = document.getElementById(btn.dataset.target) || btn.closest('p');
    let st = klikState.get(tg);
    if (!st) { const box = document.createElement('div'); box.className = 'gen'; tg.after(box); st = {box, timer:0}; klikState.set(tg, st); }
    const now = performance.now(), fast = now - klikLast < 1400 ? Math.min(4, (st.fast || 1) + 1) : 1; st.fast = fast; klikLast = now;
    klikCount++; hud(`wygenerowano ${klikCount}`);
    const lines = [...st.box.children];
    lines.forEach((l, i) => { const age = lines.length - i; l.classList.add('old'); l.classList.remove('typing');
      l.textContent = KLIK_TEXT; l.style.opacity = Math.max(.12, .6 - age*.1).toFixed(2); l.style.filter = `blur(${Math.min(2, age*.25).toFixed(2)}px)`;
      l.style.marginTop = lines.length > 4 ? `-${Math.min(18, (lines.length-4)*3)}px` : ''; });
    const line = document.createElement('div'); line.className = 'genline typing'; st.box.appendChild(line);
    let i = 0; const step = Math.max(1, Math.round(fast*1.5)), ms = Math.max(6, 22 - fast*4);
    const type = () => { if (!line.isConnected) return; i = Math.min(KLIK_TEXT.length, i + step); line.textContent = KLIK_TEXT.slice(0, i);
      if (i < KLIK_TEXT.length) setTimeout(type, ms); else line.classList.remove('typing'); };
    type();
    clearTimeout(st.timer);
    st.timer = setTimeout(() => { [...st.box.children].forEach(l => { l.style.opacity = '0'; }); setTimeout(() => { st.box.remove(); klikState.delete(tg); }, 700); }, 6000);
  }
  function clearKlik(){ klikState.forEach(st => { clearTimeout(st.timer); st.box.remove(); }); klikState.clear(); }

  /* ---------- Enter: model rozmawia z modelem ---------- */
  const CHAT = [
    ['a','Rekruter (model)','Dziękujemy za aplikację! Twoje doświadczenie idealnie pasuje do naszych wartości.'],
    ['b','Kandydat (model)','Dziękuję! Jestem pasjonatem tworzenia wartości dla użytkowników.'],
    ['a','Rekruter (model)','Świetnie! Opowiedz o sytuacji, w której wykazałeś się proaktywnością.'],
    ['b','Kandydat (model)','W poprzedniej roli proaktywnie zwiększyłem zaangażowanie o 40%.'],
    ['a','Rekruter (model)','Imponujące. Twoja kandydatura przechodzi do kolejnego etapu.'],
    ['b','Kandydat (model)','Dziękuję! Nie mogę się doczekać kolejnego etapu.'],
    ['a','Rekruter (model)','Kolejny etap to rozmowa z naszym asystentem.'],
    ['b','Kandydat (model)','Z przyjemnością porozmawiam z Twoim asystentem.'],
    ['a','Asystent (model)','Opowiedz o swoich mocnych stronach.'],
    ['b','Kandydat (model)','Moją mocną stroną jest komunikacja i praca zespołowa.'],
  ];
  let enterRun = null;
  function stopEnter(){ if (!enterRun) return; enterRun.timers.forEach(clearTimeout); enterRun.box.remove(); enterRun.btn.setAttribute('aria-pressed','false'); enterRun = null; }
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
    uruchom(btn) {
      const name = btn.dataset.fx;
      if (name === 'klik') { if (enabled) klik(btn); return; }
      if (name === 'enter') { if (enabled || enterRun) enter(btn); return; }
      if (active.has(name)) { stop(name); if (!active.size) clearAll(); return; }
      if (!enabled) return;
      start(name, btn);
    },
    enter(btn) { if (enabled) enter(btn); },
    wlacz(flag) {
      enabled = !!flag;
      if (!enabled) { [...active.keys()].forEach(stop); clearAll(); clearKlik(); stopEnter(); }
    },
    czyDziala() { return active.size > 0 || !!enterRun; },
  };
})();
