/* =========================================================
   Nie każdy, kto był na szczycie, jest alpinistą
   Pasek postępu, aktywny punkt trasy w spisie,
   zapamiętywanie miejsca czytania, kopiowanie z linkiem,
   efekty „cyk”, „klik”, „WTF” i „Enter” na kliknięcie.
   Bez tego pliku strona działa: znika pasek, podświetlenie, powrót,
   przycisk kopiowania i efekty — zostaje tekst i spis rozdziałów.
   ========================================================= */

(() => {
  const TITLE = "Nie każdy, kto był na szczycie, jest alpinistą";

  const article = document.querySelector("article");
  const bar = document.querySelector(".progress");
  const intro = document.getElementById("wstep");
  const sections = [intro, ...document.querySelectorAll(".chapter")].filter(Boolean);
  const links = new Map(
    [...document.querySelectorAll(".profile-nav a")].map((a) => [a.hash.slice(1), a])
  );
  // pozycja każdego punktu na osi — do wypełniania minionych punktów
  const order = new Map(sections.map((section, i) => [section.id, i]));

  const PLACE_KEY = "alpinista:miejsce";   // localStorage: rozdział + miejsce w nim
  const SAVE_EVERY = 1000;                 // zapis najwyżej raz na sekundę
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let current = null;
  let queued = false;
  let lastSave = 0;
  let resume = null;                       // pasek „wróć tam”, jeśli jest pokazany
  let lastY = window.scrollY;              // kierunek przewijania (górny pasek)

  function update() {
    queued = false;
    const vh = window.innerHeight;

    // Postęp czytania: od początku do końca artykułu
    const box = article.getBoundingClientRect();
    const span = box.height - vh;
    const progress = span > 0 ? Math.min(1, Math.max(0, -box.top / span)) : 1;
    bar.style.transform = `scaleX(${progress})`;

    // Aktywny punkt trasy: ostatnia część, której początek minął górną trzecią ekranu
    let active = null;
    let index = -1;
    for (const [i, section] of sections.entries()) {
      if (section.getBoundingClientRect().top > vh / 3) break;
      active = section.id;
      index = i;
    }

    // Oś spisu liczy w skali punktów, nie znaków: dochodzi do punktu rozdziału, gdy ten się zaczyna,
    // i przesuwa się do następnego w miarę czytania. Punkty są równo rozstawione, rozdziały nie są.
    let read = 0;
    if (index >= 0) {
      const box = sections[index].getBoundingClientRect();
      const part = Math.min(1, Math.max(0, (vh / 3 - box.top) / Math.max(1, box.height)));
      read = Math.min(1, (index + part) / Math.max(1, sections.length - 1));
    }
    document.documentElement.style.setProperty("--read", read.toFixed(4));
    links.forEach((link, id) => link.classList.toggle("is-passed", order.get(id) <= index));

    // Spis pojawia się od startu — ekran tytułowy zostaje czysty
    document.documentElement.classList.toggle("nav-on", active !== null);

    if (active !== current) {
      links.get(current)?.removeAttribute("aria-current");
      links.get(active)?.setAttribute("aria-current", "location");
      current = active;
    }

    // Górny pasek: nad intro zawsze widoczny; w tekście chowa się przy przewijaniu w dół
    // i wraca przy przewijaniu w górę — nie zasłania czytanego wiersza.
    const y = window.scrollY;
    const wTekscie = active !== null;
    const wDol = y > lastY + 4, wGore = y < lastY - 4;
    if (!wTekscie || wGore) document.documentElement.classList.remove("tb-schowany");
    else if (wDol && !menuOpen()) document.documentElement.classList.add("tb-schowany");
    if (wDol || wGore) lastY = y;

    // Miejsce czytania: zapisujemy tylko rozdziały (powrót do wstępu nie kasuje miejsca)
    const now = performance.now();
    if (active && active !== intro?.id && now - lastSave > SAVE_EVERY) {
      savePlace(active);
      lastSave = now;
    }
    if (resume && window.scrollY > 300) hideResume();
  }

  function queueUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  // Pamięć wyboru: w prywatnym oknie po prostu nie zapisujemy
  function remember(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch {
      // bez pamięci wybór działa do końca wizyty
    }
    return value;
  }

  // Efekty: przełącznik „wyłącz efekty” usunięty (autor, 2026-11-14) — efekty uruchamia
  // sam czytelnik kliknięciem. Zostaje tylko systemowe „ogranicz ruch”.
  function effectsEnabled() {
    return !reduceMotion.matches;
  }

  // --- Zapamiętywanie miejsca ---
  // Zapisujemy rozdział i ułamek jego wysokości, a nie piksele —
  // miejsce zgadza się też na innym ekranie i po zmianie szerokości okna.

  function savePlace(id) {
    const box = document.getElementById(id).getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, -box.top / box.height));
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify({ id, fraction: Number(fraction.toFixed(4)) }));
    } catch {
      // prywatne okno albo zablokowana pamięć — po prostu nie pamiętamy
    }
  }

  function readPlace() {
    try {
      return JSON.parse(localStorage.getItem(PLACE_KEY));
    } catch {
      return null;
    }
  }

  function goTo(place) {
    const section = document.getElementById(place.id);
    const box = section.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + box.top + place.fraction * box.height, behavior: "instant" });
  }

  // Dyskretny pasek na dole: bez modala, bez wymuszania, można zignorować.
  // Nie pokazujemy go, gdy ktoś wszedł linkiem do rozdziału albo doczytał do końca.
  function offerResume() {
    const place = readPlace();
    if (!place || place.id === intro?.id || location.hash || window.scrollY > 200) return;
    const section = document.getElementById(place.id);
    if (!section) return;
    // kto doczytał ostatni rozdział prawie do końca, nie potrzebuje zaproszenia z powrotem
    if (section === sections.at(-1) && place.fraction > 0.8) return;

    // z atrybutów, nie z nagłówka: w nagłówku stoi „1. Pilsko”, a licznika „z 12” już tam nie ma
    const number = section.dataset.numer;
    const name = section.dataset.nazwa;

    resume = document.createElement("div");
    resume.className = "resume";
    resume.setAttribute("role", "region");
    resume.setAttribute("aria-label", "Powrót do miejsca czytania");

    const text = document.createElement("span");
    text.textContent = `czytałeś do rozdziału ${number} · ${name}`;

    const link = document.createElement("a");
    link.href = `#${place.id}`;
    link.textContent = "wróć tam";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      hideResume();
      goTo(place);
    });

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Zamknij");
    close.textContent = "×";
    close.addEventListener("click", hideResume);

    resume.append(text, link, close);
    document.body.append(resume);
  }

  function hideResume() {
    resume?.remove();
    resume = null;
  }

  // --- Czyste kopiowanie ---
  // Do schowka trafia sam tekst: bez numerów rozdziałów, metadanych, stopek,
  // odnośników do przypisów, spisu i napisów w tle. Twarde spacje → zwykłe.

  const NOT_COPIED =
    ".chapter-meta, .chapter-end, .fn-ref, .fn-num, .fn-back, " +
    ".profile-nav, .resume, .copy-bar";

  function cleanText(range) {
    const holder = document.createElement("div");
    holder.className = "copy-holder";   // poza ekranem, ale z tymi samymi stylami akapitów
    holder.append(range.cloneContents());
    holder.querySelectorAll(NOT_COPIED).forEach((node) => node.remove());
    article.append(holder);
    const text = holder.innerText;
    holder.remove();
    return text
      .replace(/ /g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  document.addEventListener("copy", (event) => {
    const selection = getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!article.contains(range.commonAncestorContainer)) return;
    event.clipboardData.setData("text/plain", cleanText(range));
    event.preventDefault();
  });

  // --- Zaznacz i skopiuj z linkiem ---
  // Po zaznaczeniu fragmentu nad nim pojawia się mały przycisk. Schowek dostaje:
  //   „zaznaczony tekst”
  //
  //   — Nie każdy, kto był na szczycie, jest alpinistą
  //   domena/rozdzial/
  // Link prowadzi do strony rozdziału (z własnym podglądem), która przenosi do #rozdzialu.

  const copyBar = document.createElement("div");
  copyBar.className = "copy-bar";
  copyBar.hidden = true;
  const copyButton = document.createElement("button");
  const imageButton = document.createElement("button");
  copyButton.type = imageButton.type = "button";
  copyButton.textContent = "kopiuj z linkiem";
  imageButton.textContent = "obraz";
  imageButton.setAttribute("aria-label", "Zapisz cytat jako obraz");
  copyBar.append(copyButton, imageButton);
  document.body.append(copyBar);

  let quote = null;          // { text, section }
  let selectionTimer = 0;

  function sectionOf(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest(".intro, .chapter") ?? null;
  }

  function placeCopyButton() {
    const selection = getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return hideCopyButton();
    const range = selection.getRangeAt(0);
    const section = sectionOf(range.commonAncestorContainer);
    if (!section) return hideCopyButton();
    const text = cleanText(range);
    if (text.length < 3) return hideCopyButton();

    quote = { text, section };
    const rect = range.getBoundingClientRect();
    const below = rect.top < 60;          // przy górnej krawędzi — pod zaznaczeniem
    copyButton.textContent = "kopiuj z linkiem";
    copyBar.classList.toggle("is-below", below);
    copyBar.style.left = `${Math.min(Math.max(rect.left + rect.width / 2, 80), innerWidth - 80)}px`;
    copyBar.style.top = `${window.scrollY + (below ? rect.bottom + 10 : rect.top - 10)}px`;
    copyBar.hidden = false;
  }

  function hideCopyButton() {
    copyBar.hidden = true;
    quote = null;
  }

  function chapterLink(section) {
    const url = section.id === intro?.id
      ? new URL("./", document.baseURI)
      : new URL(`${section.id}/`, document.baseURI);
    return url.href.replace(/^https?:\/\//, "");
  }

  // Zaznaczenie nie znika przy kliknięciu w przycisk
  copyBar.addEventListener("pointerdown", (event) => event.preventDefault());
  copyButton.addEventListener("click", async () => {
    if (!quote) return;
    const text = `„${quote.text}”\n\n— ${TITLE}\n${chapterLink(quote.section)}`;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "skopiowano";
    } catch {
      copyButton.textContent = "nie udało się skopiować";
    }
    setTimeout(hideCopyButton, 1200);
  });


  // --- Cytat jako obraz ---
  // Karta 1200×630 rysowana w przeglądarce: cytat, tytuł i adres. Nic nie wychodzi na serwer.
  // Na telefonie idzie do okna udostępniania, na komputerze zapisuje się jako plik.
  const CARD_W = 1200;
  const CARD_H = 630;

  function cardColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      bg: style.getPropertyValue("--bg").trim() || "#16191c",
      text: style.getPropertyValue("--text-strong").trim() || "#f7f3ea",
      quiet: style.getPropertyValue("--text-quiet").trim() || "#ada79c",
      accent: style.getPropertyValue("--accent").trim() || "#ff6250",
      serif: style.getPropertyValue("--serif").trim(),
      mono: style.getPropertyValue("--mono").trim(),
    };
  }

  function wrap(ctx, text, maxWidth, maxLines) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines) return [lines, true];
      } else {
        line = candidate;
      }
    }
    lines.push(line);
    return [lines, false];
  }

  async function quoteCard(text, section) {
    await document.fonts.ready;
    const colors = cardColors();
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const pad = 76;
    let size = 44;
    let lines;
    let cut;
    do {
      ctx.font = `${size}px ${colors.serif}`;
      [lines, cut] = wrap(ctx, `„${text}”`, CARD_W - pad * 2, 7);
      if (!cut) break;
      size -= 4;
    } while (size > 26);

    ctx.fillStyle = colors.text;
    ctx.textBaseline = "alphabetic";
    const lineHeight = size * 1.45;
    let y = (CARD_H - lines.length * lineHeight) / 2 + size;
    for (const line of lines) {
      ctx.fillText(cut && line === lines.at(-1) ? `${line}…` : line, pad, y);
      y += lineHeight;
    }

    // stopka karty: kreska akcentu, tytuł i adres
    ctx.fillStyle = colors.accent;
    ctx.fillRect(pad, CARD_H - 104, 56, 2);
    ctx.fillStyle = colors.text;
    ctx.font = `22px Anton, ${colors.mono}`;
    ctx.fillText(TITLE.toUpperCase(), pad, CARD_H - 62);
    ctx.fillStyle = colors.quiet;
    ctx.font = `17px ${colors.mono}`;
    ctx.fillText(chapterLink(section), pad, CARD_H - 34);
    return canvas;
  }

  imageButton.addEventListener("click", async () => {
    if (!quote) return;
    imageButton.textContent = "rysuję…";
    const canvas = await quoteCard(quote.text, quote.section);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
    const file = new File([blob], "cytat.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        // zamknięte okno udostępniania — nic się nie dzieje
      }
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cytat.png";
      link.click();
      URL.revokeObjectURL(url);
    }
    imageButton.textContent = "obraz";
    setTimeout(hideCopyButton, 600);
  });

  document.addEventListener("selectionchange", () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(placeCopyButton, 150);
  });

  // --- Efekty na kliknięcie ---
  // Zapalniki w tekście (<button data-fx>) uruchamiają efekty z efekty.js: silnik wczytuje
  // się dopiero przy pierwszym kliknięciu, bo to 40 kB, a większość czytelników go nie użyje.
  // Wyjątek: „WTF” ze Ściany na Orlej Perci zostaje przy dotychczasowym, prostym efekcie —
  // to ludzkie zdziwienie, a nie błąd maszyny.
  // Szarpnięcie i rozsypanie najwyżej raz na 1,5 s — poniżej progu trzech błysków na sekundę.

  const FLASH_GAP = 1500;
  let lastFlash = -Infinity;

  function flashAllowed() {
    const now = performance.now();
    if (now - lastFlash < FLASH_GAP) return false;
    lastFlash = now;
    return true;
  }

  function restart(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;                 // restart animacji
    node.classList.add(className);
  }

  function glitch(word) {
    if (!flashAllowed()) return;
    restart(word, "is-glitching");
    // Tekst szarpie się wokół środka ekranu, nie środka całego (bardzo wysokiego) artykułu
    article.style.transformOrigin = `50% ${window.scrollY + innerHeight / 2 - article.offsetTop}px`;
    restart(article, "is-shaken");
  }

  // Silnik efektów: wczytywany raz, przy pierwszym użyciu. Zwraca obietnicę gotowości.
  let silnik = null;

  function wczytajEfekty() {
    if (silnik) return silnik;
    const { efektyJs, efektyCss } = document.body.dataset;
    silnik = new Promise((gotowe, blad) => {
      const arkusz = document.createElement("link");
      arkusz.rel = "stylesheet";
      arkusz.href = efektyCss;
      document.head.append(arkusz);
      const skrypt = document.createElement("script");
      skrypt.src = efektyJs;
      skrypt.onload = gotowe;
      skrypt.onerror = blad;
      document.head.append(skrypt);
    });
    return silnik;
  }

  function uruchomEfekt(button, ev) {
    wczytajEfekty().then(() => window.Efekty?.uruchom(button, ev)).catch(() => {
      // bez silnika zapalnik zostaje zwykłym tekstem — nic się nie dzieje
    });
  }

  // Podpowiedź przy pierwszym zapalniku eseju: kropkowana kreska wygląda jak odnośnik do
  // słowniczka i nikt nie wie, że to się klika. Dopisek „kliknij” pojawia się raz, gdy
  // fraza wjedzie na ekran, i znika na dobre po pierwszym uruchomieniu dowolnego efektu.
  const PODPOWIEDZ = "alpinista:zapalnik";
  let podpowiedz = null;
  const zapalnikUzyty = () => {
    podpowiedz?.classList.remove("fx-podpowiedz");
    podpowiedz = null;
    try { localStorage.setItem(PODPOWIEDZ, "1"); } catch { /* bez pamięci dopisek wróci przy następnej wizycie */ }
  };
  (() => {
    let widziana = false;
    try { widziana = localStorage.getItem(PODPOWIEDZ) === "1"; } catch { /* jw. */ }
    const pierwszy = article.querySelector('[data-fx][role="button"]');
    if (widziana || !pierwszy || !effectsEnabled()) return;
    new IntersectionObserver(([wpis], obserwator) => {
      if (!wpis.isIntersecting) return;
      obserwator.disconnect();
      podpowiedz = pierwszy;
      pierwszy.classList.add("fx-podpowiedz");
    }, { rootMargin: "-25% 0px -25% 0px" }).observe(pierwszy);
  })();

  article.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fx]");
    if (!button || !effectsEnabled() || !getSelection().isCollapsed) return;
    zapalnikUzyty();
    if (button.dataset.fx === "wtf-stary") glitch(button);
    else uruchomEfekt(button, event);
  });

  // Zapalnik jest tekstem z rolą przycisku (build.py), więc klawiaturę obsługujemy sami:
  // Enter i spacja na zapalniku z fokusem działają jak kliknięcie.
  article.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const button = event.target.closest?.('[data-fx][role="button"]');
    if (!button || button !== event.target) return;
    event.preventDefault();
    event.stopPropagation();
    if (!effectsEnabled()) return;
    zapalnikUzyty();
    if (button.dataset.fx === "wtf-stary") glitch(button);
    else uruchomEfekt(button);
  });

  // Prawdziwy klawisz Enter uruchamia „Enter.”, gdy fraza jest w środku ekranu i nic nie ma fokusu
  addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !effectsEnabled()) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    const button = document.querySelector('[data-fx="enter"]');
    if (!button) return;
    const box = button.getBoundingClientRect();
    if (box.top < innerHeight * 0.15 || box.bottom > innerHeight * 0.85) return;
    event.preventDefault();
    uruchomEfekt(button);
  });

  // --- Profil trasy i spis: jedno zaznaczenie ---
  // Najechanie na wiersz spisu podświetla szczyt na rysunku i odwrotnie — bez tego
  // rysunek i lista są dwiema osobnymi rzeczami o tym samym.
  const profil = document.querySelector(".profil");
  if (profil) {
    const szczyty = new Map([...profil.querySelectorAll(".profil-szczyt")].map(a => [a.hash, a]));
    for (const link of document.querySelectorAll(".route ol a")) {
      const szczyt = szczyty.get(link.hash);
      if (!szczyt) continue;
      const przelacz = (on) => () => szczyt.classList.toggle("is-on", on);
      link.addEventListener("pointerenter", przelacz(true));
      link.addEventListener("pointerleave", przelacz(false));
      link.addEventListener("focus", przelacz(true));
      link.addEventListener("blur", przelacz(false));
    }
  }

  // --- Menu: spis treści i ustawienia na pełnym ekranie ---
  // Zastępuje okrągły przycisk trasy w rogu i panel od dołu (autor, 2026-11-14).
  // Ikona menu zamienia się w ×; Esc i kliknięcie w rozdział zamykają; fokus nie ucieka.
  const menu = document.getElementById("menu");
  const menuButton = document.querySelector(".tb-menu");
  const menuOpen = () => menuButton?.getAttribute("aria-expanded") === "true";

  function setMenu(open) {
    if (!menu || open === menuOpen()) return;
    setDownloads(false);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Zamknij menu" : "Spis treści i ustawienia");
    document.documentElement.classList.toggle("menu-open", open);
    menu.hidden = !open;
    if (open) {
      updateProfil();
      document.documentElement.classList.remove("tb-schowany");
      const link = menu.querySelector(`.route a[href="#${current}"]`) ?? menu.querySelector(".route a");
      link?.focus({ preventScroll: true });
    } else {
      menuButton.focus({ preventScroll: true });
    }
  }

  // --- Profil trasy w menu: „jesteś tutaj”, przebyta grań, ile zostało ---
  // Oś pozioma rysunku to czas czytania (build.py), więc położenie w rozdziale przekłada
  // się wprost na miejsce na grani. Bez czytania: ostatnio zapamiętane miejsce.
  const profilMenu = menu?.querySelector(".profil");
  function updateProfil() {
    if (!profilMenu) return;
    const odcinki = JSON.parse(profilMenu.dataset.odcinki);
    const razem = Number(profilMenu.dataset.razem);
    const tu = profilMenu.querySelector(".profil-tu");
    const rect = profilMenu.querySelector(".profil-przebyte");
    let id = current, frakcja = 0;
    if (id) {
      const box = document.getElementById(id).getBoundingClientRect();
      frakcja = Math.min(1, Math.max(0, (innerHeight / 3 - box.top) / Math.max(1, box.height)));
    } else {
      const miejsce = readPlace();
      if (miejsce && odcinki[miejsce.id]) {
        id = miejsce.id;
        frakcja = miejsce.fraction;
      }
    }
    profilMenu.querySelectorAll(".profil-szczyt.is-tu").forEach((a) => a.classList.remove("is-tu"));
    // To samo na liście „Trasa”: przeczytane rozdziały przygasają, bieżący dostaje kropkę.
    // Stan musi być widać także przy myszy i dotyku — sam fokus widać tylko z klawiatury.
    const klucze = Object.keys(odcinki);
    const gdzie = id ? klucze.indexOf(id) : -1;
    for (const link of menu.querySelectorAll(".route ol a")) {
      const nr = klucze.indexOf(link.hash.slice(1));
      link.classList.toggle("is-za", gdzie > -1 && nr > -1 && nr < gdzie);
      link.classList.toggle("is-tu", gdzie > -1 && nr === gdzie);
      if (gdzie > -1 && nr === gdzie) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    if (!id || !odcinki[id]) {
      tu.hidden = true;
      rect.setAttribute("width", 0);
      return;
    }
    const [od, doX] = odcinki[id];
    const x = od + (doX - od) * frakcja;
    let przed = 0;
    for (const [klucz, [, , min]] of Object.entries(odcinki)) {
      if (klucz === id) { przed += min * frakcja; break; }
      przed += min;
    }
    const zostalo = Math.round(razem - przed);
    rect.setAttribute("width", x.toFixed(1));
    profilMenu.querySelector(`.profil-szczyt[href="#${id}"]`)?.classList.add("is-tu");
    // Miejsce widać na grani (czerwień i kropka) — podpis mówi tylko, ile zostało (autor)
    tu.textContent = `do końca drogi ok. ${zostalo} min`;
    tu.hidden = zostalo <= 0;
  }

  menuButton?.addEventListener("click", () => setMenu(!menuOpen()));
  menu?.addEventListener("click", (event) => {
    if (event.target.closest("a[href^='#']")) setMenu(false);
  });
  // Tab krąży między menu a przyciskiem zamknięcia — nie wpada w tekst pod spodem
  addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !menuOpen()) return;
    const items = [menuButton, ...menu.querySelectorAll("a[href], button:not([disabled])")];
    const at = items.indexOf(document.activeElement);
    const next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at + 1) % items.length;
    event.preventDefault();
    items[next].focus();
  });

  // --- Pobieranie: mała lista pod ikoną ---
  const dlButton = document.getElementById("tb-pobierz");
  const dlList = document.getElementById("pobierz");
  function setDownloads(open) {
    if (!dlButton) return;
    dlButton.setAttribute("aria-expanded", String(open));
    dlList.hidden = !open;
  }
  dlButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    setDownloads(dlList.hidden);
  });
  document.addEventListener("click", (event) => {
    if (dlList && !dlList.hidden && !event.target.closest(".tb-pobierz")) setDownloads(false);
  });

  addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (dlList && !dlList.hidden) { setDownloads(false); dlButton.focus(); }
    else setMenu(false);
  });

  // --- Czytanie: stopień pisma i motyw ---
  // Trzy stopnie pisma i jasny/ciemny. Wybór pamiętany; bez wyboru decyduje system.
  // Motyw ustawia też skrypt w nagłówku dokumentu, żeby strona nie mignęła ciemnym tłem.
  const SIZE_KEY = "alpinista:stopien";
  const THEME_KEY = "alpinista:motyw";
  const SIZES = [0.92, 1, 1.12];

  // Słońce i księżyc (Lucide, ISC) — wklejone w kod, bez pobierania biblioteki
  const ICONS = `<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>
      <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/>
      <path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
    <svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

  const themeButtons = [];

  function themeButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.innerHTML = ICONS;
    button.addEventListener("click", () =>
      setTheme(document.documentElement.dataset.theme === "jasny" ? "ciemny" : "jasny"));
    themeButtons.push(button);
    return button;
  }

  const reader = document.createElement("div");
  reader.className = "reader";
  const smaller = document.createElement("button");
  const bigger = document.createElement("button");
  smaller.type = bigger.type = "button";
  smaller.textContent = "A−";
  bigger.textContent = "A+";
  smaller.setAttribute("aria-label", "Mniejszy tekst");
  bigger.setAttribute("aria-label", "Większy tekst");

  // Ustawienia mieszkają w menu: dwa wiersze, nazwa i przyciski (autor, 2026-11-14)
  const opcje = document.querySelector(".menu-opcje");
  function opcja(nazwa, ...przyciski) {
    const wiersz = document.createElement("div");
    wiersz.className = "opcja";
    const etykieta = document.createElement("span");
    etykieta.className = "opcja-nazwa";
    etykieta.textContent = nazwa;
    const grupa = document.createElement("div");
    grupa.className = "reader";
    grupa.append(...przyciski);
    wiersz.append(etykieta, grupa);
    return wiersz;
  }
  reader.replaceChildren();
  opcje?.append(opcja("Rozmiar tekstu", smaller, bigger), opcja("Motyw", themeButton()));

  let size = Number(remember(SIZE_KEY) ?? 1);

  function setSize(next) {
    size = Math.min(SIZES.length - 1, Math.max(0, next));
    document.documentElement.style.setProperty("--fs-scale", SIZES[size]);
    smaller.disabled = size === 0;
    bigger.disabled = size === SIZES.length - 1;
    remember(SIZE_KEY, String(size));
  }

  function setTheme(next) {
    document.documentElement.dataset.theme = next;
    // pasek adresu na telefonie idzie za motywem strony, a nie za ustawieniem systemu
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.content = next === "jasny" ? "#eceeef" : "#16191c";
    // intro kończy się mgłą w kolorze tła — po zmianie motywu musi wziąć nowe --bg
    dispatchEvent(new Event("theme-change"));
    const label = next === "jasny" ? "Tryb ciemny" : "Tryb jasny";
    for (const button of themeButtons) {
      button.setAttribute("aria-label", label);
      button.dataset.tip = label.toLowerCase();
    }
    remember(THEME_KEY, next);
  }

  smaller.addEventListener("click", () => setSize(size - 1));
  bigger.addEventListener("click", () => setSize(size + 1));
  setSize(size);
  setTheme(document.documentElement.dataset.theme || "ciemny");

  // --- Wybór we wstępie ---
  // „Idziesz dalej?” — dwa przyciski, jedna decyzja. Oba zakończenia są w HTML od
  // początku (bez JS widać je razem), tutaj tylko odsłaniamy wybrane i zamykamy wybór.
  // Decyzja nie jest zapamiętywana: nowa wizyta zaczyna się tym samym pytaniem.

  const wybor = document.querySelector(".wybor");
  if (wybor) {
    const opcje = [...wybor.querySelectorAll(".wybor-opcja")];
    wybor.addEventListener("click", (event) => {
      const przycisk = event.target.closest(".wybor-opcja");
      if (!przycisk || przycisk.disabled) return;
      const odp = document.getElementById(przycisk.getAttribute("aria-controls"));
      odp?.classList.add("jest");
      document.querySelector(".wybor-dalej")?.classList.add("jest");
      przycisk.setAttribute("aria-expanded", "true");
      for (const o of opcje) o.disabled = true;
    });
  }

  // --- Muzyka do czytania (Scott Buckley, CC BY 4.0) ---
  // Trzy zasady, w tej kolejności: nic nie gra samo, nic się nie pobiera przed kliknięciem,
  // nic nie przechodzi między wizytami. Dlatego <audio> powstaje dopiero przy pierwszym
  // kliknięciu, ma preload="none", a wybór nie idzie do localStorage — nowa wizyta to cisza.
  // Playlista gra po kolei; finał ma własny utwór, bo to zejście, a nie kolejne podejście.

  const MUZYKA = {
    "in-this-moment": { tytul: "In This Moment" },
    "home-was-you": { tytul: "Home Was You" },
    "memories-of-stone": { tytul: "Memories Of Stone" },
    "with-these-hands": { tytul: "With These Hands" },
    "convergence": { tytul: "Convergence" },
    "unraveling": { tytul: "Unraveling" },
    "aphelion": { tytul: "Aphelion" },
    "phoenix-2026": { tytul: "Phoenix" },
    "katabasis-i": { tytul: "Katabasis I", album: "The Weight of Air" },
  };

  // Kolejność na czas czytania — od spokojnego fortepianu po orkiestrę, tak jak rosną góry
  // w tekście. Żeby zrezygnować z utworu, wystarczy wyjąć go z tej listy.
  const LISTA = ["in-this-moment", "home-was-you", "memories-of-stone", "with-these-hands",
                 "convergence", "unraveling", "aphelion", "phoenix-2026"];
  const FINAL = "katabasis-i";

  const MUZYKA_AUTOR = "Scott Buckley";
  const MUZYKA_WWW = "https://www.scottbuckley.com.au/";
  const LICENCJA_WWW = "https://creativecommons.org/licenses/by/4.0/";
  const GLOSNOSC = 0.35;
  const WEJSCIE = 2500;      // narastanie przy włączeniu
  const WYJSCIE = 1500;      // wyciszenie przed pauzą
  const PRZEJSCIE = 4000;    // crossfade przy wejściu w finał
  const SKOK = 1200;         // crossfade przy ręcznej zmianie utworu
  const POWROT = 1200;       // powrót po przełączeniu karty
  const PODPIS = 6000;       // jak długo widać, co gra

  const ikona = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

  // W rzędzie kontrolek stoi tylko nuta — ona decyduje o ciszy. Przewijanie mieszka
  // w podpisie, przy nazwie utworu, bo dotyczy tego, co właśnie gra: gołe strzałki,
  // bez obwódki, żeby nie udawały trzeciego równorzędnego przycisku.
  const musicButton = document.createElement("button");
  musicButton.type = "button";
  musicButton.className = "music-toggle";
  musicButton.innerHTML = ikona('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>');
  musicButton.setAttribute("aria-pressed", "false");
  const tbMuzyka = document.querySelector(".tb-muzyka") ?? reader;   // nuta w górnym pasku (bez zmian działania)
  tbMuzyka.append(musicButton);

  // Podpis wymagany licencją: gdy muzyka gra, widać autora, utwór i licencję.
  const musicNow = document.createElement("p");
  musicNow.className = "music-now";
  musicNow.hidden = true;
  const prevButton = document.createElement("button");
  const nextButton = document.createElement("button");
  const musicName = document.createElement("span");
  prevButton.type = nextButton.type = "button";
  prevButton.className = nextButton.className = "music-skip";
  musicName.className = "music-name";
  prevButton.innerHTML = ikona('<polygon points="19 20 9 12 19 4 19 20" fill="currentColor"/><line x1="5" x2="5" y1="19" y2="5"/>');
  nextButton.innerHTML = ikona('<polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><line x1="19" x2="19" y1="5" y2="19"/>');
  prevButton.setAttribute("aria-label", "Poprzedni utwór");
  nextButton.setAttribute("aria-label", "Następny utwór");
  musicNow.append(prevButton, musicName, nextButton);
  tbMuzyka.append(musicNow);

  // Podpis nie wisi przez cały esej: pokazuje się przy starcie i przy zmianie utworu,
  // potem gaśnie, a wraca na najechanie albo fokus. Trwałą atrybucję — tego wymaga
  // licencja — niesie sekcja Źródła w stopce i metadane na ekranie blokady telefonu.
  // Tam, gdzie nie ma kursora, podpis nie ma jak wrócić — a w nim siedzi przewijanie.
  // Na dotyku zostaje więc widoczny tak długo, jak gra muzyka; panel i tak jest wtedy otwarty.
  const bezKursora = matchMedia("(hover: none)");
  let podpisTimer = 0;

  function pokazPodpis(tresc, ms) {
    clearTimeout(podpisTimer);
    podpisTimer = 0;
    musicName.innerHTML = tresc;
    prevButton.hidden = nextButton.hidden = !muzykaOn;
    musicNow.hidden = false;
    if (ms) podpisTimer = setTimeout(() => { podpisTimer = 0; musicNow.hidden = true; }, ms);
  }

  function schowajPodpis() {
    clearTimeout(podpisTimer);
    podpisTimer = 0;
    musicNow.hidden = true;
  }

  const odtwarzacze = {};
  const przejscia = new WeakMap();
  let muzykaOn = false;        // wybór czytelnika
  let grany = null;            // utwór, który jest na wierzchu
  let pozycja = 0;             // miejsce w LISTA — finał go nie rusza
  let wstrzymaneWTle = false;  // pauza z powodu schowanej karty
  let wFinale = false;         // czy czytelnik jest w rozdziale finałowym

  function sciemniaj(el, docelowa, ms) {
    cancelAnimationFrame(przejscia.get(el));
    const od = el.volume;
    if (ms <= 0 || Math.abs(od - docelowa) < 0.001) {
      el.volume = docelowa;
      return Promise.resolve();
    }
    const start = performance.now();
    return new Promise((koniec) => {
      const krok = (teraz) => {
        const p = Math.min(1, (teraz - start) / ms);
        el.volume = Math.max(0, Math.min(1, od + (docelowa - od) * p));
        if (p < 1) przejscia.set(el, requestAnimationFrame(krok));
        else koniec();
      };
      przejscia.set(el, requestAnimationFrame(krok));
      // Zasłonięte albo zminimalizowane okno wstrzymuje requestAnimationFrame. Bez tego
      // przejście stanęłoby w pół drogi: nowy utwór zostałby cichy, a stary nigdy nie
      // doszedłby do pauzy, bo ta czeka na koniec wyciszania.
      setTimeout(() => {
        if (Math.abs(el.volume - docelowa) < 0.001) return;
        cancelAnimationFrame(przejscia.get(el));
        el.volume = docelowa;
        koniec();
      }, ms + 150);
    });
  }

  // preload="none" znaczy, że samo podanie src nie wysyła żądania — plik rusza przy play()
  function odtwarzacz(id) {
    if (odtwarzacze[id]) return odtwarzacze[id];
    const el = document.createElement("audio");
    el.preload = "none";
    el.loop = id === FINAL;          // finał zapętla się, bo po nim nic już nie ma
    el.volume = 0;
    el.src = `assets/audio/${id}.mp3`;
    el.addEventListener("ended", () => {
      if (!muzykaOn || grany !== id || wFinale) return;
      el.pause();                    // przeglądarka już go zatrzymała; to tylko pewność
      pozycja = (pozycja + 1) % LISTA.length;
      zagraj(LISTA[pozycja], SKOK);
    });
    // element idzie do dokumentu: bez controls jest niewidoczny, a odtwarzanie elementu
    // poza drzewem nie jest pewne we wszystkich przeglądarkach
    document.body.append(el);
    odtwarzacze[id] = el;
    return el;
  }

  // Format podpisu wprost ze strony autora: 'Tytuł' by Scott Buckley – released under
  // CC-BY 4.0. www.scottbuckley.com.au
  function podpisUtworu(id) {
    const u = MUZYKA[id];
    const numer = LISTA.includes(id) ? `${LISTA.indexOf(id) + 1}/${LISTA.length} · ` : "finał · ";
    return `${numer}„${u.tytul}”`
      + ` — <a href="${MUZYKA_WWW}" target="_blank" rel="noopener">${MUZYKA_AUTOR}</a>`
      + ` · <a href="${LICENCJA_WWW}" target="_blank" rel="noopener">CC BY 4.0</a>`;
  }

  function mediaSession(id) {
    if (!("mediaSession" in navigator)) return;
    const u = MUZYKA[id];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: u.tytul, artist: MUZYKA_AUTOR, album: u.album ?? "scottbuckley.com.au",
      });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("pause", () => setMusic(false));
      navigator.mediaSession.setActionHandler("play", () => setMusic(true));
      navigator.mediaSession.setActionHandler("previoustrack", () => przeskocz(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => przeskocz(1));
    } catch {
      // bez Media Session podpis niesie sama strona
    }
  }

  // zPodpisem: wznowienie po powrocie do karty nie przypomina, co gra — nic się nie zmieniło
  async function zagraj(id, ms, { zPodpisem = true, odNowa = false } = {}) {
    const el = odtwarzacz(id);
    grany = id;
    if (odNowa) { try { el.currentTime = 0; } catch { /* jeszcze nie wczytany */ } }
    if (zPodpisem) pokazPodpis(podpisUtworu(id), bezKursora.matches ? 0 : PODPIS);
    else musicName.innerHTML = podpisUtworu(id);
    mediaSession(id);
    try {
      await el.play();
    } catch {
      return false;      // przeglądarka odmówiła — zostaje cisza, nie błąd na stronie
    }
    sciemniaj(el, GLOSNOSC, ms);
    return true;
  }

  async function wycisz(id, ms) {
    const el = odtwarzacze[id];
    if (!el) return;
    await sciemniaj(el, 0, ms);
    el.pause();
  }

  function zmien(id, ms, odNowa = false) {
    if (!muzykaOn || grany === id) return;
    const poprzedni = grany;
    zagraj(id, ms, { odNowa });
    if (poprzedni) wycisz(poprzedni, ms);
  }

  // Ręczna zmiana utworu. W finale przeskok wraca na playlistę — inaczej nie dałoby się
  // z niego wyjść bez przewijania strony.
  function przeskocz(krok) {
    if (!muzykaOn) return;
    if (!wFinale || grany !== FINAL) pozycja = (pozycja + krok + LISTA.length) % LISTA.length;
    zmien(LISTA[pozycja], SKOK, true);
  }

  function setMusic(on) {
    muzykaOn = on;
    musicButton.setAttribute("aria-pressed", String(on));
    musicButton.classList.toggle("is-on", on);
    musicButton.setAttribute("aria-label", on ? "Wyłącz muzykę" : "Muzyka do czytania");
    musicButton.dataset.tip = on ? "wyłącz muzykę" : "muzyka do czytania";
    prevButton.hidden = nextButton.hidden = !on;
    if (on) {
      wstrzymaneWTle = false;
      zagraj(grany ?? (wFinale ? FINAL : LISTA[pozycja]), WEJSCIE);
    } else {
      for (const id of Object.keys(odtwarzacze)) wycisz(id, WYJSCIE);
      schowajPodpis();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    }
  }

  setMusic(false);
  musicButton.addEventListener("click", () => setMusic(!muzykaOn));

  // Ten sam przełącznik muzyki w menu („Sprzęt”) — w otwartym menu ikony z rogu znikają.
  // To tylko drugi uchwyt do setMusic: stan czyta z nuty w pasku, więc nic się nie rozjedzie.
  if (opcje) {
    const menuMusic = document.createElement("button");
    menuMusic.type = "button";
    menuMusic.className = "music-toggle";
    menuMusic.innerHTML = musicButton.innerHTML;
    const sync = () => {
      menuMusic.setAttribute("aria-pressed", musicButton.getAttribute("aria-pressed"));
      menuMusic.setAttribute("aria-label", musicButton.getAttribute("aria-label"));
      menuMusic.classList.toggle("is-on", musicButton.classList.contains("is-on"));
    };
    menuMusic.addEventListener("click", () => { setMusic(!muzykaOn); sync(); });
    musicButton.addEventListener("click", sync);
    sync();
    opcje.append(opcja("Muzyka do czytania", menuMusic));
  }
  prevButton.addEventListener("click", () => przeskocz(-1));
  nextButton.addEventListener("click", () => przeskocz(1));

  // Gdy podpis już zgasł, najechanie na nutę przywołuje go z powrotem — razem ze strzałkami.
  // Nuta i podpis są jednym obszarem: zwłoka pozwala przejechać kursorem przez przerwę
  // między nimi, a w pierwszych sekundach po zmianie utworu zjechanie i tak nic nie gasi.
  let zwloka = 0;

  function przypomnijPodpis() {
    clearTimeout(zwloka);
    if (muzykaOn && grany) pokazPodpis(podpisUtworu(grany), 0);
  }

  function ukryjPodpis() {
    clearTimeout(zwloka);
    if (bezKursora.matches) return;
    zwloka = setTimeout(() => { if (!podpisTimer) schowajPodpis(); }, 260);
  }

  for (const el of [musicButton, musicNow]) {
    el.addEventListener("pointerenter", przypomnijPodpis);
    el.addEventListener("pointerleave", ukryjPodpis);
  }
  for (const el of [musicButton, prevButton, nextButton]) {
    el.addEventListener("focus", przypomnijPodpis);
    el.addEventListener("blur", ukryjPodpis);
  }

  // Schowana karta milczy. Powrót wznawia tylko to, czego czytelnik sam nie wyłączył.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (!muzykaOn || !grany) return;
      wstrzymaneWTle = true;
      wycisz(grany, 400);
    } else if (wstrzymaneWTle) {
      wstrzymaneWTle = false;
      if (muzykaOn) zagraj(grany, POWROT, { zPodpisem: false });
    }
  });

  // Finał: dwa progi, żeby drobne przewinięcie na granicy nie przełączało utworu.
  // Wejście, gdy początek finału minie 60% ekranu; powrót, gdy znów jest 160% niżej.
  const finalSection = document.getElementById("mont-blanc");
  if (finalSection) {
    new IntersectionObserver(([wpis]) => {
      if (!wpis.isIntersecting) return;
      wFinale = true;
      zmien(FINAL, PRZEJSCIE);
    }, { rootMargin: "0px 0px -40% 0px" }).observe(finalSection);

    new IntersectionObserver(([wpis]) => {
      if (wpis.isIntersecting) return;
      wFinale = false;
      if (grany === FINAL) zmien(LISTA[pozycja], PRZEJSCIE);
    }, { rootMargin: "0px 0px 60% 0px" }).observe(finalSection);

    // Finał dociąga się, zanim będzie potrzebny — crossfade nie może czekać na sieć.
    // Tylko przy włączonej muzyce, więc przed kliknięciem nie ma żadnego żądania do plików.
    new IntersectionObserver(([wpis], obserwator) => {
      if (!wpis.isIntersecting || !muzykaOn) return;
      const el = odtwarzacz(FINAL);
      el.preload = "auto";
      el.load();
      obserwator.disconnect();
    }, { rootMargin: "0px 0px 150% 0px" }).observe(finalSection);
  }

  // --- Druk i PDF: szkice ładują się dopiero przy przewijaniu — przed drukiem wszystkie ---
  addEventListener("beforeprint", () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = "eager"));
  });

  addEventListener("scroll", queueUpdate, { passive: true });
  addEventListener("resize", queueUpdate);
  addEventListener("pagehide", () => current && current !== intro?.id && savePlace(current));
  offerResume();
  update();
})();
