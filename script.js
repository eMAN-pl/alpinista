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

  // Efekty: przełącznik wrócił do menu (autor, 2026-11-16) — „Sprzęt” → Efekty.
  // Wybór jest zapamiętany; bez wyboru efekty są włączone dla wszystkich (autor: „mają być
  // włączone od początku”), także przy systemowym ograniczeniu ruchu — wyłącza się je w menu.
  // Wyłączone: zapalniki wyglądają i działają jak zwykły tekst.
  const EFEKTY_KEY = "alpinista:efekty";
  // Do 2026-11-15 ten sam klucz trzymał "on"/"off" (przełącznik w stopce i na ekranie tytułowym).
  // Nowy kod porównywał tylko z "1", więc czytelnik, który kiedyś WŁĄCZYŁ efekty ("on"), dostawał
  // je wyłączone (zgłoszenie autora, 2026-11-19). Stary zapis przepisujemy na nowy.
  const staryZapis = { on: "1", off: "0" }[remember(EFEKTY_KEY)];
  if (staryZapis) remember(EFEKTY_KEY, staryZapis);
  let efektyOn = (remember(EFEKTY_KEY) ?? "1") === "1";
  document.documentElement.classList.toggle("bez-efektow", !efektyOn);

  function effectsEnabled() {
    return efektyOn;
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

    // Powrót do lektury mieszka w podpisie na dole intro („ok. 74 minuty · przewiń”):
    // powracający czytelnik widzi tam „czytaj dalej · Babia Góra” i ile mu zostało.
    // Ciemna pastylka u góry leżała na zdjęciu tuż nad szczytami i konkurowała z tytułem
    // (przegląd 2026-11-15). Pastylka zostaje tylko tam, gdzie intro nie ma podpisu.
    const hint = document.getElementById("we-hint");
    if (hint) {
      const zostalo = minutDoKonca(place);
      const dalej = document.createElement("a");
      dalej.className = "we-wroc";
      dalej.href = `#${place.id}`;
      dalej.textContent = `czytaj dalej · ${name}`;
      dalej.addEventListener("click", (event) => { event.preventDefault(); goTo(place); });
      const ile = document.createElement("b");
      ile.textContent = zostalo ? `zostało ok. ${zostalo} min` : `rozdział ${number}`;
      // dwie linijki, bez kreski „przewiń” — na telefonie dłuższy podpis wchodził w tytuł
      hint.replaceChildren(dalej, ile);
      hint.classList.add("we-hint--wroc");
      return;
    }

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

  // Ile minut zostało od zapamiętanego miejsca — z tych samych danych co wykres w menu
  function minutDoKonca(place) {
    const profil = document.querySelector("#menu .profil");
    if (!profil) return 0;
    const odcinki = JSON.parse(profil.dataset.odcinki);
    if (!odcinki[place.id]) return 0;
    let przed = 0;
    for (const [klucz, [, , min]] of Object.entries(odcinki)) {
      if (klucz === place.id) { przed += min * place.fraction; break; }
      przed += min;
    }
    return Math.max(0, Math.round(Number(profil.dataset.razem) - przed));
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
      const widoczny = link && link.offsetParent ? link : menu.querySelector(".menu-karty [aria-pressed='true']");
      widoczny?.focus({ preventScroll: true });
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
    // „czytaj dalej” w menu usunięte (autor, 2026-11-17) — ten sam odnośnik stoi na stronie
    // głównej; kod zostaje bezczynny, gdy elementu nie ma.
    const wroc = menu.querySelector(".route-wroc");
    const zapis = readPlace();
    const pokaz = wroc && zapis && odcinki[zapis.id] && zapis.id !== "wstep" && current !== zapis.id;
    if (wroc) {
      wroc.hidden = !pokaz;
      if (pokaz) {
        const cel = document.getElementById(zapis.id);
        const link = wroc.querySelector("a");
        link.href = `#${zapis.id}`;
        link.textContent = `czytaj dalej · ${cel?.dataset.nazwa ?? ""}`;
        link.onclick = (event) => { event.preventDefault(); setMenu(false); goTo(zapis); };
      }
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
    // Pod wykresem: który rozdział i ile zostało (autor, 2026-11-17 — wcześniej samo „ile zostało”).
    // Miejsce widać na grani (czerwień i kropka), więc bez „jesteś tutaj”.
    const nrRozdzialu = Object.keys(odcinki).indexOf(id), rozdzialow = Object.keys(odcinki).length - 1;
    tu.textContent = (nrRozdzialu <= 0 ? "wstęp" : `rozdział ${nrRozdzialu} z ${rozdzialow}`)
      + (zostalo > 0 ? ` · zostało ok. ${zostalo} min` : "");
    tu.hidden = false;
  }

  // Zakładki menu na telefonie: „Sprzęt” (ustawienia i wykres) i „Trasa” (lista rozdziałów)
  menu?.querySelector(".menu-karty")?.addEventListener("click", (event) => {
    const karta = event.target.closest("[data-karta]");
    if (!karta) return;
    menu.dataset.karta = karta.dataset.karta;
    for (const b of menu.querySelectorAll(".menu-karty [data-karta]")) b.setAttribute("aria-pressed", String(b === karta));
    menu.scrollTop = 0;
  });

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

  // Ustawienia w menu (przebudowa 2026-11-17, autor: „słabo wygląda”): grupy „Czytanie”
  // i „Dźwięk”, w każdym wierszu nazwa z krótkim opisem, a kontrolki w dwóch kształtach —
  // segment (wybór z dwóch) i przełącznik (wł./wył.). Wcześniej obok siebie stały kółka,
  // pigułki z napisem „wł./wył.” i pigułki plików.
  const opcje = document.querySelector(".menu-opcje");
  function opcja(nazwa, opis, ...przyciski) {
    const wiersz = document.createElement("div");
    wiersz.className = "opcja";
    const tekst = document.createElement("span");
    tekst.className = "opcja-tekst";
    const etykieta = document.createElement("span");
    etykieta.className = "opcja-nazwa";
    etykieta.textContent = nazwa;
    tekst.append(etykieta);
    if (opis) {
      const o = document.createElement("span");
      o.className = "opcja-opis";
      o.textContent = opis;
      tekst.append(o);
    }
    const grupa = document.createElement("div");
    grupa.className = "reader";
    grupa.append(...przyciski);
    wiersz.append(tekst, grupa);
    // przełącznik niesie nazwę wiersza — czytnik ekranu powie „Dźwięki, przełącznik, włączony”
    for (const p of przyciski) if (p.getAttribute?.("role") === "switch") p.setAttribute("aria-label", nazwa);
    return wiersz;
  }
  function grupaOpcji(tytul) {
    const h = document.createElement("p");
    h.className = "opcja-grupa";
    h.textContent = tytul;
    return h;
  }
  function segment(...przyciski) {
    const s = document.createElement("div");
    s.className = "segment";
    s.append(...przyciski);
    return s;
  }
  // Motyw: dwa słowa zamiast ikony słońca — od razu widać, który jest wybrany
  const motywy = ["ciemny", "jasny"].map((m) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = m;
    b.dataset.motyw = m;
    b.addEventListener("click", () => setTheme(m));
    return b;
  });
  reader.replaceChildren();
  opcje?.append(grupaOpcji("Czytanie"), opcja("Rozmiar tekstu", "", segment(smaller, bigger)),
    opcja("Motyw", "", segment(...motywy)));

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
    for (const b of motywy) b.setAttribute("aria-pressed", String(b.dataset.motyw === next));
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
      echoWyboru(przycisk.dataset.wybor);
      // podmuch przy decyzji — gra, jeśli czytelnik ma włączone dźwięki (dzwiek.js, autor 2026-11-16)
      dispatchEvent(new CustomEvent("dzwiek:wybor", { detail: { wybor: przycisk.dataset.wybor } }));
    });
  }

  // Echo wyboru w rozdziale „Zawrócenie”: pod zdaniem „co by było, gdyby…” cichy dopisek
  // o tym, co czytelnik kliknął na początku. Tylko w tej wizycie — wybór nie jest zapamiętywany.
  function echoWyboru(wybor) {
    const akapit = [...document.querySelectorAll("#grossglockner p")].find((p) => p.textContent.includes("co by było, gdyby"));
    if (!akapit || akapit.nextElementSibling?.classList.contains("echo-wyboru")) return;
    const echo = document.createElement("p");
    echo.className = "echo-wyboru";
    echo.textContent = /zawracam/i.test(wybor) ? "Na początku zawróciłeś." : "Na początku poszedłeś dalej.";
    akapit.after(echo);
  }

  // --- Dźwięk: muzyka, dźwięki, efekty (autor, 2026-11-16) ---
  // Bez odtwarzacza i playlisty: to esej decyduje, gdzie i co gra. Czytelnik ma trzy
  // przełączniki w menu („Sprzęt”) i głośnik w pasku, który wycisza albo przywraca całe audio.
  // Muzyka i dźwięki: nic nie gra samo, nic się nie pobiera przed kliknięciem i wybór nie
  // przechodzi między wizytami — nowa wizyta to cisza (przeglądarka i tak wymaga kliknięcia).
  // Silnik dźwięku słucha zdarzenia „audio-zmiana” i czyta window.alpinistaAudio.
  const audio = { muzyka: false, dzwieki: false };
  // Co włącza głośnik: domyślnie same dźwięki — muzyka jest opcją, którą czytelnik włącza
  // w menu (autor, 2026-11-17). Po wyciszeniu głośnik przywraca dokładnie ostatni wybór.
  let ostatnie = { muzyka: false, dzwieki: true };
  window.alpinistaAudio = audio;

  const ikona = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  // Lucide (ISC): volume-2 i volume-x
  const GLOSNIK = '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>';
  const GRA = GLOSNIK + '<path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>';
  const CISZA = GLOSNIK + '<line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>';

  const glosnik = document.createElement("button");
  glosnik.type = "button";
  glosnik.className = "music-toggle tb-dzwiek";
  document.querySelector(".tb-muzyka")?.append(glosnik);

  function przelacznik() {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "przelacznik";
    b.setAttribute("role", "switch");
    return b;
  }
  const przelaczniki = { muzyka: przelacznik(), dzwieki: przelacznik(), efekty: przelacznik() };
  const pokazStan = (b, on) => b.setAttribute("aria-checked", String(on));

  function odswiezAudio() {
    const gra = audio.muzyka || audio.dzwieki;
    glosnik.innerHTML = ikona(gra ? GRA : CISZA);
    glosnik.classList.toggle("is-on", gra);
    glosnik.setAttribute("aria-pressed", String(gra));
    glosnik.setAttribute("aria-label", gra ? "Wycisz dźwięk" : "Włącz dźwięk");
    glosnik.dataset.tip = gra ? "wycisz" : "włącz dźwięk";
    pokazStan(przelaczniki.muzyka, audio.muzyka);
    pokazStan(przelaczniki.dzwieki, audio.dzwieki);
    pokazStan(przelaczniki.efekty, efektyOn);
  }

  // Silnik dźwięku (dzwiek.js) wczytuje się dopiero przy pierwszym włączeniu — do tej chwili
  // strona nie pobiera nic z audio. Kontekst dźwięku powstaje tutaj, w kliknięciu: iOS
  // pozwala go uruchomić tylko w geście użytkownika, a skrypt dojdzie dopiero po chwili.
  let silnikDzwieku = null;
  function wczytajDzwiek() {
    if (!silnikDzwieku) silnikDzwieku = new Promise((gotowe, blad) => {
      const skrypt = document.createElement("script");
      skrypt.src = document.body.dataset.dzwiekJs;
      skrypt.onload = gotowe;
      skrypt.onerror = blad;
      document.head.append(skrypt);
    });
    return silnikDzwieku;
  }
  function odblokujDzwiek() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!window.alpinistaCtx && Ctx) window.alpinistaCtx = new Ctx();
      window.alpinistaCtx?.resume();
    } catch { /* bez Web Audio strona zostaje cicha */ }
  }

  function ustawAudio(zmiana) {
    Object.assign(audio, zmiana);
    odswiezAudio();
    if (audio.muzyka || audio.dzwieki) odblokujDzwiek();
    dispatchEvent(new CustomEvent("audio-zmiana", { detail: { ...audio } }));
    if (audio.muzyka || audio.dzwieki || window.Dzwiek) {
      wczytajDzwiek().then(() => window.Dzwiek?.ustaw(audio)).catch(() => { /* bez silnika: cisza */ });
    }
  }
  // roboczy mikser autora: panel głośności każdego dźwięku (dzwiek.js)
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && new URLSearchParams(location.search).has("mikser")) wczytajDzwiek().catch(() => {});

  // Głośnik: gdy cokolwiek gra — wycisza wszystko i pamięta, co grało; gdy cisza — przywraca.
  glosnik.addEventListener("click", () => {
    if (audio.muzyka || audio.dzwieki) {
      ostatnie = { ...audio };
      ustawAudio({ muzyka: false, dzwieki: false });
    } else ustawAudio(ostatnie);
  });
  przelaczniki.muzyka.addEventListener("click", () => ustawAudio({ muzyka: !audio.muzyka }));
  przelaczniki.dzwieki.addEventListener("click", () => ustawAudio({ dzwieki: !audio.dzwieki }));
  przelaczniki.efekty.addEventListener("click", () => {
    efektyOn = !efektyOn;
    remember(EFEKTY_KEY, efektyOn ? "1" : "0");
    document.documentElement.classList.toggle("bez-efektow", !efektyOn);
    if (!efektyOn) zapalnikUzyty();               // dopisek „kliknij” nie ma sensu przy zwykłym tekście
    window.Efekty?.wlacz(efektyOn);               // wyłączenie przerywa to, co właśnie trwa
    odswiezAudio();
  });

  // Efekty to część czytania (ruch na stronie), więc stoją w „Czytaniu”, za motywem
  opcje?.querySelector(".opcja:last-of-type")?.after(
    opcja("Efekty", "ruch po kliknięciu podkreślonej frazy", przelaczniki.efekty));
  opcje?.append(
    grupaOpcji("Dźwięk"),
    opcja("Dźwięki", "tło rozdziałów i efektów", przelaczniki.dzwieki),
    opcja("Muzyka", "delikatnie, pod tłem", przelaczniki.muzyka),
    grupaOpcji("Pobierz"),
  );
  odswiezAudio();

  // --- Druk i PDF: szkice ładują się dopiero przy przewijaniu — przed drukiem wszystkie ---
  addEventListener("beforeprint", () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = "eager"));
  });

  // --- Koniec strony: Dolomity z pierwszego slajdu jako przyciszone tło Źródeł ---
  // Zdjęcie wchodzi, gdy góra części końcowej przejeżdża przez ekran — wynurza się z koloru
  // strony jak z mgły — i zostaje pod Źródłami i stopką (style.css: .koniec).
  const koniec = document.getElementById("koniec");
  const tloKonca = koniec?.querySelector(".kn-tlo");
  if (tloKonca) {
    let czeka = false;
    const rysuj = () => {
      czeka = false;
      const top = koniec.getBoundingClientRect().top;
      const u = Math.min(1, Math.max(0, (innerHeight - top) / (innerHeight * 0.9)));
      tloKonca.style.setProperty("--wejscie", (u * u * (3 - 2 * u)).toFixed(3));
    };
    const kolejka = () => { if (!czeka) { czeka = true; requestAnimationFrame(rysuj); } };
    if (reduceMotion.matches) tloKonca.style.setProperty("--wejscie", "1");
    else {
      addEventListener("scroll", kolejka, { passive: true });
      addEventListener("resize", kolejka);
      rysuj();
    }
  }

  addEventListener("scroll", queueUpdate, { passive: true });
  addEventListener("resize", queueUpdate);
  addEventListener("pagehide", () => current && current !== intro?.id && savePlace(current));
  offerResume();
  update();
})();
