/* =========================================================
   Nie każdy, kto był na szczycie, jest alpinistą
   Ekran tytułowy — falująca siatka gór (WebGL, bez bibliotek)
   i znaczniki gór eseju, które wyrastają razem z terenem.

   Kształt fal liczy karta graficzna, nie procesor.
   Znacznik pojawia się tam, gdzie teren właśnie rośnie, i znika, gdy grzbiet opada.
   Góry w losowej kolejności — każda raz, zanim któraś się powtórzy.
   Animacja działa tylko wtedy, gdy ekran tytułowy jest widoczny.
   Przełącznik „wyłącz efekty” zatrzymuje ją na stałe (zapamiętane w localStorage).
   Przy „ogranicz ruch” efekty są domyślnie wyłączone — jedna nieruchoma klatka.
   Bez WebGL — sam tytuł.
   ========================================================= */

(() => {
  const hero = document.querySelector(".hero");
  const canvas = hero?.querySelector("canvas");
  const title = hero?.querySelector("h1");
  const gl = canvas?.getContext("webgl", { alpha: true, antialias: true });
  if (!gl) return;

  // --- Scena: siatka 240×240 ze 128 podziałami (brzegi chowają się w mgle, także na szerokim
  //     ekranie), mgła od 20 do 100, kamera lekko podniesiona ---
  const SIZE = 240;
  const SEGMENTS = 128;           // ta sama gęstość linii co 150/80; wierzchołków < 65 536
  const FOG_NEAR = 20;
  const FOG_FAR = 100;
  const OPACITY = 0.25;
  const SPEED = 0.01;             // przyrost czasu na klatkę przy 60 fps
  const EYE = [0, 15, 45];        // patrzy na środek sceny

  // --- Znaczniki ---
  const MARKER_MIN = 2500;        // ms — najkrócej widoczny (chyba że wjedzie w tytuł)
  const MARKER_MAX = 6000;        // ms — najdłużej widoczny
  const MARKER_GAP = 800;         // ms — przerwa między znacznikami
  const MARKER_FIRST = 1000;      // ms — pierwszy po wejściu na stronę
  const RISE_AHEAD = 0.3;         // o ile do przodu w czasie sprawdzamy, czy teren rośnie
  const MIN_HEIGHT = 1.5;         // znacznik tylko na grzbiecie, nie w dolinie
  const MIN_RISE = 0.08;          // …i tylko tam, gdzie grzbiet rośnie
  const EDGE = 12;                // px — odstęp podpisu od krawędzi kadru

  // --- Efekty: wybór czytelnika albo ustawienie systemowe „ogranicz ruch” ---
  const EFFECTS_KEY = "alpinista:efekty";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let effectsOn = readEffects();

  const markers = [...hero.querySelectorAll(".marker")].map((el) => ({
    el,
    x: 0,
    z: 0,
    sx: 0,              // położenie punktu na ekranie w ostatniej klatce
    sy: 0,
    labelWidth: 0,
    placed: false,
  }));

  // --- Siatka: wierzchołki (x, z) i odcinki jak w siatce trójkątów ---
  const row = SEGMENTS + 1;
  const vertices = new Float32Array(row * row * 2);
  for (let j = 0, k = 0; j < row; j++) {
    for (let i = 0; i < row; i++) {
      vertices[k++] = (i / SEGMENTS - 0.5) * SIZE;
      vertices[k++] = (j / SEGMENTS - 0.5) * SIZE;
    }
  }

  const at = (i, j) => j * row + i;
  const lines = [];
  for (let j = 0; j < row; j++) {
    for (let i = 0; i < row; i++) {
      if (i < SEGMENTS) lines.push(at(i, j), at(i + 1, j));
      if (j < SEGMENTS) lines.push(at(i, j), at(i, j + 1));
      if (i < SEGMENTS && j < SEGMENTS) lines.push(at(i + 1, j), at(i, j + 1));
    }
  }
  const indices = new Uint16Array(lines);

  // --- Shadery: wysokość liczona w karcie graficznej, mgła jako zanik przezroczystości.
  //     Funkcja elevation() musi być taka sama jak w JS niżej — znaczniki leżą na terenie. ---
  const vertexSource = `
    attribute vec2 a_xz;
    uniform float u_time;
    uniform mat4 u_projection;
    uniform mat4 u_view;
    varying float v_depth;

    float elevation(vec2 p, float t) {
      float e = sin(p.x * 0.05 + t * 0.5) * 4.0
              + cos(p.y * 0.05 - t * 0.3) * 4.0
              + sin(p.x * 0.1 + p.y * 0.1 + t * 0.8) * 2.0;
      float d = length(p);
      if (d < 40.0) e += cos(d * 0.1 - t) * 5.0;   // ostrzejsze szczyty w środku
      return e;
    }

    void main() {
      vec4 view = u_view * vec4(a_xz.x, elevation(a_xz, u_time), a_xz.y, 1.0);
      v_depth = -view.z;
      gl_Position = u_projection * view;
    }`;

  const fragmentSource = `
    precision mediump float;
    uniform vec3 u_color;
    varying float v_depth;

    void main() {
      float fog = clamp((v_depth - ${FOG_NEAR.toFixed(1)}) / ${(FOG_FAR - FOG_NEAR).toFixed(1)}, 0.0, 1.0);
      gl_FragColor = vec4(u_color, ${OPACITY.toFixed(2)} * (1.0 - fog));
    }`;

  function elevation(x, z, t) {
    let e = Math.sin(x * 0.05 + t * 0.5) * 4
          + Math.cos(z * 0.05 - t * 0.3) * 4
          + Math.sin(x * 0.1 + z * 0.1 + t * 0.8) * 2;
    const d = Math.hypot(x, z);
    if (d < 40) e += Math.cos(d * 0.1 - t) * 5;
    return e;
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const aXZ = gl.getAttribLocation(program, "a_xz");
  gl.enableVertexAttribArray(aXZ);
  gl.vertexAttribPointer(aXZ, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const view = lookAt(EYE);
  let projection = null;

  const uTime = gl.getUniformLocation(program, "u_time");
  const uProjection = gl.getUniformLocation(program, "u_projection");
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_view"), false, view);
  gl.uniform3fv(gl.getUniformLocation(program, "u_color"), accentColor());

  // Kolory przedmnożone przez przezroczystość — tak canvas składa się z tłem strony
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  // --- Klatka i pętla ---
  let time = 0;
  let running = false;
  let frame = 0;
  let last = 0;
  let width = 0;         // rozmiar canvasu w pikselach CSS
  let height = 0;
  let titleBoxes = [];   // prostokąty liter tytułu, względem canvasu

  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uTime, time);
    gl.drawElements(gl.LINES, indices.length, gl.UNSIGNED_SHORT, 0);
    placeMarkers();
  }

  function loop(now) {
    if (last) time += SPEED * ((now - last) / (1000 / 60));   // to samo tempo przy 60 i 120 Hz
    last = now;
    draw();
    updateMarkers(now);
    frame = requestAnimationFrame(loop);
  }

  function start() {
    if (running || !effectsOn) return;
    running = true;
    last = 0;
    if (!shown) nextAt = performance.now() + MARKER_FIRST;
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    projection = perspective(60, width / height, 0.1, 150);
    gl.uniformMatrix4fv(uProjection, false, projection);
    measureTitle();
  }

  // Tytuł: prostokąty samych liter, każdy wiersz osobno (krótkie wiersze zostawiają miejsce obok)
  function measureTitle() {
    const box = canvas.getBoundingClientRect();
    titleBoxes = [];
    for (const line of title.querySelectorAll(".t-line")) {
      const range = document.createRange();
      range.selectNodeContents(line);
      for (const r of range.getClientRects()) {
        titleBoxes.push({
          l: r.left - box.left - 16,
          t: r.top - box.top - 12,
          r: r.right - box.left + 16,
          b: r.bottom - box.top + 12,
        });
      }
    }
  }

  // --- Znaczniki: wyrastają z rosnącego grzbietu, znikają, gdy opada ---
  let bag = [];          // losowa kolejność gór; opróżnia się, zanim któraś się powtórzy
  let shown = null;      // { m, since } — znacznik na ekranie
  let lastShown = null;
  let nextAt = 0;

  function nextMarker() {
    if (!bag.length) {
      bag = shuffle(markers.slice());
      // ta sama góra nie wyskakuje dwa razy pod rząd na styku losowań
      if (bag.length > 1 && bag[bag.length - 1] === lastShown) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    return bag.pop();
  }

  function updateMarkers(now) {
    if (shown) {
      const { m, since } = shown;
      const age = now - since;
      const falling = elevation(m.x, m.z, time + RISE_AHEAD) < elevation(m.x, m.z, time);
      const inTheWay = !fits(m.sx, m.sy, m.labelWidth);   // grzbiet wniósł podpis w tytuł albo za krawędź
      if (inTheWay || (age > MARKER_MIN && falling) || age > MARKER_MAX) {
        m.el.classList.remove("is-visible");
        lastShown = m;
        shown = null;
        nextAt = now + MARKER_GAP;
      }
      return;
    }
    if (now < nextAt || !markers.length) return;

    const m = nextMarker();
    const spot = findSpot(m, true);
    if (!spot) {
      bag.push(m);                  // teraz nigdzie w wolnym miejscu nic nie rośnie — za chwilę znowu
      nextAt = now + 300;
      return;
    }
    show(m, spot, now);
  }

  function show(m, spot, now) {
    m.x = spot.x;
    m.z = spot.z;
    m.placed = true;
    placeMarkers();
    m.el.classList.add("is-visible");
    shown = { m, since: now };
  }

  // Podpis mieści się w kadrze i nie zasłania tytułu
  function fits(sx, sy, labelWidth) {
    if (sx < EDGE || sx + labelWidth > width - EDGE || sy - 70 < EDGE || sy > height - EDGE) return false;
    return !titleBoxes.some((t) => overlaps(t, sx - 8, sy - 70, sx + labelWidth, sy + 8));
  }

  // Najlepszy grzbiet: wysoko, rośnie, w wolnym miejscu kadru
  function findSpot(m, mustRise) {
    m.labelWidth = m.el.querySelector(".marker-label").offsetWidth + 45;

    let best = null;
    let bestScore = -Infinity;
    // Kandydaci od horyzontu (z = -46) po teren blisko kamery (z = 24)
    for (let x = -45; x <= 45; x += 6) {
      for (let z = -46; z <= 24; z += 4) {
        const e = elevation(x, z, time);
        const rise = elevation(x, z, time + RISE_AHEAD) - e;
        if (e < MIN_HEIGHT || (mustRise && rise < MIN_RISE)) continue;

        const [sx, sy] = toScreen(x, e, z);
        if (!fits(sx, sy, m.labelWidth)) continue;

        const score = e + rise * 10 + Math.random() * 2;   // odrobina losowości — nie zawsze ten sam grzbiet
        if (score > bestScore) {
          bestScore = score;
          best = { x, z };
        }
      }
    }
    return best;
  }

  function placeMarkers() {
    for (const m of markers) {
      if (!m.placed) continue;
      [m.sx, m.sy] = toScreen(m.x, elevation(m.x, m.z, time), m.z);
      m.el.style.transform = `translate(${m.sx}px, ${m.sy}px)`;
    }
  }

  // Bez efektów: nieruchoma klatka i jeden znacznik na najwyższym grzbiecie
  function showStill() {
    if (shown || !markers.length) return;
    const m = nextMarker();
    const spot = findSpot(m, false);
    if (spot) show(m, spot, performance.now());
  }

  // --- Przełącznik „wyłącz efekty” — widoczny, w rogu ekranu tytułowego ---
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "effects-toggle";
  hero.append(toggle);

  function readEffects() {
    try {
      const stored = localStorage.getItem(EFFECTS_KEY);
      if (stored) return stored === "on";
    } catch {
      // brak dostępu do pamięci — decyduje ustawienie systemowe
    }
    return !reduceMotion.matches;
  }

  function setEffects(on) {
    effectsOn = on;
    toggle.textContent = on ? "wyłącz efekty" : "włącz efekty";
    document.documentElement.classList.toggle("effects-off", !on);   // „cyk”/„klik” w script.js
    if (on) {
      start();
    } else {
      stop();
      showStill();
    }
  }

  toggle.addEventListener("click", () => {
    try {
      localStorage.setItem(EFFECTS_KEY, effectsOn ? "off" : "on");
    } catch {
      // wybór działa do końca wizyty, tylko się nie zapamięta
    }
    setEffects(!effectsOn);
  });

  resize();
  draw();
  setEffects(effectsOn);

  // Animacja tylko wtedy, gdy ekran tytułowy jest widoczny — podczas czytania stoi
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(hero);
  addEventListener("resize", () => {
    resize();
    draw();
  });
  // Zmiana ustawienia systemowego liczy się tylko, dopóki czytelnik sam nie wybrał
  reduceMotion.addEventListener?.("change", () => {
    let stored = null;
    try {
      stored = localStorage.getItem(EFFECTS_KEY);
    } catch {
      // bez pamięci — traktujemy jak brak wyboru
    }
    if (!stored) setEffects(!reduceMotion.matches);
  });

  // --- Pomocnicze ---

  function accentColor() {
    const hex = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function overlaps(a, left, top, right, bottom) {
    return !(right < a.l || left > a.r || bottom < a.t || top > a.b);
  }

  function perspective(fovDegrees, aspect, near, far) {
    const f = 1 / Math.tan((fovDegrees * Math.PI) / 360);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  function lookAt(eye) {
    const z = normalize(eye);                  // od środka sceny do kamery
    const x = normalize(cross([0, 1, 0], z));
    const y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
    ]);
  }

  // Punkt sceny → piksele na canvasie, tak samo jak w shaderze
  function toScreen(x, y, z) {
    const clip = multiply(projection, multiply(view, [x, y, z, 1]));
    return [(clip[0] / clip[3] * 0.5 + 0.5) * width, (0.5 - clip[1] / clip[3] * 0.5) * height];
  }

  function multiply(m, v) {
    return [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);
    return v.map((c) => c / length);
  }
})();
