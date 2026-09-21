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
  const EFFECTS_KEY = "alpinista:efekty";  // localStorage: wybór z przełącznika w stopce
  const SAVE_EVERY = 1000;                 // zapis najwyżej raz na sekundę
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let current = null;
  let queued = false;
  let lastSave = 0;
  let resume = null;                       // pasek „wróć tam”, jeśli jest pokazany

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
      updateRouteLabel(active);
    }

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

  // Efekty: wybór czytelnika z przełącznika, a bez wyboru — ustawienie systemowe „ogranicz ruch”
  function effectsEnabled() {
    try {
      const stored = localStorage.getItem(EFFECTS_KEY);
      if (stored) return stored === "on";
    } catch {
      // bez pamięci — decyduje ustawienie systemowe
    }
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
    const isCoda = section.classList.contains("coda");
    if (isCoda && place.fraction > 0.8) return;

    const number = section.querySelector(".chapter-meta span")?.textContent;
    const name = section.querySelector("h2")?.textContent;

    resume = document.createElement("div");
    resume.className = "resume";
    resume.setAttribute("role", "region");
    resume.setAttribute("aria-label", "Powrót do miejsca czytania");

    const text = document.createElement("span");
    text.textContent = isCoda ? "czytałeś do zakończenia" : `czytałeś do rozdziału ${number} · ${name}`;

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
      bg: style.getPropertyValue("--bg").trim() || "#1a1917",
      text: style.getPropertyValue("--text-strong").trim() || "#f7f3ea",
      quiet: style.getPropertyValue("--text-quiet").trim() || "#ada79c",
      accent: style.getPropertyValue("--accent").trim() || "#8ab4e0",
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

  // --- „cyk”, „klik”, „WTF” i „Enter”: efekty na kliknięcie ---
  // „cyk”   — podwójny błysk flesza na cały ekran.
  // „klik”  — linijka albo zdanie ze słowem pisze się od nowa, jak generowane.
  // „WTF”   — słowo się rozsypuje, a tekst szarpie się i na moment odwraca kolory.
  // „Enter” — słowo wciska się jak klawisz.
  // Tylko po kliknięciu, nigdy samo. Nie przy zaznaczaniu tekstu, nie przy wyłączonych efektach.
  // Błysk albo szarpnięcie najwyżej raz na 1,5 s — poniżej progu trzech błysków na sekundę.

  const FLASH_GAP = 1500;
  let flash = null;
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

  function snap() {
    if (!flashAllowed()) return;
    if (!flash) {
      flash = document.createElement("div");
      flash.className = "flash";
      flash.setAttribute("aria-hidden", "true");
      document.body.append(flash);
    }
    restart(flash, "is-on");
  }

  function glitch(word) {
    if (!flashAllowed()) return;
    restart(word, "is-glitching");
    // Tekst szarpie się wokół środka ekranu, nie środka całego (bardzo wysokiego) artykułu
    article.style.transformOrigin = `50% ${window.scrollY + innerHeight / 2 - article.offsetTop}px`;
    restart(article, "is-shaken");
  }

  // „klik” — linijka albo zdanie ze słowem pisze się od nowa, jak generowane:
  //   znika w całości i wraca porcjami po kilka znaków, nierówno, z migającym kursorem na końcu.
  //   Cel: linijka w bloku z pojedynczymi Enterami („Klik. Kolejna aplikacja.”),
  //   krótki akapit („Klik. Klik. Klik.”) albo zdanie przed słowem („Generujemy ogłoszenie. Klik.”).
  //   Znaki są tylko przezroczyste, więc tekst nie skacze; po wszystkim wraca oryginalny HTML.
  const SHORT = 60;                        // znaków: akapit mieszczący się w jednej linijce
  const TYPE_MS = 1800;                    // tyle najwyżej trwa wpisywanie

  function retype(word) {
    const target = word.closest(".fx-wrap") ?? word.closest(".line") ?? shortParagraph(word) ?? wrapSentence(word);
    if (target.dataset.typing) return;
    target.dataset.typing = "true";
    const original = target.innerHTML;
    const chars = hideChars(target);
    const caret = document.createElement("span");
    caret.className = "type-caret";
    caret.setAttribute("aria-hidden", "true");
    target.prepend(caret);

    // Rozkład porcji liczymy z góry: kilka znaków naraz, w nierównym rytmie, jak tokeny modelu.
    // Każda klatka pokazuje to, co powinno być już wpisane — przy słabej płynności porcje są
    // większe, ale linijka kończy się w tym samym czasie.
    const chunks = [];
    let at = 0;
    let time = 0;
    while (at < chars.length) {
      at = Math.min(chars.length, at + 2 + Math.floor(Math.random() * 4));
      time += 0.6 + Math.random() * 0.8;
      chunks.push({ at, time });
    }
    const duration = Math.min(TYPE_MS, Math.max(420, chars.length * 38));
    for (const chunk of chunks) chunk.time *= duration / time;

    let shown = 0;
    let next = 0;
    let start = 0;

    const step = (now) => {
      start ||= now;
      while (next < chunks.length && chunks[next].time <= now - start) {
        for (const end = chunks[next++].at; shown < end; shown++) chars[shown].style.opacity = "";
        chars[shown - 1].after(caret);
      }
      if (next < chunks.length) {
        requestAnimationFrame(step);
        return;
      }
      caret.remove();
      target.innerHTML = original;
      delete target.dataset.typing;
      unwrap(target);
    };
    requestAnimationFrame(step);
  }

  // Każdy znak w osobnym elemencie, na razie przezroczysty
  function hideChars(target) {
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const chars = [];
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const char of node.nodeValue) {
        const span = document.createElement("span");
        span.textContent = char;
        span.style.opacity = "0";
        chars.push(span);
        fragment.append(span);
      }
      node.replaceWith(fragment);
    }
    return chars;
  }

  function shortParagraph(word) {
    const paragraph = word.closest("p");
    return paragraph.textContent.trim().length < SHORT ? paragraph : null;
  }

  function unwrap(target) {
    if (!target.classList.contains("fx-wrap")) return;
    const parent = target.parentNode;
    target.replaceWith(...target.childNodes);
    parent.normalize();
  }

  // Zdanie przed słowem razem z nim — na czas efektu w pomocniczym elemencie
  function wrapSentence(word) {
    const paragraph = word.closest("p");
    // Tekst akapitu jako jeden ciąg, z zapamiętanym początkiem każdego węzła tekstu
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = "";
    while (walker.nextNode()) {
      nodes.push({ node: walker.currentNode, from: text.length });
      text += walker.currentNode.nodeValue;
    }
    const locate = (index) => {
      const hit = nodes.findLast((entry) => entry.from <= index);
      return [hit.node, index - hit.from];
    };

    const wordStart = nodes.find((entry) => word.contains(entry.node)).from;
    let end = wordStart + word.textContent.length;
    if (/[.!?…]/.test(text[end] ?? "")) end++;

    // Początek: koniec zdania, które było przed zdaniem poprzedzającym słowo
    const before = text.slice(0, wordStart).trimEnd();
    const marks = [". ", "! ", "? ", "… "].map((mark) => before.lastIndexOf(mark, before.length - 2));
    const boundary = Math.max(...marks);
    const start = boundary < 0 ? 0 : boundary + 2;

    const range = document.createRange();
    range.setStart(...locate(start));
    range.setEnd(...locate(end));
    if (word.contains(range.startContainer)) range.setStartBefore(word);
    if (word.contains(range.endContainer)) range.setEndAfter(word);

    const wrap = document.createElement("span");
    wrap.className = "fx-wrap";
    wrap.append(range.extractContents());
    range.insertNode(wrap);
    return wrap;
  }

  article.addEventListener("click", (event) => {
    const word = event.target.closest(".fx");
    if (!word || !effectsEnabled() || !getSelection().isCollapsed) return;
    if (word.classList.contains("fx-cyk")) snap();
    else if (word.classList.contains("fx-klik")) retype(word);
    else if (word.classList.contains("fx-wtf")) glitch(word);
    else restart(word, "is-pressed");
  });

  // --- Trasa na węższych ekranach ---
  // Boczny spis mieści się dopiero od 85em. Niżej: okrągły przycisk w prawym dolnym rogu
  // (ikona mapy, Lucide, ISC) otwiera ten sam spis jako panel od dołu ekranu.
  // Stoi tam przez cały czas czytania, a pierścień wokół niego pokazuje postęp.
  const nav = document.querySelector(".profile-nav");
  const wide = matchMedia("(min-width: 85em)");
  const routeButton = document.createElement("button");
  const backdrop = document.createElement("div");
  routeButton.type = "button";
  routeButton.className = "route-toggle";
  routeButton.setAttribute("aria-controls", "trasa");
  routeButton.setAttribute("aria-expanded", "false");
  routeButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/>
    <path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>`;
  backdrop.className = "route-backdrop";
  backdrop.hidden = true;
  nav.id = "trasa";
  document.body.append(backdrop, routeButton);

  function updateRouteLabel(id) {
    const section = id ? document.getElementById(id) : null;
    const name = section?.querySelector("h2")?.textContent ?? "";
    const number = section?.querySelector(".chapter-meta span")?.textContent;
    const label = !section || section === intro ? "start"
      : section.classList.contains("coda") ? "koniec"
      : `${number} · ${name}`;
    routeButton.setAttribute("aria-label", `Rozdziały i ustawienia, teraz: ${label}`);
  }

  const routeOpen = () => routeButton.getAttribute("aria-expanded") === "true";

  function setRoute(open) {
    if (open === routeOpen()) return;
    routeButton.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("route-open", open);
    backdrop.hidden = !open;
    if (open) {
      const link = nav.querySelector("[aria-current]") ?? nav.querySelector("a");
      nav.scrollTop = link.closest("li").offsetTop - nav.clientHeight / 2;   // bieżący rozdział na środku panelu
      link.focus({ preventScroll: true });
    } else if (nav.contains(document.activeElement)) {
      routeButton.focus({ preventScroll: true });
    }
  }

  routeButton.addEventListener("click", () => setRoute(!routeOpen()));
  backdrop.addEventListener("click", () => setRoute(false));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setRoute(false);
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape") setRoute(false);
  });
  wide.addEventListener("change", () => setRoute(false));

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
  reader.append(smaller, bigger, themeButton());

  // Szeroki ekran: zestaw w prawym dolnym rogu. Węższy: w panelu z trasą, bo róg
  // zajmuje przycisk trasy. Przełącznik motywu stoi dodatkowo przy nazwisku na starcie.
  function placeReader() {
    if (wide.matches) document.body.append(reader);
    else nav.append(reader);
  }

  placeReader();
  wide.addEventListener("change", placeReader);
  document.querySelector(".hero-by")?.append(themeButton());

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
    if (bar) bar.content = next === "jasny" ? "#f2eee5" : "#1a1917";
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

  // --- Przełącznik efektów (stopka) ---
  // Jedno miejsce dla wszystkiego, co się rusza: scen rozdziałów, paralaksy szkiców
  // i efektów przy słowach. Wybór pamiętany w localStorage; bez wyboru decyduje system.
  const colophon = document.querySelector(".colophon-utils");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "effects-toggle";
  colophon?.append(toggle);

  function setEffects(on) {
    try {
      localStorage.setItem(EFFECTS_KEY, on ? "on" : "off");
    } catch {
      // bez pamięci wybór działa do końca wizyty
    }
    document.documentElement.classList.toggle("effects-off", !on);
    toggle.textContent = on ? "wyłącz efekty" : "włącz efekty";
  }

  toggle.addEventListener("click", () => setEffects(document.documentElement.classList.contains("effects-off")));
  setEffects(effectsEnabled());

  // Zmiana ustawienia „ogranicz ruch” działa tylko wtedy, gdy czytelnik sam nic nie wybrał
  reduceMotion.addEventListener("change", (event) => {
    let stored = null;
    try {
      stored = localStorage.getItem(EFFECTS_KEY);
    } catch {
      // bez pamięci idziemy za ustawieniem systemu
    }
    if (!stored) setEffects(!event.matches);
  });

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
