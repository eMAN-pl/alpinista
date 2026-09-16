/* =========================================================
   Sceny rozdziałów — prawie niewidoczne ozdobniki wzięte z tekstu.
     Babia Góra:    kilka płatków śniegu (zamieć).
     Gran Paradiso: kilka świetlików krążących po ekranie; o świcie gasną.
     Zakończenie:   jedno ciepłe światło — okno schroniska.
   Jedna warstwa pod tekstem; na kolumnie tekstu ozdobniki są jeszcze słabsze.
   Rozdział i etap podaje script.js (html[data-scene], html[data-step]),
   kolory tła są w style.css. Przy „ogranicz ruch” i wyłączonych efektach
   warstwy nie ma — zostaje sam kolor.
   ========================================================= */

(() => {
  const root = document.documentElement;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.className = "scene";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const FADE = 1.5;                               // s — wejście i wyjście sceny, jak kolor tła

  let width = 0;
  let height = 0;
  let ratio = 1;
  let column = { left: 0, right: 0 };

  const rand = (a, b) => a + Math.random() * (b - a);
  const ease = (x) => x * x * (3 - 2 * x);

  // Na kolumnie tekstu ozdobnik ma połowę siły — litery zostają czyste
  const over = (x) => (x > column.left - 24 && x < column.right + 24 ? 0.5 : 1);

  // Miękki punkt światła, rysowany raz i potem tylko kopiowany
  function sprite(size, rgb, core) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const r = size / 2;
    const gradient = g.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, `rgba(${rgb}, 1)`);
    gradient.addColorStop(core, `rgba(${rgb}, 0.3)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = gradient;
    g.fillRect(0, 0, size, size);
    return c;
  }

  // --- Babia Góra: zamieć ---
  const snow = {
    flakes: [],
    seed() {
      const count = width < 700 ? 30 : 60;
      this.flakes = Array.from({ length: count }, () => this.flake(rand(0, height)));
    },
    flake(y) {
      return { x: rand(-20, width), y, r: rand(0.8, 2.1), vy: rand(12, 30), phase: rand(0, 6.3), alpha: rand(0.25, 0.6) };
    },
    draw(level, dt, t) {
      ctx.fillStyle = "#f7f3ea";
      for (const f of this.flakes) {
        f.y += f.vy * dt;
        f.x += (4 + Math.sin(t * 0.5 + f.phase) * 7) * dt;   // wiatr: lekki znos w prawo
        if (f.y > height + 4 || f.x > width + 4) Object.assign(f, this.flake(-4));
        ctx.globalAlpha = f.alpha * level * over(f.x);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };

  // --- Gran Paradiso: świetliki ---
  // Kilka pojedynczych światełek, każde własnym kursem, który płynnie skręca.
  // Powoli rozbłyskują i przygasają; za krawędzią ekranu wracają z drugiej strony.
  const lamps = {
    list: [],
    glow: null,
    seed() {
      this.glow ||= sprite(32, "255, 210, 140", 0.1);
      const count = width < 700 ? 4 : 7;
      this.list = Array.from({ length: count }, () => ({
        x: rand(0, width), y: rand(0, height), heading: rand(0, Math.PI * 2),
        speed: rand(6, 14), phase: rand(0, 100), pulse: rand(0, 6.3),
      }));
    },
    draw(level, dt, t) {
      for (const f of this.list) {
        // skręt: suma dwóch wolnych sinusów o różnych okresach — ruch bez wzoru, ale bez szarpnięć
        f.heading += (Math.sin(t * 0.37 + f.phase) + 0.6 * Math.sin(t * 0.83 + f.phase * 1.7)) * 0.9 * dt;
        f.x += Math.cos(f.heading) * f.speed * dt;
        f.y += Math.sin(f.heading) * f.speed * dt;
        if (f.x < -20) f.x = width + 20;
        else if (f.x > width + 20) f.x = -20;
        if (f.y < -20) f.y = height + 20;
        else if (f.y > height + 20) f.y = -20;
        const glow = 0.55 + 0.45 * Math.sin(t * 0.9 + f.pulse);
        ctx.globalAlpha = 0.45 * glow * level * over(f.x);
        ctx.drawImage(this.glow, f.x - 16, f.y - 16);
      }
    },
  };

  // --- Zakończenie: okno schroniska ---
  const hut = {
    glow: null,
    seed() {
      this.glow ||= sprite(120, "255, 196, 120", 0.04);
    },
    draw(level, dt, t) {
      const narrow = column.left < 110;
      const x = narrow ? width - 36 : column.left / 2;
      const y = height * (narrow ? 0.88 : 0.78);
      const breath = 0.85 + 0.1 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 5.3);
      ctx.globalAlpha = breath * level;
      ctx.drawImage(this.glow, x - 60, y - 60);
    },
  };

  const scenes = [
    { id: "babia-gora", art: snow },
    { id: "gran-paradiso", art: lamps, until: "swit" },   // o świcie świetliki gasną
    { id: "zakonczenie", art: hut },
  ].map((scene) => ({ ...scene, level: 0, target: 0 }));

  // --- Pętla: działa tylko, gdy któraś scena jest widoczna albo wygasa ---
  let frame = 0;
  let last = 0;

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);   // po powrocie do karty bez skoku
    last = now;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    let visible = false;
    for (const scene of scenes) {
      const step = dt / FADE;
      scene.level = scene.target > scene.level
        ? Math.min(scene.target, scene.level + step)
        : Math.max(scene.target, scene.level - step);
      if (scene.level > 0) {
        scene.art.draw(ease(scene.level), dt, now / 1000);
        visible = true;
      }
    }
    ctx.globalAlpha = 1;
    frame = visible || scenes.some((scene) => scene.target) ? requestAnimationFrame(tick) : 0;
  }

  function start() {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    scenes.forEach((scene) => (scene.level = 0));
  }

  function sync() {
    const on = !root.classList.contains("effects-off");
    const { scene: current, step } = root.dataset;
    for (const scene of scenes) {
      scene.target = on && current === scene.id && (!scene.until || step !== scene.until) ? 1 : 0;
    }
    if (!on) return stop();                             // bez efektów — od razu, bez wygaszania
    if (scenes.some((scene) => scene.target || scene.level)) start();
  }

  function measure() {
    ratio = Math.min(2, window.devicePixelRatio || 1);
    height = innerHeight;
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(height * ratio);
    const box = document.querySelector(".chapter")?.getBoundingClientRect();
    column = box ? { left: box.left, right: box.right } : { left: 0, right: innerWidth };
    // Nowe rozmieszczenie tylko przy zmianie szerokości — pasek adresu na telefonie zmienia samą wysokość
    if (innerWidth !== width) {
      width = innerWidth;
      scenes.forEach((scene) => scene.art.seed());
    }
  }

  measure();
  addEventListener("resize", measure);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["class", "data-scene", "data-step"] });
  sync();
})();
