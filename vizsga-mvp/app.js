const STORAGE_KEY = "villany-vizsga-mvp:v1";
const DATA_FILES = {
  questions: "../kerdesbank/questions.csv",
  choices: "../kerdesbank/choices.csv",
  sources: "../kerdesbank/sources.csv",
  assets: "../kerdesbank/assets.csv",
};

// Official interaktív vizsgaidő: 90 perc.
// The question count is not published officially; we use an approximate 40-question baseline
// for proportional timing, based on the real exam screenshots and available practice material.
const OFFICIAL_EXAM_TIME_SECONDS = 90 * 60;
const OFFICIAL_EXAM_QUESTION_COUNT = 40;

const SUPPORTED_TYPES = new Set([
  "single_choice",
  "multi_choice",
  "true_false",
  "list_choice",
  "ordering",
  "matching",
  "grouping",
  "numeric_entry",
]);

const TOPIC_ALIASES = new Map([
  ["erintesvedelem", "érintésvédelem"],
  ["érintésvédelem", "érintésvédelem"],
  ["vezeték", "vezetékek"],
  ["vezetékezés", "vezetékek"],
  ["vezetékjelölés", "vezetékek"],
  ["kábel", "vezetékek"],
]);

let orderingDragState = null;

const state = loadState();
let data = null;

const els = {
  datasetStatus: document.getElementById("datasetStatus"),
  datasetMeta: document.getElementById("datasetMeta"),
  mobileStatusDock: document.getElementById("mobileStatusDock"),
  mobileClock: document.getElementById("mobileClock"),
  mobileProgressDock: document.getElementById("mobileProgressDock"),
  toggleStatusPanelButton: document.getElementById("toggleStatusPanelButton"),
  toggleSummaryPanelButton: document.getElementById("toggleSummaryPanelButton"),
  statusPanel: document.getElementById("statusPanel"),
  summaryPanel: document.getElementById("summaryPanel"),
  examClock: document.getElementById("examClock"),
  examClockMeta: document.getElementById("examClockMeta"),
  poolCountChip: document.getElementById("poolCountChip"),
  topicFilters: document.getElementById("topicFilters"),
  questionCountInput: document.getElementById("questionCountInput"),
  startSessionButton: document.getElementById("startSessionButton"),
  selectAllTopicsButton: document.getElementById("selectAllTopicsButton"),
  clearTopicsButton: document.getElementById("clearTopicsButton"),
  progressCurrent: document.getElementById("progressCurrent"),
  answeredCount: document.getElementById("answeredCount"),
  skippedCount: document.getElementById("skippedCount"),
  scoreCount: document.getElementById("scoreCount"),
  progressFill: document.getElementById("progressFill"),
  modeChip: document.getElementById("modeChip"),
  questionNav: document.getElementById("questionNav"),
  skipQueue: document.getElementById("skipQueue"),
  skipQueueCount: document.getElementById("skipQueueCount"),
  questionKicker: document.getElementById("questionKicker"),
  questionTitle: document.getElementById("questionTitle"),
  questionTypeChip: document.getElementById("questionTypeChip"),
  questionIdChip: document.getElementById("questionIdChip"),
  difficultyChip: document.getElementById("difficultyChip"),
  questionMeta: document.getElementById("questionMeta"),
  prompt: document.getElementById("prompt"),
  choices: document.getElementById("choices"),
  answerHint: document.getElementById("answerHint"),
  unsupportedBlock: document.getElementById("unsupportedBlock"),
  nextButton: document.getElementById("nextButton"),
  skipButton: document.getElementById("skipButton"),
  resetButton: document.getElementById("resetButton"),
  evaluateButton: document.getElementById("evaluateButton"),
  resultsPanel: document.getElementById("resultsPanel"),
  resultScore: document.getElementById("resultScore"),
  resultCorrect: document.getElementById("resultCorrect"),
  resultWrong: document.getElementById("resultWrong"),
  resultTotal: document.getElementById("resultTotal"),
  resultNote: document.getElementById("resultNote"),
  reviewList: document.getElementById("reviewList"),
  questionCard: document.getElementById("questionCard"),
};

let examClockTimer = null;

init().catch((error) => {
  console.error(error);
  els.datasetStatus.textContent = "Betöltési hiba";
  els.datasetMeta.textContent = error.message;
  syncMobileDock();
  els.questionTitle.textContent = "Nem sikerült betölteni a kérdésbankot";
  els.prompt.innerHTML =
    "<p>Valószínűleg a CSV elérési útja nem jó, vagy a fájlt nem statikus szerveren nyitottad meg.</p>";
});

async function init() {
  const [questionsText, choicesText, sourcesText, assetsText] = await Promise.all([
    fetch(DATA_FILES.questions, { cache: "no-store" }).then(requireOk).then((r) => r.text()),
    fetch(DATA_FILES.choices, { cache: "no-store" }).then(requireOk).then((r) => r.text()),
    fetch(DATA_FILES.sources, { cache: "no-store" }).then(requireOk).then((r) => r.text()),
    fetch(DATA_FILES.assets, { cache: "no-store" }).then(requireOk).then((r) => r.text()),
  ]);

  const questions = parseCsv(questionsText);
  const choices = parseCsv(choicesText);
  const sources = parseCsv(sourcesText);
  const assets = parseCsv(assetsText);

  data = buildData(questions, choices, sources, assets);
  hydrateStateFromData();
  renderTopicFilters();
  wireSettingsEvents();
  wireEvents();
  render();
  startExamClockTicker();
  els.datasetStatus.textContent = "Készen áll";
  syncMobileDock();
  els.datasetMeta.textContent = `${data.questions.length} kérdés, ${data.sources.size} forrás, ${data.assets.length} asset`;
}

function requireOk(response) {
  if (!response.ok) {
    throw new Error(`Nem sikerült betölteni: ${response.url}`);
  }
  return response;
}

function buildData(questionRows, choiceRows, sourceRows, assetRows) {
  const sources = new Map();
  for (const row of sourceRows) {
    if (!row.source_id) continue;
    sources.set(row.source_id, row);
  }

  const assetsByQuestion = new Map();
  for (const row of assetRows) {
    if (!row.question_id) continue;
    const list = assetsByQuestion.get(row.question_id) || [];
    list.push({
      ...row,
      path: row.path || "",
      kind: row.kind || "image",
    });
    assetsByQuestion.set(row.question_id, list);
  }

  const choicesByQuestion = new Map();
  for (const row of choiceRows) {
    if (!row.question_id) continue;
    const list = choicesByQuestion.get(row.question_id) || [];
    list.push({
      ...row,
      sort_order: Number(row.sort_order || 0),
      is_correct: String(row.is_correct).trim().toLowerCase() === "true",
    });
    choicesByQuestion.set(row.question_id, list);
  }

  const questions = questionRows
    .filter((row) => row.question_id)
    .map((row, index) => {
      const rawChoices = choicesByQuestion.get(row.question_id) || [];
      const qChoices =
        row.question_type === "ordering" || row.question_type === "matching" || row.question_type === "grouping"
          ? [...rawChoices]
          : [...rawChoices].sort((a, b) => a.sort_order - b.sort_order);
      return {
        ...row,
        index,
        topic: normalizeTopic(row.topic),
        difficulty: Number(row.difficulty || 0),
        points: Number(row.points || 0),
        time_estimate_sec: Number(row.time_estimate_sec || 0),
        answer_tolerance: Number(row.answer_tolerance || 0),
        correct_answer_md: row.correct_answer_md || "",
        choices: qChoices,
        assets: assetsByQuestion.get(row.question_id) || [],
        source: sources.get(row.source_id) || null,
      };
    });

  const questionsById = new Map(questions.map((question) => [question.question_id, question]));

  const assets = assetRows.map((row) => ({
    ...row,
    path: row.path || "",
    kind: row.kind || "image",
  }));

  return { questions, questionsById, sources, choicesByQuestion, assets };
}

