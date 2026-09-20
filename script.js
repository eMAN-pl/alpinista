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
  const hero = document.querySelector(".hero");
  const intro = document.getElementById("wstep");
  const sections = [intro, ...document.querySelectorAll(".chapter")].filter(Boolean);
  const links = new Map(
    [...document.querySelectorAll(".profile-nav a")].map((a) => [a.hash.slice(1), a])
  );

  const PLACE_KEY = "alpinista:miejsce";   // localStorage: rozdział + miejsce w nim
  const EFFECTS_KEY = "alpinista:efekty";  // localStorage: wybór z przełącznika (hero.js)
  const SAVE_EVERY = 1000;                 // zapis najwyżej raz na sekundę
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let current = null;
  let queued = false;
  let lastSave = 0;
  let resume = null;                       // pasek „wróć tam”, jeśli jest pokazany
  let lastY = window.scrollY;              // kierunek przewijania — dla przycisku trasy

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
    for (const section of sections) {
      if (section.getBoundingClientRect().top > vh / 3) break;
      active = section.id;
    }

    // Spis pojawia się od startu — ekran tytułowy zostaje czysty
    document.documentElement.classList.toggle("nav-on", active !== null);

    // Scena: rozdział i etap w nim (kolory tła w style.css, ozdobniki w scenes.js)
    setScene("scene", active);
    setScene("step", active && lastStep(document.getElementById(active), vh));

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

    // Przycisk trasy (węższe ekrany): chowa się przy czytaniu w dół, wraca przy przewijaniu w górę
    const y = window.scrollY;
    if (Math.abs(y - lastY) > 16) {
      document.documentElement.classList.toggle("route-away", y > lastY);
      lastY = y;
    }
  }

  function queueUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  // html[data-scene] / html[data-step] — zmieniane tylko przy zmianie, bo śledzi je scenes.js
  function setScene(key, value) {
    const data = document.documentElement.dataset;
    if (value) {
      if (data[key] !== value) data[key] = value;
    } else if (key in data) {
      delete data[key];
    }
  }

  // Etap w rozdziale: ostatni akapit z data-step, który minął środek ekranu
  function lastStep(section, vh) {
    let step = null;
    for (const node of section.querySelectorAll("[data-step]")) {
      if (node.getBoundingClientRect().top > vh / 2) break;
      step = node.dataset.step;
    }
    return step;
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
    ".profile-nav, .hero-markers, .resume, .copy-link";

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

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "copy-link";
  copyButton.textContent = "kopiuj z linkiem";
  copyButton.hidden = true;
  document.body.append(copyButton);

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
    copyButton.classList.toggle("is-below", below);
    copyButton.style.left = `${Math.min(Math.max(rect.left + rect.width / 2, 80), innerWidth - 80)}px`;
    copyButton.style.top = `${window.scrollY + (below ? rect.bottom + 10 : rect.top - 10)}px`;
    copyButton.hidden = false;
  }

  function hideCopyButton() {
    copyButton.hidden = true;
    quote = null;
  }

  function chapterLink(section) {
    const url = section.id === intro?.id
      ? new URL("./", document.baseURI)
      : new URL(`${section.id}/`, document.baseURI);
    return url.href.replace(/^https?:\/\//, "");
  }

  // Zaznaczenie nie znika przy kliknięciu w przycisk
  copyButton.addEventListener("pointerdown", (event) => event.preventDefault());
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
  const TYPE_MS = 1100;                    // tyle najwyżej trwa wpisywanie

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
    const duration = Math.min(TYPE_MS, Math.max(280, chars.length * 22));
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
  // Boczny spis mieści się dopiero od 85em. Niżej: cichy przycisk w prawym dolnym rogu
  // z bieżącym rozdziałem otwiera ten sam spis jako panel od dołu ekranu.
  // Przy czytaniu (przewijanie w dół) przycisk się chowa, wraca przy przewijaniu w górę.
  const nav = document.querySelector(".profile-nav");
  const wide = matchMedia("(min-width: 85em)");
  const routeButton = document.createElement("button");
  const routeLabel = document.createElement("span");
  const backdrop = document.createElement("div");
  routeButton.type = "button";
  routeButton.className = "route-toggle";
  routeButton.setAttribute("aria-controls", "trasa");
  routeButton.setAttribute("aria-expanded", "false");
  routeLabel.className = "route-label";
  routeButton.append(routeLabel);
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
    routeLabel.textContent = label;
    routeButton.setAttribute("aria-label", `Spis rozdziałów, teraz: ${label}`);
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

  // Kropkowana linia pod słowami tylko wtedy, gdy efekty działają (hero.js aktualizuje przy przełączaniu)
  document.documentElement.classList.toggle("effects-off", !effectsEnabled());

  // --- Kliknięcie w ekran tytułowy przewija do startu ---
  // Płynnie; przy „ogranicz ruch” albo wyłączonych efektach — od razu.
  // Nie reaguje na przełącznik efektów ani na zaznaczanie tytułu.
  hero?.addEventListener("click", (event) => {
    if (event.target.closest("button, a") || !getSelection().isCollapsed) return;
    intro?.scrollIntoView({ behavior: effectsEnabled() ? "smooth" : "auto", block: "start" });
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
