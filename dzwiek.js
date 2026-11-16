/* =========================================================
   Dźwięk eseju: tła rozdziałów i whoosh slajdów wstępu (etap 2, 2026-11-16)
   Wczytuje go script.js dopiero, gdy czytelnik włączy dźwięk (albo przy ?mikser=1).
   Do tej chwili strona nie pobiera ani bajta audio.

   Tła: bezszwowe pętle z assets/audio/tlo/ (wycięte z nagrań autora). Każda gra
   z AudioBuffer, więc pętla zamyka się co do próbki; dekodujemy w 22 050 Hz — szum
   wiatru tego nie słyszy, a pamięć spada o połowę. W pamięci są najwyżej dwie pętle:
   bieżąca i następna (dociągana zawczasu). Zmiana rozdziału: 4 s przenikania.
   Rozdziały bez własnego nagrania na razie milczą (tło gaśnie).

   Mikser: ?mikser=1 w adresie pokazuje prowizoryczny panel głośności każdego dźwięku.
   Ustawienia leżą w localStorage („alpinista:mikser”) jako mnożniki na wierzch POZIOMÓW;
   „kopiuj ustawienia” daje JSON, który wpisujemy na stałe do POZIOMÓW niżej.
   ========================================================= */
(() => {
  const BAZA = document.currentScript && document.currentScript.src ? new URL('.', document.currentScript.src).href : '';

  // rozdział → plik tła (Dolina Pięciu Stawów, Kozi Wierch i Mnich mają jedno wspólne — autor)
  const TLA = {
    wstep: 'wstep', pilsko: 'pilsko',
    'dolina-pieciu-stawow': 'tatry', 'kozi-wierch': 'tatry', mnich: 'tatry',
    marmolada: 'marmolada', everest: 'everest', 'babia-gora': 'babia-gora',
  };
  const NAZWY = {
    wstep: 'Strona główna i wstęp — wiatr', pilsko: 'Pilsko — las', tatry: 'Dolina, Kozi Wierch, Mnich — wiatr',
    marmolada: 'Marmolada — łagodny wiatr', everest: 'Everest — szum pomieszczenia', 'babia-gora': 'Babia Góra — wichura',
  };
  // Poziomy domyślne (mnożniki). Tu wpisujemy wynik z miksera autora.
  const POZIOMY = { grupy: { tla: 1, wstep: 1 }, tla: {}, wstep: { whoosh: 1 } };
  const GLOS_TLA = .8, GLOS_WHOOSH = .45;
  const PRZENIK = 4, WEJSCIE = 2, WYJSCIE = 1.2;

  const KLUCZ = 'alpinista:mikser';
  let MIX = {};
  const wczytajMix = () => { try { MIX = JSON.parse(localStorage.getItem(KLUCZ) || '{}'); } catch { MIX = {}; }
    for (const k of ['grupy', 'tla', 'wstep', 'efekty']) MIX[k] = MIX[k] || {}; };
  wczytajMix();
  const mn = (grupa, k) => (POZIOMY[grupa]?.[k] ?? 1)*(MIX[grupa]?.[k] ?? 1);
  const poziomTla = n => GLOS_TLA*mn('tla', n)*mn('grupy', 'tla');
  const poziomWhoosh = () => GLOS_WHOOSH*mn('wstep', 'whoosh')*mn('grupy', 'wstep');

  // ---------- kontekst: tworzy go script.js w kliknięciu (iOS wymaga gestu) ----------
  let A = null, wyjscie = null, grupaTla = null;
  function kontekst() {
    if (A) return A;
    A = window.alpinistaCtx || new (window.AudioContext || window.webkitAudioContext)();
    window.alpinistaCtx = A;
    wyjscie = A.createGain(); wyjscie.connect(A.destination);
    grupaTla = A.createGain(); grupaTla.connect(wyjscie);
    return A;
  }

  // ---------- pętle ----------
  // Szew po zdekodowaniu: MP3 ma na początku kilkaset próbek rozbiegu, a dekoder ucina koniec
  // o kilka. Ostatnie 80 ms przechodzi więc płynnie we fragment tuż za rozbiegiem, a pętla
  // skacze dokładnie tam — bez stuknięcia.
  function zszyj(b) {
    const sr = b.sampleRate, N = Math.round(sr*.08), d0 = b.getChannelData(0);
    let s = 0; while (s < 6000 && Math.abs(d0[s]) < 1e-4) s++;
    let e = d0.length; while (e > d0.length - 6000 && Math.abs(d0[e - 1]) < 1e-4) e--;
    for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c);
      for (let k = 0; k < N; k++) { const w = k/N*Math.PI/2; d[e - N + k] = d[e - N + k]*Math.cos(w) + d[s + k]*Math.sin(w); } }
    return [(s + N)/sr, e/sr];
  }
  const bufory = new Map();                    // nazwa → Promise<AudioBuffer>
  function bufor(n) {
    if (!bufory.has(n)) bufory.set(n, fetch(`${BAZA}assets/audio/tlo/${n}.mp3`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(dane => new Promise((ok, blad) => {
        // 22 050 Hz: połowa pamięci; starsze Safari znają tylko wersję z callbackiem
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        let dek; try { dek = new OAC(2, 1, 22050); } catch { dek = kontekst(); }
        const p = dek.decodeAudioData(dane, ok, blad); if (p && p.then) p.then(ok, blad);
      }))
      .then(b => { [b.od, b.do] = zszyj(b); return b; })
      .catch(e => { bufory.delete(n); throw e; }));
    return bufory.get(n);
  }
  // w pamięci zostaje tylko to, co gra albo zaraz zagra
  function sprzataj(zostaw) { for (const n of [...bufory.keys()]) if (!zostaw.includes(n) && !sciezki[n]?.zrodlo) bufory.delete(n); }

  const sciezki = {};                          // nazwa → {g, zrodlo, poz, start}
  function sciezka(n) {
    if (sciezki[n]) return sciezki[n];
    const g = A.createGain(); g.gain.value = 0; g.connect(grupaTla);
    return sciezki[n] = {n, g, zrodlo: null, poz: 0, start: 0, gra: false};
  }
  async function graj(n, czas) {
    const t = sciezka(n); t.gra = true;
    let b; try { b = await bufor(n); } catch { return; }      // brak pliku albo sieci: cisza, nie błąd
    if (!t.gra || t.zrodlo) { if (t.gra) glos(t, poziomTla(n), czas); return; }
    const s = A.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = b.od; s.loopEnd = b.do;
    s.connect(t.g);
    const dl = b.do - b.od, od = b.od + ((t.poz % dl) + dl) % dl;   // wraca tam, gdzie skończyła
    s.start(0, od); t.zrodlo = s; t.start = A.currentTime - (od - b.od);
    glos(t, poziomTla(n), czas);
  }
  function cisza(n, czas) {
    const t = sciezki[n]; if (!t) return;
    t.gra = false; glos(t, 0, czas);
    const s = t.zrodlo; if (!s) return;
    setTimeout(() => { if (t.gra || t.zrodlo !== s) return;
      t.poz = A.currentTime - t.start; try { s.stop(); } catch {} s.disconnect(); t.zrodlo = null; }, czas*1000 + 100);
  }
  function glos(t, v, czas) { const g = t.g.gain, now = A.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(v, now + Math.max(.02, czas)); }

  // ---------- który rozdział jest na ekranie ----------
  const sekcje = [document.getElementById('wstep'), ...document.querySelectorAll('.chapter')].filter(Boolean);
  function rozdzial() { let id = 'wstep'; for (const s of sekcje) if (s.getBoundingClientRect().top < innerHeight*.5) id = s.id; return id; }
  const nastepny = id => { const i = sekcje.findIndex(s => s.id === id); for (let j = i + 1; j < sekcje.length; j++) if (TLA[sekcje[j].id] && TLA[sekcje[j].id] !== TLA[id]) return TLA[sekcje[j].id]; return null; };

  let stan = {muzyka: false, dzwieki: false}, teraz = null, solo = null, dociag = 0;
  const wlaczone = () => stan.dzwieki && !document.hidden;

  function wybierz(czas = PRZENIK) {
    const id = rozdzial(), n = solo || (wlaczone() ? TLA[id] || null : null);
    if (n === teraz) return;
    if (teraz) cisza(teraz, czas);
    teraz = n;
    if (n) graj(n, czas);
    // następne tło dociąga się po chwili w tym samym rozdziale — przejście nie czeka na sieć
    clearTimeout(dociag);
    const dalej = nastepny(id);
    sprzataj([n, dalej].filter(Boolean));
    if (dalej && !solo) dociag = setTimeout(() => bufor(dalej).catch(() => {}), 6000);
  }
  // Tło zmienia się dopiero, gdy czytelnik zatrzyma się w rozdziale: skok z menu albo szybkie
  // przewijanie przez kilka rozdziałów nie zapala po drodze tła każdego z nich.
  let zwloka = 0;
  addEventListener('scroll', () => { if (!teraz && !wlaczone() && !solo) return;
    clearTimeout(zwloka); zwloka = setTimeout(() => wybierz(), 700); }, {passive: true});

  // schowana karta milczy; powrót wznawia
  document.addEventListener('visibilitychange', () => { if (!A) return;
    if (document.hidden) { if (teraz) { cisza(teraz, .4); teraz = null; } }
    else wybierz(WEJSCIE); });

  // ---------- whoosh slajdów wstępu: wariant B wybrany przez autora (przechodzący wiatr) ----------
  let szum = null;
  function rozowy() { if (szum) return szum; const n = A.sampleRate*2, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) { const x = Math.random()*2 - 1; b0 = .99886*b0 + x*.0555179; b1 = .99332*b1 + x*.0750759; b2 = .969*b2 + x*.153852;
      b3 = .8665*b3 + x*.3104856; b4 = .55*b4 + x*.5329522; b5 = -.7616*b5 - x*.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x*.5362)*.11; b6 = x*.115926; }
    return szum = b; }
  function whoosh(nizej = 1, t = A.currentTime + .02) {
    const d = 1.3, f0 = 240*nizej, f1 = 720*nizej, s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain();
    const p = A.createStereoPanner ? A.createStereoPanner() : null;
    s.buffer = rozowy(); f.type = 'bandpass'; f.Q.value = .7;
    s.connect(f).connect(g); if (p) { g.connect(p).connect(wyjscie); p.pan.setValueAtTime(-.3, t); p.pan.linearRampToValueAtTime(.3, t + d); } else g.connect(wyjscie);
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d*.5); f.frequency.exponentialRampToValueAtTime(f0*1.2, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(poziomWhoosh(), t + d*.5); g.gain.linearRampToValueAtTime(0, t + d);
    s.start(t, Math.random()*.7); s.stop(t + d + .1);
  }
  addEventListener('intro:slajd', e => { if (A && wlaczone()) whoosh([1, .92, .84][e.detail?.nr] ?? 1); });

  // ---------- dźwięki efektów: osobny moduł, wczytywany przy pierwszym włączeniu „Dźwięków” ----------
  let modulEfektow = null;
  function efekty() {
    if (!modulEfektow) modulEfektow = new Promise((ok, blad) => {
      const s = document.createElement('script');
      s.src = document.body.dataset.dzwiekiEfektowJs || `${BAZA}dzwieki-efektow.js`;
      s.onload = ok; s.onerror = blad; document.head.append(s);
    });
    return modulEfektow;
  }
  // Tło rozdziału na chwilę cichnie pod dźwiękiem efektu — efekt ma być wyraźny, a tło nie ma
  // się z nim kłócić. Wraca łagodnie po sekundzie.
  addEventListener('dzwiek:efekt', e => { if (!A || !grupaTla) return;
    const g = grupaTla.gain, now = A.currentTime, czas = e.detail?.czas ?? 3;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(.45, now + .25); g.setValueAtTime(.45, now + czas); g.linearRampToValueAtTime(1, now + czas + 1.2); });

  // ---------- API dla script.js ----------
  window.Dzwiek = {
    // podgląd stanu do sprawdzania w konsoli: co gra i co jest w pamięci
    stan: () => ({teraz, solo, kontekst: A?.state, wPamieci: [...bufory.keys()],
      graja: Object.values(sciezki).filter(t => t.zrodlo).map(t => `${t.n} ${t.g.gain.value.toFixed(2)}`)}),
    ustaw(nowy) {
      stan = {...nowy};
      if (stan.dzwieki) efekty().then(() => window.Dzwieki?.wlacz(true)).catch(() => {});
      else window.Dzwieki?.wlacz(false);
      if (!stan.dzwieki && !solo && !A) return;            // nic nie gra i nic nie zagra
      kontekst(); if (A.state === 'suspended') A.resume();
      wybierz(stan.dzwieki ? WEJSCIE : WYJSCIE);
    },
  };

  // ---------- mikser (?mikser=1) ----------
  addEventListener('storage', e => { if (e.key === KLUCZ) { wczytajMix(); odswiezPoziomy(); } });
  function odswiezPoziomy() { if (A && teraz && sciezki[teraz]?.gra) glos(sciezki[teraz], poziomTla(teraz), .1); }

  if (new URLSearchParams(location.search).has('mikser')) {
    const panel = document.createElement('aside');
    panel.className = 'mikser';
    panel.setAttribute('aria-label', 'Mikser dźwięków (roboczy)');
    panel.innerHTML = `<style>
      .mikser { position: fixed; right: 12px; bottom: 12px; z-index: 200; width: min(380px, calc(100vw - 24px)); max-height: 70vh; overflow: auto;
        padding: 12px 14px; border: 1px solid var(--rule); border-radius: 10px; background: var(--bg); color: var(--text);
        font: 12px/1.4 var(--mono, monospace); box-shadow: 0 8px 30px rgba(0,0,0,.35); }
      .mikser h3 { margin: 10px 0 4px; font: inherit; letter-spacing: .1em; text-transform: uppercase; color: var(--text-quiet); }
      .mikser .mk-w { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; padding: 5px 0; border-top: 1px solid color-mix(in srgb, var(--rule) 50%, transparent); }
      .mikser .mk-w input { grid-column: 1 / -1; width: 100%; accent-color: var(--accent); }
      .mikser output { color: var(--text-quiet); } .mikser output.mk-z { color: var(--accent); }
      .mikser button { font: inherit; color: var(--text); background: none; border: 1px solid var(--rule); border-radius: 999px; padding: 3px 10px; cursor: pointer; }
      .mikser button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
      .mikser .mk-gora { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .mikser .mk-gora b { margin-right: auto; } .mikser.mk-zwiniety .mk-tresc { display: none; }
      .mikser textarea { width: 100%; height: 90px; margin-top: 6px; font: inherit; background: none; color: var(--text); border: 1px solid var(--rule); }
    </style>
    <div class="mk-gora"><b>Mikser</b><button data-a="kopiuj">kopiuj</button><button data-a="zeruj">na 1,00</button><button data-a="zwin">zwiń</button></div>
    <div class="mk-tresc"><p style="margin:6px 0 0;color:var(--text-quiet)">Suwak to mnożnik: 1,00 = obecny poziom. „Słuchaj” gra tło bez względu na rozdział, „graj” — dźwięk efektu bez obrazu.</p>
    <div class="mk-lista"></div><textarea hidden readonly></textarea></div>`;
    document.body.append(panel);
    const lista = panel.querySelector('.mk-lista');
    const zapisz = () => { try { localStorage.setItem(KLUCZ, JSON.stringify(MIX)); } catch {} odswiezPoziomy(); window.Dzwieki?.ustaw(MIX); };
    const wiersze = [];
    function wiersz(grupa, k, nazwa, akcja) {
      const w = document.createElement('div'); w.className = 'mk-w';
      w.innerHTML = '<span></span><span class="mk-p"></span><input type="range" min="0" max="3" step="0.05"><output></output>';
      w.firstChild.textContent = nazwa;
      const suw = w.querySelector('input'), out = w.querySelector('output');
      suw.setAttribute('aria-label', 'Głośność: ' + nazwa);
      const pokaz = () => { const v = MIX[grupa][k] ?? 1; suw.value = v; out.textContent = '×' + v.toFixed(2); out.classList.toggle('mk-z', v !== 1); };
      suw.addEventListener('input', () => { MIX[grupa][k] = +suw.value; pokaz(); zapisz(); });
      if (akcja) { const b = document.createElement('button'); b.type = 'button'; b.textContent = akcja[0]; b.addEventListener('click', () => akcja[1](b)); w.querySelector('.mk-p').append(b); }
      pokaz(); wiersze.push(pokaz); lista.append(w);
    }
    const naglowek = t => { const h = document.createElement('h3'); h.textContent = t; lista.append(h); };
    naglowek('Grupy');
    wiersz('grupy', 'tla', 'Tła rozdziałów');
    wiersz('grupy', 'wstep', 'Whoosh wstępu');
    wiersz('grupy', 'efekty', 'Dźwięki efektów');
    naglowek('Tła');
    for (const n of Object.keys(NAZWY)) wiersz('tla', n, NAZWY[n], ['słuchaj', b => {
      kontekst(); A.resume();
      solo = solo === n ? null : n;
      panel.querySelectorAll('[data-solo]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.dataset.solo = n; b.setAttribute('aria-pressed', String(solo === n));
      wybierz(1.5);
    }]);
    naglowek('Wstęp');
    wiersz('wstep', 'whoosh', 'Whoosh slajdów (3 podmuchy)', ['test', () => { kontekst(); A.resume();
      const t = A.currentTime + .05; [1, .92, .84].forEach((n, i) => whoosh(n, t + i*2.5)); }]);
    // dźwięki efektów: lista z modułu (wczytuje się od razu w trybie miksera)
    const OPIS = {
      blysk: 'Wstęp — błysk i grzmot', dlugo: 'Pilsko — czy długo jeszcze', drzenie: 'Dolina — moje dłonie', odpadasz: 'Mnich — odpadasz',
      ruch: 'Mnich — zrób ruch', puf: 'Marmolada — puf', tlen: 'Everest — tlen', kadr: 'Everest — poza kadrem', oszus: 'Everest — oszus',
      zamiec: 'Babia Góra — zamieć', szron: 'Babia Góra — szron', czolowka: 'Babia Góra — czołówka', test: 'Rysy — test', shipit: 'Rysy — ship it',
      swietliki: 'Gran Paradiso — świetliki', szczelina: 'Gran Paradiso — szczelina', burza: 'Gran Paradiso — burza', enter: 'Gran Paradiso — enter',
      most: 'Skalka — most', wiatr: 'Grossglockner — wiatr', lawinki: 'Grossglockner — lawinki', brocken: 'Grossglockner — widmo Brockenu',
      dwa: 'Mont Blanc — dwa świetliki', choinka: 'Mont Blanc — choinka', oczami: 'Mont Blanc — jego oczami', kamienie: 'Mont Blanc — kamienie',
      bidon: 'Mont Blanc — bidon', cyk: 'refren — cyk', klik: 'refren — klik', wtf: 'refren — WTF', 'wtf-stary': 'refren — WTF (Orla Perć)',
    };
    efekty().then(() => {
      window.Dzwieki?.ustaw(MIX);
      naglowek('Efekty');
      const lista = (window.Dzwieki?.lista() || []).filter(n => OPIS[n]).sort((a, b) => OPIS[a].localeCompare(OPIS[b], 'pl'));
      for (const n of lista) wiersz('efekty', n, OPIS[n], ['graj', () => { kontekst(); A.resume(); window.Dzwieki.graj(n); }]);
    }).catch(() => {});
    panel.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'zwin') { panel.classList.toggle('mk-zwiniety'); e.target.textContent = panel.classList.contains('mk-zwiniety') ? 'rozwiń' : 'zwiń'; }
      if (a === 'zeruj') { MIX = {grupy: {}, tla: {}, wstep: {}, efekty: {}}; zapisz(); wiersze.forEach(f => f()); }
      if (a === 'kopiuj') { const tx = panel.querySelector('textarea'), json = JSON.stringify(MIX);
        tx.hidden = false; tx.value = json; tx.select();
        try { await navigator.clipboard.writeText(json); e.target.textContent = 'skopiowane'; } catch { e.target.textContent = 'Ctrl+C'; } }
    });
  }
})();