function buildPresentationForQuestion(question) {
  const presentation = {};

  if (
    question.question_type === "single_choice" ||
    question.question_type === "multi_choice" ||
    question.question_type === "true_false" ||
    question.question_type === "list_choice"
  ) {
    presentation.choiceOrder = shuffle(question.choices.map((choice) => choice.choice_id));
  }

  if (question.question_type === "matching") {
    const leftIds = question.choices.filter((choice) => choice.match_role === "left").map((choice) => choice.choice_id);
    const rightIds = question.choices.filter((choice) => choice.match_role === "right").map((choice) => choice.choice_id);
    presentation.leftOrder = shuffle(leftIds);
    presentation.rightOrder = shuffle(rightIds);
  }

  if (question.question_type === "grouping") {
    presentation.itemOrder = shuffle(question.choices.map((choice) => choice.choice_id));
    presentation.groupOrder = shuffle([...new Set(question.choices.map((choice) => choice.group_label).filter(Boolean))]);
  }

  return presentation;
}

function ensureQuestionPresentation(question) {
  if (!state.session || !question) return null;
  state.session.presentationByQuestionId = state.session.presentationByQuestionId || {};
  if (!state.session.presentationByQuestionId[question.question_id]) {
    state.session.presentationByQuestionId[question.question_id] = buildPresentationForQuestion(question);
  }
  return state.session.presentationByQuestionId[question.question_id];
}

function getSessionQuestionIds() {
  const mainIds = state.session?.questionIds || [];
  const reviewIds = state.session?.reviewQuestionIds || [];
  return [...new Set([...mainIds, ...reviewIds])];
}

function ensureSessionPresentation() {
  if (!state.session || !data) return;
  state.session.presentationByQuestionId = state.session.presentationByQuestionId || {};
  let changed = false;
  for (const questionId of getSessionQuestionIds()) {
    const question = data.questionsById.get(questionId);
    if (!question) continue;
    if (!state.session.presentationByQuestionId[questionId]) {
      state.session.presentationByQuestionId[questionId] = buildPresentationForQuestion(question);
      changed = true;
    }
  }
  if (changed) {
    saveState();
  }
}

function hydrateStateFromData() {
  state.settings = state.settings || {};
  state.settings.selectedTopics = normalizeSelectedTopics(
    state.settings.selectedTopics,
    getAllTopics()
  );

  state.session = state.session || {};
  state.session.questionIds = Array.isArray(state.session.questionIds) ? state.session.questionIds : [];
  state.session.reviewQuestionIds = Array.isArray(state.session.reviewQuestionIds) ? state.session.reviewQuestionIds : [];
  state.session.phase = state.session.phase || "main";
  state.session.presentationByQuestionId = state.session.presentationByQuestionId || {};

  const filteredPool = getFilteredPool();
  const defaultCount = Math.min(10, filteredPool.length || 1);
  const desiredCount = Number(state.settings.questionCount || defaultCount);
  state.settings.questionCount = clamp(desiredCount, 1, Math.max(filteredPool.length, 1));

  if (!Array.isArray(state.session.questionIds) || state.session.questionIds.length === 0) {
    startNewSession({ silent: true });
  } else {
    syncSessionWithData();
  }

  for (const question of getSessionQuestions()) {
    state.answers[question.question_id] = normalizeStoredAnswer(question, state.answers[question.question_id]);
    if (typeof state.skipped[question.question_id] !== "boolean") {
      state.skipped[question.question_id] = false;
    }
  }
  ensureSessionClock();
  ensureSessionPresentation();
  saveState();
}

