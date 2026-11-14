/* Wejście: intro sterowane przewijaniem (spec: assets/alpinista-intro-spec.md §6–8).
   Kod ze specyfikacji, z odstępstwami:
   - zwykły skrypt (strona nie używa modułów ES), id z przedrostkiem we-;
   - wymiary zdjęć z atrybutów width/height (znane z tools/intro.json), więc start nie czeka
     na zdekodowanie wszystkich trzech zdjęć — pierwsze kadry rysują się od razu;
   - kolory mgły zmierzone na zdjęciach po obróbce (data-mgla na sekcji);
   - kolor końcowy = --bg bieżącego motywu; script.js wysyła 'theme-change' przy zmianie. */
(() => {
  const $ = id => document.getElementById(id);
  const intro = $('poczatek');
  if (!intro || !intro.classList.contains('wejscie')) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ramp = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = h => { h = h.trim(); if (h.length === 4) h = '#' + [...h.slice(1)].map(c => c + c).join('');
    return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };

  const stage = $('we-stage');
  const sD = $('we-sD'), sK = $('we-sK'), sL = $('we-sL'), pD = $('we-pD'), pK = $('we-pK'), pL = $('we-pL');
  const dBg = $('we-dBg'), kBg = $('we-kBg'), lBg = $('we-lBg'), lFg = $('we-lFg');
  const title = $('we-title'), wisps = $('we-wisps'), bZ = $('we-bZ'), bH = $('we-bH'), bV = $('we-bV'),
        flash = $('we-flash'), hint = $('we-hint'), fallback = $('we-fogFallback');

  const [FOGD, FOGK, FOGL] = (intro.dataset.mgla || '#d6d9de,#d3d7d9,#c2c7cb').split(',').map(hex);
  const STORM = hex('#868e99');
  const pageBg = () => hex(getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#16191c');
  let END = pageBg();
  addEventListener('theme-change', () => { END = pageBg(); if (!raf) render(performance.now()); });

  // --- kadrowanie: własne „cover” z punktem ogniskowym ---
  const dims = plate => { const img = plate.querySelector('img');
    return [img.naturalWidth || +img.getAttribute('width'), img.naturalHeight || +img.getAttribute('height')]; };
  function fit(plate, fyOverride) {
    const W = stage.clientWidth, H = stage.clientHeight, [iw, ih] = dims(plate);
    const mob = innerWidth < 760;
    const fx = +((mob && plate.dataset.fxMobile) || plate.dataset.fx), extra = +((mob && plate.dataset.extraMobile) || plate.dataset.extra || 1);
    const fy = fyOverride ?? (mob && plate.dataset.fyMobile ? +plate.dataset.fyMobile : +plate.dataset.fy);
    const s = Math.max(W / iw, H / ih) * extra, w = iw * s, h = ih * s;
    const x = clamp(W * fx - w * fx, W - w, 0), y = clamp(H * fy - h * fy, H - h, 0);
    plate.style.width = w + 'px'; plate.style.height = h + 'px';
    plate.style.transform = `translate3d(${x}px,${y}px,0)`;
    return { x, y, w, h };
  }
  let gL, gLtop;
  function layout() { fit(pD); fit(pK); gLtop = fit(pL, +pL.dataset.fyStart); gL = fit(pL); }

  // --- mgła WebGL ---
  const canvas = $('we-fog');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  let prog = null; const U = {};
  if (gl) {
    const vs = `attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}`;
    const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec2 v;
      uniform float t,dens,drift,bias,aspect,vari,band,bandY,shade;uniform vec3 c;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*n(p);p=m*p;a*=.5;}return s;}
      float layer(vec2 uv,float sc,float sp,float off){
        vec2 p=vec2(uv.x*aspect,uv.y)*sc+vec2(off,0.);p.y+=drift*sp;p.x+=t*.018*sp;
        vec2 q=vec2(fbm(p+vec2(0.,t*.02)),fbm(p+vec2(5.2,1.3)-t*.015));return fbm(p+1.7*q);}
      void main(){
        float nn=mix(layer(v,1.3,1.,0.),layer(v,2.6,1.9,9.),.38);
        nn+=(1.-v.y)*bias-v.y*bias*.55;
        nn+=band*exp(-pow((v.y-bandY)/.2,2.))*(.4+1.2*nn);
        float th=1.05-dens*1.25;float a=smoothstep(th-.18,th+.22,nn);
        a=max(a,dens*dens*.55);a=mix(a,1.,smoothstep(.9,1.,dens));
        vec3 col=mix(c*(1.-shade*vari),c*(1.+.05*vari),clamp(nn*1.15+v.y*.2-.1,0.,1.));
        gl_FragColor=vec4(col*a,a);}`;
    const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (v && f) { prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null; }
    if (prog) {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['t', 'dens', 'drift', 'bias', 'aspect', 'vari', 'band', 'bandY', 'shade', 'c'].forEach(k => U[k] = gl.getUniformLocation(prog, k));
      gl.clearColor(0, 0, 0, 0);
    }
  }
  const useGL = !!prog && !reduce;
  if (!useGL) canvas.style.display = 'none';
  function sizeCanvas() {
    if (!useGL) return;
    const sc = Math.min(.6, 640 / stage.clientWidth);
    canvas.width = Math.round(stage.clientWidth * sc); canvas.height = Math.round(stage.clientHeight * sc);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // --- stan mgły w funkcji postępu ---
  // Start slajdu I łagodniej niż w spec (d .36, bias .46, pas .2 na .44): na zdjęciu jest już
  // prawdziwe morze chmur, a mgła z kodu sięgała do połowy iglic i je dublowała (autor).
  const START = { d: .26, bias: .36, band: .14, bandY: .34 };
  function fogAt(p) {
    const up1 = ease(ramp(p, .06, .24)), clrK = ease(ramp(p, .27, .35)), up2 = ease(ramp(p, .44, .51)),
          clrL = ease(ramp(p, .61, .69)),
          // Wyjście w dwóch krokach (autor): najpierw szara mgła zalewa lodowiec, chwila samej
          // mgły, dopiero potem kolor strony. Razem (spec: .875–.945) gasło jak światło.
          thick = ease(ramp(p, .82, .88)), dark = ease(ramp(p, .925, .97));
    let d = START.d; d = lerp(d, 1, up1); d = lerp(d, .14, clrK); d = lerp(d, 1, up2); d = lerp(d, .16, clrL); d = lerp(d, 1, thick);
    const bias = lerp(START.bias, 0, up1) * (1 - clrK) + .12 * clrK * (1 - up2) + .04 * clrL * (1 - thick);
    let col = FOGD.map((c, i) => lerp(c, FOGK[i], ease(ramp(p, .16, .26))));
    col = col.map((c, i) => lerp(c, FOGL[i], ease(ramp(p, .45, .55))));
    const sf = ease(ramp(p, .455, .5)) * (1 - ease(ramp(p, .57, .615)));   // burza
    col = col.map((c, i) => lerp(c, STORM[i], sf * .75));
    // szara warstwa: w pół drogi między mgłą lodowca a tłem strony (ciemny motyw: ołów,
    // jasny: lekkie przygaszenie), dopiero potem pełny kolor strony
    col = col.map((c, i) => lerp(c, lerp(FOGL[i], END[i], .45) * .92, thick * (1 - dark)));
    col = col.map((c, i) => lerp(c, END[i], dark));
    return { d, bias, col, vari: 1 - dark, band: START.band * (1 - up1), shade: lerp(.24, .12, up1) };
  }

  let p = 0, target = 0, lastT = 0, flashAt = -1e9, nextFlash = 0, inStorm = false;
  const progress = () => { const r = intro.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };

  function render(time) {
    const dt = Math.min(.1, Math.max(0, (time - lastT) / 1000)); lastT = time;
    p += reduce ? (target - p) : (target - p) * (1 - Math.exp(-dt / .08));
    if (Math.abs(target - p) < 1e-4) p = target;
    const f = fogAt(p);
    // ikony górnego paska ciemne, dopóki pod nimi jest jasne zdjęcie albo mgła (style.css)
    document.documentElement.classList.toggle('nad-zdjeciem', visible && ease(ramp(p, .925, .97)) < .5);
    stage.style.background = `rgb(${f.col.map(c => Math.round(c * 255)).join(',')})`;
    const k = p < .25 ? 0 : p < .595 ? 1 : 2;

    if (reduce) {   // bez ruchu: proste przełączanie, bez błysków
      sD.style.opacity = k === 0 ? 1 : 0; sK.style.opacity = k === 1 ? 1 : 0; sL.style.opacity = k === 2 && p < .9 ? 1 : 0;
      title.style.opacity = p < .08 ? 1 : 0; wisps.style.opacity = p < .08 ? .34 : 0;
      bZ.style.opacity = (p > .33 && p < .45) ? 1 : 0; bH.style.opacity = (p > .47 && p < .59) ? 1 : 0; bV.style.opacity = (p > .7 && p < .82) ? 1 : 0;
      hint.style.opacity = p < .03 ? 1 : 0;
      fallback.style.opacity = p >= .9 ? 1 : 0; return;
    }

    // I · góry
    const dsc = ease(ramp(p, 0, .25));
    dBg.style.transformOrigin = '60% 30%';
    dBg.style.transform = `translate3d(0,${-dsc * 7}%,0) scale(${1 + dsc * .06})`;
    const sw1 = ramp(p, .24, .255), sw2 = ramp(p, .585, .6);
    sD.style.opacity = 1 - sw1; sK.style.opacity = sw1 * (1 - sw2); sL.style.opacity = sw2;

    // II · przełęcz
    const kz = ease(ramp(p, .25, .6));
    kBg.style.transformOrigin = '60% 64%';
    kBg.style.transform = `scale(${1.04 + kz * .24}) translate3d(0,${-kz * 2}%,0)`;

    // III · lodowiec
    const tilt = ease(ramp(p, .6, .73));
    pL.style.transform = `translate3d(${gL.x}px,${lerp(gLtop.y, gL.y, tilt)}px,0)`;
    const z = ease(ramp(p, .6, 1));
    const origin = `${(+pL.dataset.fx * 100).toFixed(1)}% ${(+pL.dataset.fy * 100).toFixed(1)}%`;
    lBg.style.transformOrigin = lFg.style.transformOrigin = origin;
    lBg.style.transform = `scale(${1 + z * .16})`;
    lFg.style.transform = `scale(${1 + z * .25}) translate3d(${-z * 1.2}%,${z * 1.5}%,0)`;

    // teksty
    const tt = ease(ramp(p, .015, .1));
    title.style.opacity = 1 - tt; title.style.transform = `translate3d(0,${-tt * 10}vh,0)`;
    wisps.style.opacity = ((1 - ramp(p, .06, .2)) * .34).toFixed(3);
    wisps.style.transform = `translate3d(0,${-dsc * 8}vh,0)`;
    hint.style.opacity = 1 - ramp(p, 0, .03); hint.style.display = p > .9 ? 'none' : '';
    const beat = (el, a, b) => {
      el.style.opacity = ramp(p, a, a + .03) * (1 - ramp(p, b - .03, b));
      el.style.transform = `translate3d(0,${(1 - ramp(p, a, a + .05)) * 20}px,0)`;
    };
    beat(bZ, .33, .45); beat(bH, .47, .59); beat(bV, .70, .82);

    // burza: podwójny błysk co 2,6–5,4 s, tylko w zakresie cytatu „Huk” (< 3 błyski/s)
    const storm = p > .475 && p < .585;
    if (storm && !inStorm) nextFlash = time + 350;
    inStorm = storm;
    if (storm && time >= nextFlash) {
      flashAt = time; nextFlash = time + 2600 + Math.random() * 2800;
      dispatchEvent(new CustomEvent('intro:flash'));   // dla przyszłego modułu dźwięku (grzmot)
    }
    const ft = time - flashAt;
    let fo = 0;
    if (ft >= 0 && ft < 700) fo = ft < 55 ? .85 : ft < 120 ? .12 : ft < 180 ? .6 : .6 * Math.exp(-(ft - 180) / 140);
    flash.style.opacity = fo.toFixed(3);

    if (useGL) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.t, time / 1000); gl.uniform1f(U.dens, f.d); gl.uniform1f(U.drift, -p * 4.4);
      gl.uniform1f(U.bias, f.bias); gl.uniform1f(U.vari, f.vari); gl.uniform1f(U.band, f.band);
      gl.uniform1f(U.bandY, START.bandY); gl.uniform1f(U.shade, f.shade); gl.uniform1f(U.aspect, canvas.width / canvas.height);
      gl.uniform3fv(U.c, f.col); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      fallback.style.opacity = f.d;
    }
  }

  let visible = true, raf = 0;
  const loop = t => { raf = 0; render(t); if (visible && !reduce) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (!visible) document.documentElement.classList.remove('nad-zdjeciem'); if (visible && !raf && !reduce) raf = requestAnimationFrame(loop); }).observe(intro);
  addEventListener('scroll', () => { target = progress(); if (reduce) render(performance.now()); }, { passive: true });
  addEventListener('resize', () => { layout(); sizeCanvas(); target = progress(); if (reduce) render(performance.now()); });
  // gdy przeglądarka dobierze z srcset inny plik, proporcje są te same, ale naturalWidth się pojawia
  intro.querySelectorAll('.we-plate img').forEach(i => i.addEventListener('load', layout, { once: true }));

  layout(); sizeCanvas(); target = p = progress(); render(performance.now());
  if (!reduce) raf = requestAnimationFrame(loop);
})();
