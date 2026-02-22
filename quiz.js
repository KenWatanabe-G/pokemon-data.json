(() => {
  "use strict";

  // ---- State ----
  const state = {
    allPokemon: [],
    quizQueue: [],
    currentIndex: 0,
    currentPokemon: null,
    correctCount: 0,
    wrongCount: 0,
    wrongList: [], // { id, name, image, yourAnswer }
    lang: "japanese",
    answered: false,
  };

  const STORAGE_KEY = "pokemon-quiz-wrong-list";
  const SETTINGS_KEY = "pokemon-quiz-settings";

  const REGIONS = {
    kanto: { min: 1, max: 151 },
    johto: { min: 152, max: 251 },
    hoenn: { min: 252, max: 386 },
    sinnoh: { min: 387, max: 493 },
    unova: { min: 494, max: 649 },
    kalos: { min: 650, max: 721 },
    alola: { min: 722, max: 809 },
    galar: { min: 810, max: 898 },
  };

  // ---- DOM refs ----
  const $ = (id) => document.getElementById(id);

  const screens = {
    start: $("screen-start"),
    quiz: $("screen-quiz"),
    result: $("screen-result"),
  };

  // ---- Helpers ----
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function getImagePath(pokemon) {
    const idStr = String(pokemon.id).padStart(3, "0");
    return `images/pokedex/hires/${idStr}.png`;
  }

  function getDisplayName(pokemon) {
    return pokemon.name[state.lang] || pokemon.name.english;
  }

  function normalize(str) {
    return str
      .trim()
      .toLowerCase()
      .replace(/[\s\u3000]+/g, "")
      .replace(/[ァ-ン]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }

  function isCorrectAnswer(input, pokemon) {
    const normalizedInput = normalize(input);
    if (!normalizedInput) return false;

    const names = [
      pokemon.name.japanese,
      pokemon.name.english,
      pokemon.name.chinese,
      pokemon.name.french,
    ].filter(Boolean);

    return names.some((name) => normalize(name) === normalizedInput);
  }

  function getSelectedRegions() {
    const checkboxes = document.querySelectorAll(
      'input[name="region"]:checked',
    );
    return Array.from(checkboxes).map((cb) => cb.value);
  }

  function filterByRegions(pokemonList) {
    const selected = getSelectedRegions();
    if (selected.length === 0) return [];
    return pokemonList.filter((p) =>
      selected.some((key) => {
        const r = REGIONS[key];
        return p.id >= r.min && p.id <= r.max;
      }),
    );
  }

  function updateStartCount() {
    const count = filterByRegions(state.allPokemon).length;
    $("start-count").textContent = count;
    $("btn-start").disabled = count === 0;
  }

  function saveSettings() {
    try {
      const settings = {
        lang: $("lang-select").value,
        regions: getSelectedRegions(),
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  function loadSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) return;
      const settings = JSON.parse(data);

      if (settings.lang) {
        $("lang-select").value = settings.lang;
      }

      if (Array.isArray(settings.regions)) {
        document.querySelectorAll('input[name="region"]').forEach((cb) => {
          cb.checked = settings.regions.includes(cb.value);
        });
      }
    } catch {
      // ignore
    }
  }

  function loadSavedWrongList() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveWrongList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  // ---- Data Loading ----
  async function loadPokedex() {
    if (typeof POKEDEX_DATA !== "undefined") {
      state.allPokemon = POKEDEX_DATA;
      return;
    }
    const res = await fetch("pokedex.json");
    state.allPokemon = await res.json();
  }

  // ---- Quiz Logic ----
  function startQuiz(pokemonList) {
    state.quizQueue = shuffle(pokemonList);
    state.currentIndex = 0;
    state.correctCount = 0;
    state.wrongCount = 0;
    state.wrongList = [];
    state.lang = $("lang-select").value;
    showScreen("quiz");
    $("total-num").textContent = state.quizQueue.length;
    showQuestion();
  }

  function showQuestion() {
    state.answered = false;
    state.currentPokemon = state.quizQueue[state.currentIndex];

    $("current-num").textContent = state.currentIndex + 1;
    $("correct-count").textContent = state.correctCount;
    $("wrong-count").textContent = state.wrongCount;

    const img = $("pokemon-image");
    img.src = getImagePath(state.currentPokemon);
    img.alt = `No.${state.currentPokemon.id}`;

    $("quiz-input-area").style.display = "flex";
    $("quiz-feedback").style.display = "none";

    const input = $("answer-input");
    input.value = "";
    input.focus();
  }

  function submitAnswer(skipped) {
    if (state.answered) return;
    state.answered = true;

    const input = $("answer-input").value;
    const pokemon = state.currentPokemon;
    const correct = !skipped && isCorrectAnswer(input, pokemon);

    if (correct) {
      state.correctCount++;
    } else {
      state.wrongCount++;
      state.wrongList.push({
        id: pokemon.id,
        name: {
          japanese: pokemon.name.japanese,
          english: pokemon.name.english,
        },
        image: getImagePath(pokemon),
        yourAnswer: skipped ? "(スキップ)" : input,
      });
    }

    $("correct-count").textContent = state.correctCount;
    $("wrong-count").textContent = state.wrongCount;

    const feedback = $("quiz-feedback");
    const displayName = getDisplayName(pokemon);

    feedback.className = `feedback ${correct ? "correct" : "wrong"}`;
    $("feedback-icon").textContent = correct ? "○" : "×";
    $("feedback-text").textContent = correct
      ? "正解！"
      : `正解: ${displayName}`;
    $("feedback-detail").textContent = correct
      ? displayName
      : skipped
        ? ""
        : `あなたの回答: ${input}`;

    $("quiz-input-area").style.display = "none";
    feedback.style.display = "block";

    $("btn-next").focus();
  }

  function nextQuestion() {
    state.currentIndex++;
    if (state.currentIndex >= state.quizQueue.length) {
      showResult();
    } else {
      showQuestion();
    }
  }

  function showResult() {
    const total = state.correctCount + state.wrongCount;
    const rate = total > 0 ? Math.round((state.correctCount / total) * 100) : 0;

    $("result-total").textContent = total;
    $("result-correct").textContent = state.correctCount;
    $("result-wrong").textContent = state.wrongCount;
    $("result-rate").textContent = rate + "%";

    const wrongSection = $("wrong-list-section");
    const wrongListEl = $("wrong-list");
    const retryWrongBtn = $("btn-retry-wrong");

    if (state.wrongList.length > 0) {
      saveWrongList(state.wrongList);
      wrongSection.style.display = "block";
      retryWrongBtn.style.display = "inline-block";
      wrongListEl.innerHTML = state.wrongList
        .map(
          (w) => `
        <div class="wrong-card">
          <div class="card-id">No.${w.id}</div>
          <img src="${w.image}" alt="No.${w.id}">
          <div class="card-name">${w.name.japanese}</div>
          <div class="card-name" style="font-size:0.8rem;color:#888;">${w.name.english}</div>
          <div class="card-answer">${w.yourAnswer}</div>
        </div>
      `,
        )
        .join("");
    } else {
      wrongSection.style.display = "none";
      retryWrongBtn.style.display = "none";
      localStorage.removeItem(STORAGE_KEY);
    }

    showScreen("result");
  }

  // ---- Event Handlers ----
  function setupEvents() {
    $("btn-start").addEventListener("click", () => {
      const filtered = filterByRegions(state.allPokemon);
      if (filtered.length === 0) return;
      startQuiz(filtered);
    });

    document.querySelectorAll('input[name="region"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        updateStartCount();
        saveSettings();
      });
    });

    $("lang-select").addEventListener("change", saveSettings);

    $("btn-region-all").addEventListener("click", () => {
      document.querySelectorAll('input[name="region"]').forEach((cb) => {
        cb.checked = true;
      });
      updateStartCount();
      saveSettings();
    });

    $("btn-region-none").addEventListener("click", () => {
      document.querySelectorAll('input[name="region"]').forEach((cb) => {
        cb.checked = false;
      });
      updateStartCount();
      saveSettings();
    });

    $("btn-start-review").addEventListener("click", () => {
      const saved = loadSavedWrongList();
      if (!saved || saved.length === 0) return;

      const ids = new Set(saved.map((w) => w.id));
      const reviewPokemon = state.allPokemon.filter((p) => ids.has(p.id));
      startQuiz(reviewPokemon);
    });

    $("btn-answer").addEventListener("click", () => {
      submitAnswer(false);
    });

    $("btn-skip").addEventListener("click", () => {
      submitAnswer(true);
    });

    $("answer-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!state.answered) {
          submitAnswer(false);
        } else {
          nextQuestion();
        }
      }
    });

    $("btn-next").addEventListener("click", () => {
      nextQuestion();
    });

    $("btn-quit").addEventListener("click", () => {
      showResult();
    });

    $("btn-retry-all").addEventListener("click", () => {
      const filtered = filterByRegions(state.allPokemon);
      startQuiz(filtered.length > 0 ? filtered : state.allPokemon);
    });

    $("btn-retry-wrong").addEventListener("click", () => {
      const ids = new Set(state.wrongList.map((w) => w.id));
      const reviewPokemon = state.allPokemon.filter((p) => ids.has(p.id));
      startQuiz(reviewPokemon);
    });

    $("btn-back-top").addEventListener("click", () => {
      updateStartScreen();
      showScreen("start");
    });
  }

  function updateStartScreen() {
    const saved = loadSavedWrongList();
    const reviewBtn = $("btn-start-review");
    if (saved && saved.length > 0) {
      reviewBtn.style.display = "inline-block";
      $("review-count").textContent = saved.length;
    } else {
      reviewBtn.style.display = "none";
    }
  }

  // ---- Viewport (mobile keyboard) ----
  function setupViewport() {
    function update() {
      const h = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", h + "px");
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update);
      window.visualViewport.addEventListener("scroll", () => {
        window.scrollTo(0, 0);
      });
    }
    window.addEventListener("resize", update);
    update();
  }

  // ---- Init ----
  async function init() {
    setupViewport();
    loadSettings();
    await loadPokedex();
    updateStartScreen();
    updateStartCount();
    setupEvents();
  }

  init();
})();