function wireEvents() {
  els.nextButton.addEventListener("click", () => {
    advance();
  });
  els.skipButton.addEventListener("click", () => {
    const current = currentQuestion();
    if (!current) return;
    state.skipped[current.question_id] = true;
    saveState();
    advance();
  });
  els.resetButton.addEventListener("click", () => {
    if (!confirm("Biztosan újrakezdjük a gyakorlást?")) return;
    resetSession();
  });
  els.evaluateButton.addEventListener("click", () => {
    if (!state.session.completed) {
      completeSession();
      return;
    }
    renderResults();
    els.resultsPanel.hidden = false;
    els.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.toggleStatusPanelButton?.addEventListener("click", () => {
    toggleMobilePanel("status");
  });

  els.toggleSummaryPanelButton?.addEventListener("click", () => {
    toggleMobilePanel("summary");
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const current = currentQuestion();
    if (!current) return;

    if (
      target instanceof HTMLInputElement &&
      target.name === "choice" &&
      (current.question_type === "single_choice" || current.question_type === "true_false")
    ) {
      state.answers[current.question_id] = [target.value];
      state.skipped[current.question_id] = false;
      saveAndRender();
      return;
    }

    if (target instanceof HTMLInputElement && target.name === "choice" && current.question_type === "multi_choice") {
      const selected = new Set(state.answers[current.question_id] || []);
      if (target.checked) {
        selected.add(target.value);
      } else {
        selected.delete(target.value);
      }
      state.answers[current.question_id] = [...selected];
      if (state.answers[current.question_id].length > 0) {
        state.skipped[current.question_id] = false;
      }
      saveAndRender();
      return;
    }

    if (target instanceof HTMLSelectElement && target.classList.contains("list-choice-select") && current.question_type === "list_choice") {
      state.answers[current.question_id] = target.value ? [target.value] : [];
      state.skipped[current.question_id] = false;
      saveAndRender();
      return;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("numeric-answer") && current.question_type === "numeric_entry") {
      const value = target.value.trim();
      state.answers[current.question_id] = value ? [value] : [];
      if (value) {
        state.skipped[current.question_id] = false;
      }
      saveAndRender();
      return;
    }

    if (target instanceof HTMLSelectElement && target.classList.contains("matching-select") && current.question_type === "matching") {
      const next = {};
      for (const select of els.choices.querySelectorAll(".matching-select")) {
        const leftChoiceId = select.dataset.leftChoiceId;
        if (!leftChoiceId || !select.value) continue;
        next[leftChoiceId] = select.value;
      }
      state.answers[current.question_id] = next;
      state.skipped[current.question_id] = Object.keys(next).length > 0 ? false : state.skipped[current.question_id];
      saveAndRender();
      return;
    }

    if (target instanceof HTMLSelectElement && target.classList.contains("grouping-select") && current.question_type === "grouping") {
      const next = {};
      for (const select of els.choices.querySelectorAll(".grouping-select")) {
        const itemId = select.dataset.itemId;
        if (!itemId || !select.value) continue;
        next[itemId] = select.value;
      }
      state.answers[current.question_id] = next;
      state.skipped[current.question_id] = Object.keys(next).length > 0 ? false : state.skipped[current.question_id];
      saveAndRender();
      return;
    }
  });

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest(".ordering-item");
    if (!item) return;
    const current = currentQuestion();
    if (!current || current.question_type !== "ordering") return;
    orderingDragState = {
      questionId: current.question_id,
      choiceId: item.dataset.choiceId || "",
    };
    item.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", orderingDragState.choiceId);
    }
  });

  document.addEventListener("dragover", (event) => {
    if (!orderingDragState) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest(".ordering-item");
    const list = target.closest(".ordering-list");
    if (!item && !list) return;
    const current = currentQuestion();
    if (!current || current.question_type !== "ordering" || current.question_id !== orderingDragState.questionId) return;
    event.preventDefault();
    clearOrderingDropStates();
    if (item) {
      item.classList.add("is-drop-target");
    }
  });

  document.addEventListener("drop", (event) => {
    if (!orderingDragState) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const current = currentQuestion();
    if (!current || current.question_type !== "ordering" || current.question_id !== orderingDragState.questionId) return;
    const item = target.closest(".ordering-item");
    const list = target.closest(".ordering-list");
    if (!item && !list) return;
    event.preventDefault();
    const rect = item ? item.getBoundingClientRect() : null;
    const insertBefore = !rect || event.clientY < rect.top + rect.height / 2;
    reorderOrderingAnswer(current, orderingDragState.choiceId, item?.dataset.choiceId || "", insertBefore);
    orderingDragState = null;
    clearOrderingDropStates();
  });

  document.addEventListener("dragend", () => {
    orderingDragState = null;
    clearOrderingDropStates();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const questionButton = target.closest("[data-question-id]");
    if (!questionButton) return;
    const id = questionButton.getAttribute("data-question-id");
    if (!id) return;
    const index = getSessionQuestions().findIndex((question) => question.question_id === id);
    if (index === -1) return;
    state.session.currentIndex = index;
    saveState();
    render();
    els.questionCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function wireSettingsEvents() {
  els.startSessionButton.addEventListener("click", () => {
    startNewSession();
    render();
    els.questionCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.selectAllTopicsButton.addEventListener("click", () => {
    state.settings.selectedTopics = getAllTopics();
    syncQuestionCountInput();
    saveState();
    renderTopicFilters();
    renderSessionHeader();
  });

  els.clearTopicsButton.addEventListener("click", () => {
    state.settings.selectedTopics = getAllTopics();
    syncQuestionCountInput();
    saveState();
    renderTopicFilters();
    renderSessionHeader();
  });

  els.questionCountInput.addEventListener("change", () => {
    const filteredPool = getFilteredPool();
    const nextCount = clamp(Number(els.questionCountInput.value || 1), 1, Math.max(filteredPool.length, 1));
    state.settings.questionCount = nextCount;
    els.questionCountInput.value = String(nextCount);
    saveState();
    renderSessionHeader();
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("topic-filter-checkbox")) return;
    const topic = target.value;
    const selected = new Set(state.settings.selectedTopics || []);
    if (target.checked) {
      selected.add(topic);
    } else {
      selected.delete(topic);
    }
    state.settings.selectedTopics = normalizeSelectedTopics([...selected], getAllTopics());
    syncQuestionCountInput();
    saveState();
    renderSessionHeader();
    renderTopicFilters();
  });
}

function render() {
  if (!data) return;
  const current = currentQuestion();
  renderSessionHeader();
  renderSummary();
  renderExamClock();
  syncMobilePanelButtons();
  renderNav();
  renderSkipQueue();
  if (state.session.completed) {
    els.questionCard.hidden = true;
    els.resultsPanel.hidden = false;
  } else {
    els.questionCard.hidden = false;
    renderQuestion(current);
    els.resultsPanel.hidden = true;
  }
}

function renderSessionHeader() {
  const pool = getFilteredPool();
  const questions = getSessionQuestions();
  const topics = state.settings.selectedTopics || [];
  const allTopics = getAllTopics();
  const allTopicsSelected = topics.length === allTopics.length;

  els.poolCountChip.textContent = `${pool.length} kérdés`;
  els.datasetMeta.textContent = `${data.questions.length} kérdés, ${data.sources.size} forrás`;
  els.questionCountInput.value = String(state.settings.questionCount || Math.min(10, pool.length || 1));
  els.questionCountInput.max = String(Math.max(pool.length, 1));

  const visibleCount = questions.length;
  const selectedCount = topics.length;
  els.modeChip.textContent = allTopicsSelected
    ? `Minden téma / ${visibleCount} kérdéses teszt`
    : selectedCount
      ? `${selectedCount} téma / ${visibleCount} kérdéses teszt`
      : `${visibleCount} kérdéses teszt`;

  syncMobileDock();
  updateNextButtonLabel();
}

function renderTopicFilters() {
  const topics = getAllTopics();
  const selected = new Set(state.settings.selectedTopics || []);
  els.topicFilters.innerHTML = "";

  for (const topic of topics) {
    const count = data.questions.filter((question) => question.topic === topic).length;
    const label = document.createElement("label");
    label.className = "topic-option";
    label.innerHTML = `
      <input class="topic-filter-checkbox" type="checkbox" value="${escapeHtml(topic)}" ${selected.has(topic) ? "checked" : ""} />
      <div>
        <strong>${escapeHtml(prettyTopic(topic))}</strong>
        <span>${count} kérdés</span>
      </div>
    `;
    els.topicFilters.appendChild(label);
  }
}

function startNewSession(options = {}) {
  const pool = getFilteredPool();
  const questionCount = clamp(
    Number(state.settings.questionCount || Math.min(10, pool.length || 1)),
    1,
    Math.max(pool.length, 1)
  );
  const shuffled = shuffle(pool);
  const chosen = shuffled.slice(0, Math.min(questionCount, shuffled.length));

  state.settings.questionCount = questionCount;
  state.session = {
    questionIds: chosen.map((question) => question.question_id),
    reviewQuestionIds: [],
    currentIndex: 0,
    phase: "main",
    completed: false,
    completedAt: null,
    startedAt: new Date().toISOString(),
    examDurationSeconds: getExamDurationForQuestionCount(chosen.length),
    presentationByQuestionId: {},
  };
  state.answers = {};
  state.skipped = {};
  for (const question of chosen) {
    state.answers[question.question_id] = createDefaultAnswer(question);
    state.skipped[question.question_id] = false;
  }

  ensureSessionPresentation();
  if (!options.silent) {
    saveState();
  }
  syncQuestionCountInput();
  renderExamClock();
}

function syncSessionWithData() {
  const allowed = new Set(getFilteredPool().map((question) => question.question_id));
  const keptIds = (state.session.questionIds || []).filter((questionId) => allowed.has(questionId));
  const keptReviewIds = (state.session.reviewQuestionIds || []).filter((questionId) => allowed.has(questionId));

  if (keptIds.length === 0 && keptReviewIds.length === 0) {
    startNewSession({ silent: true });
    return;
  }

  state.session.questionIds = keptIds;
  state.session.reviewQuestionIds = keptReviewIds;
  state.session.presentationByQuestionId = state.session.presentationByQuestionId || {};
  const allowedIds = new Set([...keptIds, ...keptReviewIds]);
  for (const questionId of Object.keys(state.session.presentationByQuestionId)) {
    if (!allowedIds.has(questionId)) {
      delete state.session.presentationByQuestionId[questionId];
    }
  }
  state.session.phase = state.session.phase === "review" && keptReviewIds.length > 0 ? "review" : "main";
  state.session.currentIndex = clamp(
    Number(state.session.currentIndex || 0),
    0,
    Math.max(getSessionQuestions().length - 1, 0)
  );
  state.session.completed = Boolean(state.session.completed && keptIds.length > 0);
  ensureSessionClock();
  ensureSessionPresentation();
}

function getFilteredPool() {
  const selected = new Set(state.settings.selectedTopics || []);
  const pool = data.questions.filter((question) => {
    const topicOk = selected.size === 0 || selected.has(question.topic);
    return topicOk;
  });
  return pool.filter((question) => SUPPORTED_TYPES.has(question.question_type));
}

function getSessionQuestions() {
  const phase = state.session?.phase || "main";
  const ids =
    phase === "review"
      ? state.session?.reviewQuestionIds || []
      : state.session?.questionIds || [];
  return ids.map((questionId) => data.questionsById.get(questionId)).filter(Boolean);
}

function getMainSessionQuestions() {
  const ids = state.session?.questionIds || [];
  return ids.map((questionId) => data.questionsById.get(questionId)).filter(Boolean);
}

function questionsIndexInSession(questionId) {
  return getSessionQuestions().findIndex((question) => question.question_id === questionId);
}

function getAllTopics() {
  return [...new Set(data.questions.map((question) => question.topic).filter(Boolean))].sort((a, b) =>
    prettyTopic(a).localeCompare(prettyTopic(b), "hu")
  );
}

function normalizeSelectedTopics(selectedTopics, allTopics) {
  const selected = Array.isArray(selectedTopics)
    ? selectedTopics.map(normalizeTopic).filter(Boolean)
    : [];
  if (selected.length === 0) {
    return [...allTopics];
  }
  const allowed = new Set(allTopics);
  const normalized = [...new Set(selected)].filter((topic) => allowed.has(topic));
  return normalized.length > 0 ? normalized : [...allTopics];
}

function prettyTopic(topic) {
  return String(topic || "")
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("hu-HU") + word.slice(1))
    .join(" ");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function syncQuestionCountInput() {
  const pool = getFilteredPool();
  const max = Math.max(pool.length, 1);
  const nextCount = clamp(Number(state.settings.questionCount || 1), 1, max);
  state.settings.questionCount = nextCount;
  els.questionCountInput.max = String(max);
  els.questionCountInput.value = String(nextCount);
}

function advance() {
  const questions = getSessionQuestions();
  if (questions.length === 0) return;
  const current = currentQuestion();
  if (current && !isQuestionAnswered(current)) {
    state.skipped[current.question_id] = true;
    if (state.session.phase !== "review") {
      const reviewQueue = state.session.reviewQuestionIds || [];
      if (!reviewQueue.includes(current.question_id)) {
        reviewQueue.push(current.question_id);
      }
      state.session.reviewQuestionIds = reviewQueue;
    }
  }

  if ((state.session.currentIndex || 0) >= questions.length - 1) {
    if (state.session.phase !== "review" && (state.session.reviewQuestionIds || []).length > 0) {
      state.session.phase = "review";
      state.session.currentIndex = 0;
      saveState();
      render();
      return;
    }
    completeSession();
    return;
  }

  state.session.currentIndex += 1;
  saveState();
  render();
}

function completeSession() {
  state.session.completed = true;
  state.session.phase = "done";
  state.session.completedAt = new Date().toISOString();
  saveState();
  renderResults();
  render();
  els.resultsPanel.hidden = false;
  els.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateNextButtonLabel() {
  const questions = getSessionQuestions();
  if (questions.length === 0) {
    els.nextButton.textContent = "Következő feladat";
    return;
  }
  const isLast = (state.session.currentIndex || 0) >= questions.length - 1;
  const isReviewPhase = state.session.phase === "review";
  const hasReviewQueue = (state.session.reviewQuestionIds || []).length > 0;

  if (isReviewPhase) {
    els.nextButton.textContent = isLast ? "Kiértékelés" : "Következő feladat";
    return;
  }

  els.nextButton.textContent = isLast && !hasReviewQueue ? "Kiértékelés" : "Következő feladat";
}

function ensureSessionClock() {
  if (!state.session) return;
  const questionCount = (state.session.questionIds || []).length || Number(state.settings.questionCount || 1);
  const nextDuration = getExamDurationForQuestionCount(questionCount);
  let changed = false;

  if (!state.session.startedAt && !state.session.completed) {
    state.session.startedAt = new Date().toISOString();
    changed = true;
  }

  if (state.session.examDurationSeconds !== nextDuration) {
    state.session.examDurationSeconds = nextDuration;
    changed = true;
  }

  if (changed) {
    saveState();
  }
}

function getExamDurationForQuestionCount(questionCount) {
  const count = Math.max(1, Number(questionCount || 1));
  return Math.max(60, Math.round((OFFICIAL_EXAM_TIME_SECONDS * count) / OFFICIAL_EXAM_QUESTION_COUNT));
}

function getExamClockState() {
  const startedAt = state.session?.startedAt ? Date.parse(state.session.startedAt) : Number.NaN;
  const duration = Number(state.session?.examDurationSeconds || 0);
  const launchedCount = getSessionQuestions().length || 0;

  if (!Number.isFinite(startedAt) || duration <= 0) {
    return {
      display: "--:--",
      meta: `Alap: 90 perc / kb. 40 kérdés`,
    };
  }

  const referenceTime = state.session.completedAt ? Date.parse(state.session.completedAt) : Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((referenceTime - startedAt) / 1000));
  const remainingSeconds = Math.max(0, duration - elapsedSeconds);
  return {
    display: formatDuration(remainingSeconds),
    meta: `Arányosított idő: ${formatDuration(duration)} · ${launchedCount} indított kérdés · alap: 90 perc / kb. 40 kérdés`,
  };
}

function renderExamClock() {
  if (!els.examClock || !els.examClockMeta) return;
  const { display, meta } = getExamClockState();
  els.examClock.textContent = display;
  els.examClockMeta.textContent = meta;
  if (els.mobileClock) {
    els.mobileClock.textContent = display;
  }
}

function syncMobileDock() {
  if (els.mobileStatusDock) {
    els.mobileStatusDock.textContent = els.datasetStatus?.textContent || "Készen áll";
  }
  if (els.mobileProgressDock && els.progressCurrent) {
    els.mobileProgressDock.textContent = els.progressCurrent.textContent || "0 / 0";
  }
}

function toggleMobilePanel(panelName) {
  const target = panelName === "status" ? els.statusPanel : els.summaryPanel;
  const other = panelName === "status" ? els.summaryPanel : els.statusPanel;
  if (!target) return;
  const isOpen = target.dataset.panelState === "open";
  target.dataset.panelState = isOpen ? "closed" : "open";
  if (other && !isOpen) {
    other.dataset.panelState = "closed";
  }
  syncMobilePanelButtons();
}

function syncMobilePanelButtons() {
  const statusOpen = els.statusPanel?.dataset.panelState === "open";
  const summaryOpen = els.summaryPanel?.dataset.panelState === "open";
  if (els.toggleStatusPanelButton) {
    els.toggleStatusPanelButton.textContent = statusOpen ? "Állapot bezárása" : "Állapot";
  }
  if (els.toggleSummaryPanelButton) {
    els.toggleSummaryPanelButton.textContent = summaryOpen ? "Áttekintés bezárása" : "Áttekintés";
  }
}

function startExamClockTicker() {
  if (examClockTimer) {
    clearInterval(examClockTimer);
  }
  examClockTimer = setInterval(() => {
    renderExamClock();
  }, 1000);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function renderSummary() {
  const questions = state.session.completed ? getMainSessionQuestions() : getSessionQuestions();
  const total = questions.length;
  const answered = questions.filter((q) => isQuestionAnswered(q)).length;
  const skipped = questions.filter((q) => state.skipped[q.question_id]).length;
  const score = evaluate().earnedPoints;
  const currentIndex = state.session.currentIndex || 0;

  els.progressCurrent.textContent = total ? `${Math.min(currentIndex + 1, total)} / ${total}` : "0 / 0";
  els.answeredCount.textContent = String(answered);
  els.skippedCount.textContent = String(skipped);
  els.scoreCount.textContent = String(score);
  if (els.skipQueueCount) {
    els.skipQueueCount.textContent = String(skipped);
  }
  if (els.mobileProgressDock) {
    els.mobileProgressDock.textContent = total ? `${Math.min(currentIndex + 1, total)} / ${total}` : "0 / 0";
  }
  els.progressFill.style.width = total ? `${((Math.min(currentIndex + 1, total)) / total) * 100}%` : "0%";
}

function renderNav() {
  if (!els.questionNav) return;
  els.questionNav.innerHTML = "";
  const questions = getSessionQuestions();
  questions.forEach((question, sessionIndex) => {
    const stateLabel = getQuestionState(question.question_id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-item";
    button.dataset.questionId = question.question_id;
    button.dataset.state = stateLabel;
    button.dataset.active = String(question.question_id === currentQuestion()?.question_id);
    button.textContent = String(sessionIndex + 1);
    button.title = `${sessionIndex + 1}. kérdés`;
    els.questionNav.appendChild(button);
  });
}

function renderSkipQueue() {
  if (!els.skipQueue) return;
  const skippedQuestions = getSessionQuestions().filter((q) => state.skipped[q.question_id]);
  if (skippedQuestions.length === 0) {
    els.skipQueue.innerHTML = `<div class="meta-pill">Nincs átlépett kérdés.</div>`;
    return;
  }

  els.skipQueue.innerHTML = "";
  for (const question of skippedQuestions) {
    const sessionIndex = questionsIndexInSession(question.question_id);
    const row = document.createElement("div");
    row.className = "skip-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(`${sessionIndex + 1}. kérdés`)}</strong>
        <div class="review-item__meta">${escapeHtml(question.topic || "ismeretlen témakör")}</div>
      </div>
      <button type="button" data-question-id="${escapeHtml(question.question_id)}">Megnyitás</button>
    `;
    els.skipQueue.appendChild(row);
  }
}

function clearOrderingDropStates() {
  for (const item of document.querySelectorAll(".ordering-item")) {
    item.classList.remove("is-dragging", "is-drop-target");
  }
}

function renderQuestion(question) {
  if (!question) {
    els.questionKicker.textContent = "Nincs kérdés";
    els.questionTitle.textContent = "A kérdésbank üres";
    els.questionTypeChip.textContent = "-";
    els.questionIdChip.textContent = "ID -";
    els.difficultyChip.textContent = "nehézség -";
    els.prompt.innerHTML = "<p>Nincs betöltött kérdés.</p>";
    els.choices.innerHTML = "";
    els.questionMeta.innerHTML = "";
    els.unsupportedBlock.hidden = true;
    els.answerHint.textContent = "";
    return;
  }

  els.questionKicker.textContent = `Kérdés ${state.session.currentIndex + 1} / ${getSessionQuestions().length}`;
  els.questionTitle.textContent = question.subtopic || question.topic || "Kérdés";
  els.questionTypeChip.textContent = question.question_type === "true_false" ? "igaz/hamis" : question.question_type;
  els.questionIdChip.textContent = `ID ${question.question_id}`;
  els.difficultyChip.textContent = `nehézség ${question.difficulty || "-"}`;
  els.questionMeta.innerHTML = "";

  const meta = [
    question.topic,
    question.subtopic,
    question.source ? question.source.title : question.source_id,
    question.source_locator ? `forrás: ${question.source_locator}` : null,
  ].filter(Boolean);
  for (const value of meta) {
    const pill = document.createElement("span");
    pill.className = "meta-pill";
    pill.textContent = value;
    els.questionMeta.appendChild(pill);
  }

  els.prompt.innerHTML = `${renderQuestionAssets(question)}${renderMarkdown(question.prompt_md)}`;
  els.unsupportedBlock.hidden = SUPPORTED_TYPES.has(question.question_type);
  els.choices.innerHTML = "";

  if (question.question_type === "single_choice" || question.question_type === "multi_choice" || question.question_type === "true_false") {
    renderChoiceQuestion(question);
    const stateLabel = getQuestionState(question.question_id);
    const selected = state.answers[question.question_id] || [];
    const hintParts = ["Kérem adjon meg választ, vagy kattintson az Átlépem a feladatot gombra."];
    if (stateLabel === "skipped") hintParts.unshift("Ez a kérdés átlépve lett.");
    if (selected.length) hintParts.push(`Jelenlegi válasz: ${selected.length} elem.`);
    els.answerHint.textContent = hintParts.join(" ");
  } else if (question.question_type === "list_choice") {
    renderListChoiceQuestion(question);
    const stateLabel = getQuestionState(question.question_id);
    if (stateLabel === "skipped") {
      els.answerHint.textContent = "Ez a kérdés átlépve lett.";
    } else {
      els.answerHint.textContent = "Kérem adjon meg választ, vagy kattintson az Átlépem a feladatot gombra.";
    }
  } else if (question.question_type === "numeric_entry") {
    renderNumericEntryQuestion(question);
    const stateLabel = getQuestionState(question.question_id);
    if (stateLabel === "skipped") {
      els.answerHint.textContent = "Ez a kérdés átlépve lett.";
    } else {
      els.answerHint.textContent = "Kérem adjon meg választ, vagy kattintson az Átlépem a feladatot gombra.";
    }
  } else if (question.question_type === "ordering") {
    renderOrderingQuestion(question);
    els.answerHint.textContent = "Rendezze a tételeket a helyes sorrendbe.";
  } else if (question.question_type === "matching") {
    renderMatchingQuestion(question);
    els.answerHint.textContent = "Párosítsa össze a bal és jobb oldali elemeket.";
  } else if (question.question_type === "grouping") {
    renderGroupingQuestion(question);
    els.answerHint.textContent = "Sorolja be az elemeket a megfelelő csoportba.";
  } else {
    els.choices.innerHTML = "";
    els.answerHint.textContent = "";
  }

  updateChoiceVisualState(question);
  updateNextButtonLabel();
}

function renderChoiceQuestion(question) {
  const selected = new Set(state.answers[question.question_id] || []);
  const type = question.question_type === "multi_choice" ? "checkbox" : "radio";
  const presentation = ensureQuestionPresentation(question);
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  const choiceOrder = presentation?.choiceOrder || [];
  const choicesToRender =
    choiceOrder.length === question.choices.length
      ? choiceOrder.map((choiceId) => byId.get(choiceId)).filter(Boolean)
      : question.choices;

  for (const choice of choicesToRender) {
    const label = document.createElement("label");
    label.className = "choice";
    label.dataset.choiceId = choice.choice_id;
    const checked = selected.has(choice.choice_id);

    label.innerHTML = `
      <input
        type="${type}"
        name="choice"
        value="${escapeHtml(choice.choice_id)}"
        ${checked ? "checked" : ""}
        aria-label="${escapeHtml(`${choice.choice_label}. ${choice.choice_text_md}`)}"
      />
      <div>
        <span class="choice__label">${escapeHtml(choice.choice_label || "")}</span>
        <span class="choice__text">${renderMarkdown(choice.choice_text_md)}</span>
      </div>
    `;

    els.choices.appendChild(label);
  }
}

function renderListChoiceQuestion(question) {
  const selected = Array.isArray(state.answers[question.question_id]) ? state.answers[question.question_id][0] : "";
  const presentation = ensureQuestionPresentation(question);
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  const choiceOrder = presentation?.choiceOrder || [];
  const choicesToRender =
    choiceOrder.length === question.choices.length
      ? choiceOrder.map((choiceId) => byId.get(choiceId)).filter(Boolean)
      : question.choices;
  const wrapper = document.createElement("label");
  wrapper.className = "choice choice--field";
  wrapper.innerHTML = `
    <div>
      <span class="choice__label">Válasszon</span>
      <span class="choice__text">Nyissa le a listát, és válassza ki a helyes választ.</span>
    </div>
    <select class="list-choice-select" aria-label="Válaszlista">
      <option value="">Válassz...</option>
      ${choicesToRender
        .map(
          (choice) => {
            const text = `${choice.choice_label ? `${choice.choice_label}. ` : ""}${choice.choice_text_md}`;
            return `<option value="${escapeHtml(choice.choice_id)}" ${choice.choice_id === selected ? "selected" : ""}>${escapeHtml(text)}</option>`;
          }
        )
        .join("")}
    </select>
  `;
  els.choices.appendChild(wrapper);
}

function renderNumericEntryQuestion(question) {
  const selected = Array.isArray(state.answers[question.question_id]) ? state.answers[question.question_id][0] || "" : "";
  const wrapper = document.createElement("label");
  wrapper.className = "choice choice--field";
  wrapper.innerHTML = `
    <div>
      <span class="choice__label">Válasz</span>
      <span class="choice__text">Írja be a megoldást.</span>
    </div>
    <input
      class="numeric-answer"
      type="text"
      inputmode="decimal"
      value="${escapeHtml(selected)}"
      placeholder="Írja be a választ"
      aria-label="Numerikus válasz"
    />
  `;
  els.choices.appendChild(wrapper);
}

function renderOrderingQuestion(question) {
  const order = getOrderingAnswer(question);
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  const orderedChoices = order.map((choiceId) => byId.get(choiceId)).filter(Boolean);

  const list = document.createElement("div");
  list.className = "ordering-list";
  list.setAttribute("aria-label", "Rendezhető elemek");

  orderedChoices.forEach((choice, index) => {
    const item = document.createElement("div");
    item.className = "ordering-item";
    item.draggable = true;
    item.dataset.choiceId = choice.choice_id;
    item.innerHTML = `
      <div class="ordering-item__rank">${index + 1}</div>
      <div class="ordering-item__body">
        <div class="ordering-item__label">${escapeHtml(choice.choice_label || "")}</div>
        <div class="ordering-item__text">${renderMarkdown(choice.choice_text_md)}</div>
      </div>
      <div class="ordering-item__handle" aria-hidden="true">↕</div>
    `;
    list.appendChild(item);
  });

  els.choices.appendChild(list);
}

function renderMatchingQuestion(question) {
  const answer = state.answers[question.question_id] || {};
  const presentation = ensureQuestionPresentation(question);
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  const leftIds = presentation?.leftOrder || [];
  const rightIds = presentation?.rightOrder || [];
  const canonicalLeft = question.choices.filter((choice) => choice.match_role === "left");
  const canonicalRight = question.choices.filter((choice) => choice.match_role === "right");
  const leftItems =
    leftIds.length === canonicalLeft.length ? leftIds.map((choiceId) => byId.get(choiceId)).filter(Boolean) : canonicalLeft;
  const rightItems =
    rightIds.length === canonicalRight.length ? rightIds.map((choiceId) => byId.get(choiceId)).filter(Boolean) : canonicalRight;

  leftItems.forEach((choice, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "choice choice--field";
    wrapper.innerHTML = `
      <div>
        <span class="choice__label">${escapeHtml(choice.choice_label || String(index + 1))}</span>
        <span class="choice__text">${renderMarkdown(choice.choice_text_md)}</span>
      </div>
      <select class="matching-select" data-left-choice-id="${escapeHtml(choice.choice_id)}" aria-label="Pár választása">
        <option value="">Válassz...</option>
        ${rightItems
          .map(
            (rightChoice) =>
              `<option value="${escapeHtml(rightChoice.choice_id)}" ${String(answer[choice.choice_id] || "") === rightChoice.choice_id ? "selected" : ""}>${escapeHtml(rightChoice.choice_label || "")}. ${escapeHtml(rightChoice.choice_text_md)}</option>`
          )
          .join("")}
      </select>
    `;
    els.choices.appendChild(wrapper);
  });
}

function renderGroupingQuestion(question) {
  const answer = state.answers[question.question_id] || {};
  const presentation = ensureQuestionPresentation(question);
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  const itemIds = presentation?.itemOrder || [];
  const groupOrder = presentation?.groupOrder || [];
  const groups = groupOrder.length > 0 ? groupOrder : [...new Set(question.choices.map((choice) => choice.group_label).filter(Boolean))];
  const items =
    itemIds.length === question.choices.length ? itemIds.map((choiceId) => byId.get(choiceId)).filter(Boolean) : question.choices;

  items.forEach((choice, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "choice choice--field";
    wrapper.innerHTML = `
      <div>
        <span class="choice__label">${escapeHtml(choice.choice_label || String(index + 1))}</span>
        <span class="choice__text">${renderMarkdown(choice.choice_text_md)}</span>
      </div>
      <select class="grouping-select" data-item-id="${escapeHtml(choice.choice_id)}" aria-label="Csoport kiválasztása">
        <option value="">Válassz...</option>
        ${groups
          .map(
            (groupLabel) =>
              `<option value="${escapeHtml(groupLabel)}" ${String(answer[choice.choice_id] || "") === groupLabel ? "selected" : ""}>${escapeHtml(prettyTopic(groupLabel))}</option>`
          )
          .join("")}
      </select>
    `;
    els.choices.appendChild(wrapper);
  });
}

function updateChoiceVisualState(question) {
  const answer = state.answers[question.question_id];
  if (!Array.isArray(answer)) {
    for (const label of els.choices.querySelectorAll(".choice")) {
      if (label.dataset.choiceId) {
        label.dataset.selected = "false";
      }
    }
    return;
  }

  const selected = new Set(answer.map((value) => String(value)));
  for (const label of els.choices.querySelectorAll(".choice")) {
    const choiceId = label.dataset.choiceId;
    if (!choiceId) continue;
    label.dataset.selected = String(selected.has(choiceId));
  }
}

function move(offset) {
  if (!data) return;
  const questions = getSessionQuestions();
  const index = Math.min(Math.max((state.session.currentIndex || 0) + offset, 0), Math.max(questions.length - 1, 0));
  state.session.currentIndex = index;
  saveState();
  render();
}

function currentQuestion() {
  const questions = getSessionQuestions();
  return questions[state.session.currentIndex || 0] || questions[0] || null;
}

function getQuestionState(questionId) {
  const question = data?.questionsById.get(questionId);
  const answered = question ? isQuestionAnswered(question) : false;
  const skipped = state.skipped[questionId];
  if (skipped) return "skipped";
  if (answered) return "answered";
  return "unanswered";
}

function renderResults() {
  const result = evaluate();
  const questions = getMainSessionQuestions();
  const total = questions.length;
  const wrong = total - result.correctCount;

  els.resultScore.textContent = `${result.earnedPoints} pont`;
  els.resultCorrect.textContent = String(result.correctCount);
  els.resultWrong.textContent = String(wrong);
  els.resultTotal.textContent = String(total);
  els.resultNote.textContent =
    result.correctCount === total
      ? "Szép munka, minden kérdés stimmel."
      : "A hibás és átlépett kérdéseket érdemes külön végignézni.";

  els.reviewList.innerHTML = "";
  for (const item of result.details) {
    const card = document.createElement("article");
    card.className = "review-item";
    const statusClass = item.isCorrect ? "is-correct" : "is-wrong";
    const statusText = item.isCorrect ? "Helyes" : item.wasAnswered ? "Hibás" : "Hiányzó";
    card.innerHTML = `
      <div class="review-item__top">
        <div>
          <strong>${escapeHtml(`${item.sessionIndex + 1}. kérdés`)}</strong>
          <div class="review-item__meta">${escapeHtml(item.question.topic || "")} ${item.question.subtopic ? "· " + escapeHtml(item.question.subtopic) : ""}</div>
          <div class="review-item__meta">Nehézség: ${escapeHtml(String(item.question.difficulty || "-"))}</div>
        </div>
        <div class="review-item__status ${statusClass}">${escapeHtml(statusText)}</div>
      </div>
      ${renderQuestionAssets(item.question, true)}
      <div class="prose" style="margin-top:0; padding:0.85rem 0.95rem;">${renderMarkdown(item.question.prompt_md)}</div>
      <div class="review-item__meta" style="margin-top:0.6rem;">
        Saját válasz: ${escapeHtml(item.userAnswerText || "nincs")}<br />
        Helyes válasz: ${escapeHtml(item.correctAnswerText || "nincs")}
      </div>
      <div class="review-item__meta" style="margin-top:0.45rem;">${escapeHtml(item.question.explanation_md || "")}</div>
    `;
    els.reviewList.appendChild(card);
  }
}

function evaluate() {
  const details = [];
  let correctCount = 0;
  let earnedPoints = 0;

  for (const question of getMainSessionQuestions()) {
    const sessionIndex = questionsIndexInSession(question.question_id);
    const result = evaluateQuestion(question);
    const wasAnswered = isQuestionAnswered(question);
    const isCorrect = result.isCorrect;
    if (isCorrect) {
      correctCount += 1;
      earnedPoints += Number(question.points || 1);
    }
    details.push({
      sessionIndex,
      question,
      wasAnswered,
      isCorrect,
      userAnswerText: result.userAnswerText,
      correctAnswerText: result.correctAnswerText,
    });
  }

  return { correctCount, earnedPoints, details };
}

function evaluateQuestion(question) {
  const answer = state.answers[question.question_id];

  if (
    question.question_type === "single_choice" ||
    question.question_type === "multi_choice" ||
    question.question_type === "list_choice" ||
    question.question_type === "true_false"
  ) {
    const userAnswers = normalizeAnswerArray(answer);
    const correctAnswers = question.choices.filter((choice) => choice.is_correct).map((choice) => choice.choice_id);
    return {
      isCorrect: arraysEqualAsSets(userAnswers, correctAnswers),
      userAnswerText: formatChoiceAnswers(question, userAnswers),
      correctAnswerText: formatChoiceAnswers(question, correctAnswers),
    };
  }

  if (question.question_type === "numeric_entry") {
    const userValue = normalizeAnswerArray(answer)[0] || "";
    const correctValue = String(question.correct_answer_md || "").trim();
    const isCorrect = compareNumericAnswer(userValue, correctValue, Number(question.answer_tolerance || 0));
    return {
      isCorrect,
      userAnswerText: userValue,
      correctAnswerText: correctValue,
    };
  }

  if (question.question_type === "ordering") {
    const userOrder = normalizeOrderingAnswer(question, answer);
    const correctOrder = [...question.choices].sort((a, b) => a.sort_order - b.sort_order).map((choice) => choice.choice_id);
    return {
      isCorrect: arraysEqualStrict(userOrder, correctOrder),
      userAnswerText: formatChoiceAnswers(question, userOrder),
      correctAnswerText: formatChoiceAnswers(question, correctOrder),
    };
  }

  if (question.question_type === "matching") {
    const leftItems = question.choices.filter((choice) => choice.match_role === "left");
    const mapping = answer && typeof answer === "object" ? answer : {};
    const isCorrect =
      leftItems.length > 0 &&
      leftItems.every((item) => String(mapping[item.choice_id] || "") === String(item.match_choice_id || ""));
    return {
      isCorrect,
      userAnswerText: formatMatchingAnswers(question, mapping),
      correctAnswerText: formatMatchingAnswers(
        question,
        Object.fromEntries(leftItems.map((item) => [item.choice_id, item.match_choice_id]))
      ),
    };
  }

  if (question.question_type === "grouping") {
    const mapping = answer && typeof answer === "object" ? answer : {};
    const items = question.choices.filter((choice) => choice.group_label);
    const isCorrect =
      items.length > 0 &&
      items.every((item) => String(mapping[item.choice_id] || "") === String(item.group_label || ""));
    return {
      isCorrect,
      userAnswerText: formatGroupingAnswers(question, mapping),
      correctAnswerText: formatGroupingAnswers(
        question,
        Object.fromEntries(items.map((item) => [item.choice_id, item.group_label]))
      ),
    };
  }

  return {
    isCorrect: false,
    userAnswerText: "",
    correctAnswerText: "",
  };
}

function formatChoiceAnswers(question, answerIds) {
  const normalized = Array.isArray(answerIds) ? answerIds.filter(Boolean) : [];
  if (normalized.length === 0) return "";
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  return normalized
    .map((choiceId) => {
      const choice = byId.get(choiceId);
      return choice ? `${choice.choice_label}. ${choice.choice_text_md}` : choiceId;
    })
    .join(" | ");
}

function formatMatchingAnswers(question, mapping) {
  const leftItems = question.choices.filter((choice) => choice.match_role === "left");
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  return leftItems
    .map((item) => {
      const right = byId.get(String(mapping[item.choice_id] || ""));
      return `${item.choice_text_md} = ${right ? right.choice_text_md : "?"}`;
    })
    .join(" | ");
}

function formatGroupingAnswers(question, mapping) {
  const byId = new Map(question.choices.map((choice) => [choice.choice_id, choice]));
  return Object.entries(mapping)
    .map(([choiceId, groupLabel]) => {
      const item = byId.get(choiceId);
      return `${item ? item.choice_text_md : choiceId} → ${prettyTopic(groupLabel)}`;
    })
    .join(" | ");
}

function orderingFromAnswer(question, answer) {
  return normalizeOrderingAnswer(question, answer);
}

function normalizeOrderingAnswer(question, answer) {
  if (Array.isArray(answer)) {
    return answer.map((value) => String(value || "")).filter(Boolean);
  }
  if (!answer || typeof answer !== "object") return [];
  return [...question.choices]
    .map((choice) => ({
      choiceId: choice.choice_id,
      position: Number(answer[choice.choice_id] || 0),
    }))
    .filter((item) => item.position > 0)
    .sort((a, b) => a.position - b.position)
    .map((item) => item.choiceId);
}

function getOrderingAnswer(question) {
  const normalized = normalizeOrderingAnswer(question, state.answers[question.question_id]);
  if (normalized.length === question.choices.length) {
    return normalized;
  }
  const fallback = createDefaultAnswer(question);
  state.answers[question.question_id] = fallback;
  saveState();
  return fallback;
}

function compareNumericAnswer(userValue, correctValue, tolerance = 0) {
  const userNumber = parseNumericValue(userValue);
  const correctNumber = parseNumericValue(correctValue);
  if (Number.isFinite(userNumber) && Number.isFinite(correctNumber)) {
    return Math.abs(userNumber - correctNumber) <= tolerance;
  }
  return normalizeText(userValue) === normalizeText(correctValue);
}

function parseNumericValue(value) {
  const normalized = normalizeText(value).replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function normalizeText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function arraysEqualAsSets(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((value) => setB.has(value));
}

function arraysEqualStrict(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function isQuestionAnswered(question) {
  const answer = state.answers[question.question_id];

  if (
    question.question_type === "single_choice" ||
    question.question_type === "multi_choice" ||
    question.question_type === "list_choice" ||
    question.question_type === "numeric_entry" ||
    question.question_type === "true_false"
  ) {
    const normalized = normalizeAnswerArray(answer);
    return normalized.length > 0 && String(normalized[0] || "").trim().length > 0;
  }

  if (question.question_type === "ordering") {
    const order = normalizeOrderingAnswer(question, answer);
    return question.choices.length > 0 && order.length === question.choices.length;
  }

  if (question.question_type === "matching") {
    const map = answer && typeof answer === "object" ? answer : {};
    const leftItems = question.choices.filter((choice) => choice.match_role === "left");
    return leftItems.length > 0 && Object.keys(map).length === leftItems.length;
  }

  if (question.question_type === "grouping") {
    const map = answer && typeof answer === "object" ? answer : {};
    return question.choices.length > 0 && Object.keys(map).length === question.choices.length;
  }

  return false;
}

function normalizeAnswerArray(answer) {
  if (Array.isArray(answer)) {
    return answer.map((value) => String(value || "").trim()).filter(Boolean);
  }
  if (typeof answer === "string") {
    return [answer.trim()].filter(Boolean);
  }
  return [];
}

function saveAndRender() {
  saveState();
  render();
}

function createDefaultAnswer(question) {
  if (question.question_type === "ordering") {
    return shuffle(question.choices.map((choice) => choice.choice_id));
  }
  if (question.question_type === "matching" || question.question_type === "grouping") {
    return {};
  }
  return [];
}

function normalizeStoredAnswer(question, answer) {
  if (question.question_type === "ordering") {
    const normalized = normalizeOrderingAnswer(question, answer);
    return normalized.length > 0 ? normalized : createDefaultAnswer(question);
  }
  if (question.question_type === "matching" || question.question_type === "grouping") {
    return answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
  }
  const normalized = normalizeAnswerArray(answer);
  return normalized.length > 0 ? normalized : [];
}

function reorderOrderingAnswer(question, draggedChoiceId, targetChoiceId, insertBefore) {
  const current = normalizeOrderingAnswer(question, state.answers[question.question_id]);
  if (!current.includes(draggedChoiceId)) return;
  const remaining = current.filter((choiceId) => choiceId !== draggedChoiceId);
  if (!targetChoiceId) {
    remaining.push(draggedChoiceId);
  } else {
    const targetIndex = remaining.indexOf(targetChoiceId);
    if (targetIndex === -1) {
      remaining.push(draggedChoiceId);
    } else {
      const insertAt = insertBefore ? targetIndex : targetIndex + 1;
      remaining.splice(insertAt, 0, draggedChoiceId);
    }
  }
  state.answers[question.question_id] = remaining;
  state.skipped[question.question_id] = false;
  saveAndRender();
}

function normalizeTopic(topic) {
  const raw = String(topic || "").trim().toLowerCase();
  return TOPIC_ALIASES.get(raw) || raw;
}

function resetSession() {
  state.answers = {};
  state.skipped = {};
  startNewSession({ silent: true });
  saveState();
  render();
  els.resultsPanel.hidden = true;
  els.questionCard.hidden = false;
  els.questionCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        settings: {
          selectedTopics: [],
          questionCount: 10,
        },
        session: {
          questionIds: [],
          reviewQuestionIds: [],
          currentIndex: 0,
          phase: "main",
          completed: false,
          completedAt: null,
          startedAt: null,
          examDurationSeconds: 0,
          presentationByQuestionId: {},
        },
        answers: {},
        skipped: {},
      };
    }
    const parsed = JSON.parse(raw);
    return {
      settings: parsed.settings || {
        selectedTopics: [],
        questionCount: 10,
      },
      session: parsed.session || {
        questionIds: [],
        reviewQuestionIds: [],
        currentIndex: 0,
        phase: "main",
        completed: false,
        completedAt: null,
        startedAt: null,
        examDurationSeconds: 0,
        presentationByQuestionId: {},
      },
      answers: parsed.answers || {},
      skipped: parsed.skipped || {},
    };
  } catch {
    return {
      settings: {
        selectedTopics: [],
        questionCount: 10,
      },
      session: {
        questionIds: [],
        reviewQuestionIds: [],
        currentIndex: 0,
        phase: "main",
        completed: false,
        completedAt: null,
        startedAt: null,
        examDurationSeconds: 0,
        presentationByQuestionId: {},
      },
      answers: {},
      skipped: {},
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ";") {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  const header = rows.shift() || [];
  return rows.map((values) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = values[index] ?? "";
    });
    return record;
  });
}

function renderMarkdown(text) {
  const safe = escapeHtml(text || "");
  return safe
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderQuestionAssets(question, compact = false) {
  const assets = Array.isArray(question.assets) ? question.assets : [];
  if (assets.length === 0) return "";
  const items = assets
    .map((asset) => {
      const altText = asset.alt_text || question.prompt_md || question.question_id;
      const src = toAssetUrl(asset.path || "");
      return `
        <figure class="question-media__item">
          <img class="question-media__img" src="${escapeHtml(src)}" alt="${escapeHtml(altText)}" loading="lazy" />
          ${asset.kind || asset.source_locator ? `<figcaption class="question-media__caption">${escapeHtml([asset.kind, asset.source_locator].filter(Boolean).join(" · "))}</figcaption>` : ""}
        </figure>
      `;
    })
    .join("");
  return `<div class="question-media ${compact ? "question-media--compact" : ""}">${items}</div>`;
}

function toAssetUrl(path) {
  return encodeURI(String(path || "").trim());
}
