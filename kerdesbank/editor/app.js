const STORAGE_KEY = "villany-kerdesbank-editor:v1";
const LOCALHOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DATA_ROOT = new URL("../", window.location.href);
const DATA_FILES = {
  questions: new URL("questions.csv", DATA_ROOT).href,
  choices: new URL("choices.csv", DATA_ROOT).href,
  sources: new URL("sources.csv", DATA_ROOT).href,
  assets: new URL("assets.csv", DATA_ROOT).href,
};

const QUESTION_TYPES = [
  "single_choice",
  "multi_choice",
  "true_false",
  "list_choice",
  "ordering",
  "matching",
  "grouping",
  "numeric_entry",
];

const QUESTION_TYPE_LABELS = {
  single_choice: "single_choice",
  multi_choice: "multi_choice",
  true_false: "true_false",
  list_choice: "list_choice",
  ordering: "ordering",
  matching: "matching",
  grouping: "grouping",
  numeric_entry: "numeric_entry",
};

const QUESTION_FIELDS = [
  "question_id",
  "question_type",
  "prompt_md",
  "explanation_md",
  "topic",
  "subtopic",
  "difficulty",
  "points",
  "time_estimate_sec",
  "source_id",
  "source_locator",
  "tags",
  "language",
  "correct_answer_md",
  "answer_tolerance",
];

const CHOICE_FIELDS = [
  "choice_id",
  "question_id",
  "choice_label",
  "choice_text_md",
  "is_correct",
  "sort_order",
  "feedback_md",
  "match_role",
  "match_choice_id",
  "group_label",
];

const SOURCE_FIELDS = ["source_id", "title", "path", "source_type", "year", "category", "notes"];
const ASSET_FIELDS = ["asset_id", "question_id", "path", "kind", "alt_text", "source_id", "source_locator"];
const NEW_QUESTION_VALUE = "__new__";

if (!isLocalhost()) {
  renderBlocked();
} else {
  init().catch((error) => {
    console.error(error);
    state.loadError = error.message || "Ismeretlen betöltési hiba";
    state.lastSavedMessage = "A szerkesztő betöltött, de a CSV-ket nem sikerült automatikusan beolvasni.";
    normalizeDraft();
    renderStaticOptions();
    wireEvents();
    renderAll();
  });
}

function isLocalhost() {
  return LOCALHOSTS.has(window.location.hostname);
}

const savedDraft = loadDraft();
const state = {
  data: {
    questions: [],
    choices: [],
    sources: [],
    assets: [],
  },
  bankFolderHandle: null,
  workspaceLabel: "Mappa kiválasztása szükséges",
  editingQuestionId: savedDraft.editingQuestionId,
  questionFilter: savedDraft.questionFilter || "",
  form: savedDraft.form,
  assetFiles: [],
  lastSavedMessage: "Szerkesztésre kész",
  loadError: "",
  busy: false,
  deletePendingQuestionId: null,
  deleteConfirmText: "",
};

const els = {
  workspaceStatus: document.getElementById("workspaceStatus"),
  workspaceMeta: document.getElementById("workspaceMeta"),
  workspaceFiles: document.getElementById("workspaceFiles"),
  draftStatus: document.getElementById("draftStatus"),
  saveButtonTop: document.getElementById("saveButtonTop"),
  nextQuestionIdPreview: document.getElementById("nextQuestionIdPreview"),
  choiceCountPreview: document.getElementById("choiceCountPreview"),
  assetCountPreview: document.getElementById("assetCountPreview"),
  draftSaveState: document.getElementById("draftSaveState"),
  draftProgressFill: document.getElementById("draftProgressFill"),
  loadedCountsChip: document.getElementById("loadedCountsChip"),
  editModeChip: document.getElementById("editModeChip"),
  questionNavMeta: document.getElementById("questionNavMeta"),
  questionFilterInput: document.getElementById("questionFilterInput"),
  questionSelect: document.getElementById("questionSelect"),
  prevQuestionButton: document.getElementById("prevQuestionButton"),
  nextQuestionButton: document.getElementById("nextQuestionButton"),
  newQuestionButton: document.getElementById("newQuestionButton"),
  pickWorkspaceButton: document.getElementById("pickWorkspaceButton"),
  reloadButton: document.getElementById("reloadButton"),
  sourceModeSelect: document.getElementById("sourceModeSelect"),
  existingSourceField: document.getElementById("existingSourceField"),
  newSourceFields: document.getElementById("newSourceFields"),
  sourceSelect: document.getElementById("sourceSelect"),
  newSourceTitle: document.getElementById("newSourceTitle"),
  newSourcePath: document.getElementById("newSourcePath"),
  newSourceType: document.getElementById("newSourceType"),
  newSourceYear: document.getElementById("newSourceYear"),
  newSourceCategory: document.getElementById("newSourceCategory"),
  newSourceNotes: document.getElementById("newSourceNotes"),
  questionTypeSelect: document.getElementById("questionTypeSelect"),
  questionTypeChipPreview: document.getElementById("questionTypeChipPreview"),
  questionIdChipPreview: document.getElementById("questionIdChipPreview"),
  sourceIdChipPreview: document.getElementById("sourceIdChipPreview"),
  topicInput: document.getElementById("topicInput"),
  topicList: document.getElementById("topicList"),
  subtopicInput: document.getElementById("subtopicInput"),
  difficultyInput: document.getElementById("difficultyInput"),
  pointsInput: document.getElementById("pointsInput"),
  timeEstimateInput: document.getElementById("timeEstimateInput"),
  languageInput: document.getElementById("languageInput"),
  sourceLocatorInput: document.getElementById("sourceLocatorInput"),
  tagsInput: document.getElementById("tagsInput"),
  promptInput: document.getElementById("promptInput"),
  explanationInput: document.getElementById("explanationInput"),
  answerEditor: document.getElementById("answerEditor"),
  answerMeta: document.getElementById("answerMeta"),
  assetFilesInput: document.getElementById("assetFilesInput"),
  assetKindInput: document.getElementById("assetKindInput"),
  assetList: document.getElementById("assetList"),
  csvPreview: document.getElementById("csvPreview"),
  validationState: document.getElementById("validationState"),
  saveButton: document.getElementById("saveButton"),
  deleteQuestionButton: document.getElementById("deleteQuestionButton"),
  resetDraftButton: document.getElementById("resetDraftButton"),
  deleteQuestionPanel: document.getElementById("deleteQuestionPanel"),
  deleteQuestionMessage: document.getElementById("deleteQuestionMessage"),
  deleteQuestionConfirmInput: document.getElementById("deleteQuestionConfirmInput"),
  confirmDeleteQuestionButton: document.getElementById("confirmDeleteQuestionButton"),
  cancelDeleteQuestionButton: document.getElementById("cancelDeleteQuestionButton"),
};

function renderBlocked(title = "Ez a szerkesztő csak localhoston működik", body = "Nyisd meg a repo egy lokális HTTP szerverén, például `python3 -m http.server 8000` mellett.") {
  document.body.innerHTML = `
    <main class="blocked">
      <section class="blocked__card">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(body)}</p>
        <p>
          Ez a helyi szerkesztő közvetlenül a repo CSV-ket írja, ezért a publikus
          hoston le van tiltva.
        </p>
      </section>
    </main>
  `;
}

async function init() {
  try {
    await loadRepositoryData();
    state.loadError = "";
  } catch (error) {
    console.warn("Automatikus CSV-betöltés sikertelen, a szerkesztő ettől még használható.", error);
    state.loadError = error.message || "Nem sikerült betölteni a CSV-ket";
    state.lastSavedMessage = "A CSV-ket nem sikerült automatikusan betölteni.";
  }
  normalizeDraft();
  renderStaticOptions();
  wireEvents();
  renderAll();
}

async function loadRepositoryData() {
  const [questionsText, choicesText, sourcesText, assetsText] = await Promise.all([
    fetch(DATA_FILES.questions, { cache: "no-store" }).then(requireOk).then((response) => response.text()),
    fetch(DATA_FILES.choices, { cache: "no-store" }).then(requireOk).then((response) => response.text()),
    fetch(DATA_FILES.sources, { cache: "no-store" }).then(requireOk).then((response) => response.text()),
    fetch(DATA_FILES.assets, { cache: "no-store" }).then(requireOk).then((response) => response.text()),
  ]);

  state.data.questions = parseCsv(questionsText);
  state.data.choices = parseCsv(choicesText);
  state.data.sources = parseCsv(sourcesText);
  state.data.assets = parseCsv(assetsText);
}

async function loadRepositoryDataFromHandle(folderHandle) {
  const [questionsText, choicesText, sourcesText, assetsText] = await Promise.all([
    readTextFromHandle(folderHandle, "questions.csv"),
    readTextFromHandle(folderHandle, "choices.csv"),
    readTextFromHandle(folderHandle, "sources.csv"),
    readTextFromHandle(folderHandle, "assets.csv"),
  ]);

  state.data.questions = parseCsv(questionsText);
  state.data.choices = parseCsv(choicesText);
  state.data.sources = parseCsv(sourcesText);
  state.data.assets = parseCsv(assetsText);
}

async function readTextFromHandle(folderHandle, filename) {
  const fileHandle = await folderHandle.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return file.text();
}

function requireOk(response) {
  if (!response.ok) {
    throw new Error(`Nem sikerült betölteni: ${response.url}`);
  }
  return response;
}

function wireEvents() {
  els.pickWorkspaceButton.addEventListener("click", pickWorkspace);
  els.reloadButton.addEventListener("click", async () => {
    await reloadRepositoryData();
    renderAll();
  });
  els.saveButton.addEventListener("click", saveDraftToWorkspace);
  els.saveButtonTop.addEventListener("click", saveDraftToWorkspace);
  els.deleteQuestionButton.addEventListener("click", deleteCurrentQuestion);
  els.confirmDeleteQuestionButton.addEventListener("click", confirmDeleteCurrentQuestion);
  els.cancelDeleteQuestionButton.addEventListener("click", () => clearDeleteConfirmation());
  els.deleteQuestionConfirmInput.addEventListener("input", () => {
    state.deleteConfirmText = els.deleteQuestionConfirmInput.value;
    syncDeletePanelState();
  });
  els.resetDraftButton.addEventListener("click", resetDraftForm);
  els.questionSelect.addEventListener("change", () => {
    const questionId = els.questionSelect.value;
    if (questionId === NEW_QUESTION_VALUE) {
      startNewDraft();
      return;
    }
    loadExistingQuestion(questionId);
  });
  els.questionFilterInput.addEventListener("input", () => {
    state.questionFilter = els.questionFilterInput.value.trim();
    renderStaticOptions();
    updateWorkspaceSummary();
  });
  els.prevQuestionButton.addEventListener("click", () => navigateQuestion(-1));
  els.nextQuestionButton.addEventListener("click", () => navigateQuestion(1));
  els.newQuestionButton.addEventListener("click", startNewDraft);

  els.sourceModeSelect.addEventListener("change", () => {
    state.form.sourceMode = els.sourceModeSelect.value;
    saveDraft();
    renderAll();
  });

  els.sourceSelect.addEventListener("change", () => {
    state.form.sourceId = els.sourceSelect.value;
    saveDraft();
    renderAll();
  });

  for (const input of [
    els.newSourceTitle,
    els.newSourcePath,
    els.newSourceType,
    els.newSourceYear,
    els.newSourceCategory,
    els.newSourceNotes,
    els.topicInput,
    els.subtopicInput,
    els.difficultyInput,
    els.pointsInput,
    els.timeEstimateInput,
    els.languageInput,
    els.sourceLocatorInput,
    els.tagsInput,
    els.promptInput,
    els.explanationInput,
  ]) {
    input.addEventListener("input", () => {
      syncDraftFromInputs();
      saveDraft();
      updateSummary();
      updatePreview();
    });
  }

  els.questionTypeSelect.addEventListener("change", () => {
    syncDraftFromInputs();
    state.form.question_type = els.questionTypeSelect.value;
    ensureTypeDefaults();
    saveDraft();
    renderAll();
  });

  els.assetFilesInput.addEventListener("change", () => {
    state.assetFiles = Array.from(els.assetFilesInput.files || []);
    updateAssetList();
    updateSummary();
    updatePreview();
  });

  els.assetKindInput.addEventListener("change", () => {
    updateAssetList();
    updatePreview();
  });

  els.answerEditor.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const type = state.form.question_type;
    if (type === "single_choice" || type === "multi_choice" || type === "list_choice") {
      if (target.classList.contains("choice-text")) {
        const index = Number(target.dataset.index || -1);
        const rows = getChoiceRows(type);
        if (rows[index]) {
          rows[index].text = target.value;
          setChoiceRows(type, rows);
          saveDraft();
          updateSummary();
          updatePreview();
        }
      }
      return;
    }

    if (type === "ordering" && target.classList.contains("ordering-text")) {
      state.form.orderingText = target.value;
      saveDraft();
      updatePreview();
      return;
    }

    if (type === "matching" && target.classList.contains("matching-text")) {
      state.form.matchingText = target.value;
      saveDraft();
      updatePreview();
      return;
    }

    if (type === "grouping" && target.classList.contains("grouping-text")) {
      state.form.groupingText = target.value;
      saveDraft();
      updatePreview();
      return;
    }

    if (type === "numeric_entry" && target.id === "numericAnswerInput") {
      state.form.numericAnswer = target.value;
      saveDraft();
      updatePreview();
    }
  });

  els.answerEditor.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const type = state.form.question_type;
    if (type === "single_choice" || type === "list_choice") {
      if (target.classList.contains("choice-correct")) {
        const index = Number(target.dataset.index || -1);
        const rows = getChoiceRows(type);
        rows.forEach((row, rowIndex) => {
          row.correct = rowIndex === index;
        });
        setChoiceRows(type, rows);
        saveDraft();
        updateSummary();
        updatePreview();
      }
      return;
    }

    if (type === "multi_choice") {
      if (target.classList.contains("choice-correct")) {
        const index = Number(target.dataset.index || -1);
        const rows = getChoiceRows(type);
        if (rows[index]) {
          rows[index].correct = target.checked;
          setChoiceRows(type, rows);
          saveDraft();
          updateSummary();
          updatePreview();
        }
      }
      return;
    }

    if (type === "true_false") {
      if (target.name === "trueFalseCorrect") {
        state.form.trueFalseCorrect = target.value;
        saveDraft();
        updatePreview();
      }
      return;
    }

    if (type === "numeric_entry" && target.id === "numericToleranceInput") {
      state.form.numericTolerance = target.value;
      saveDraft();
      updatePreview();
    }
  });

  els.answerEditor.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === "add-choice") {
      const type = state.form.question_type;
      const rows = getChoiceRows(type);
      rows.push({ text: "", correct: type === "single_choice" || type === "list_choice" ? rows.length === 0 : false });
      setChoiceRows(type, rows);
      saveDraft();
      renderAnswerEditor();
      updateSummary();
      updatePreview();
      return;
    }
    if (target.dataset.action === "remove-choice") {
      const type = state.form.question_type;
      const index = Number(target.dataset.index || -1);
      const rows = getChoiceRows(type).filter((_row, rowIndex) => rowIndex !== index);
      if (rows.length === 0) {
        rows.push({ text: "", correct: true });
      }
      if ((type === "single_choice" || type === "list_choice") && !rows.some((row) => row.correct)) {
        rows[0].correct = true;
      }
      setChoiceRows(type, rows);
      saveDraft();
      renderAnswerEditor();
      updateSummary();
      updatePreview();
    }
  });
}

async function pickWorkspace() {
  if (!window.showDirectoryPicker) {
    alert("A böngésződ nem támogatja a helyi mappa kiválasztását. Chrome vagy Edge ajánlott.");
    return;
  }

  try {
    const rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    state.bankFolderHandle = await resolveBankFolderHandle(rootHandle);
    const label = await guessWorkspaceLabel(state.bankFolderHandle);
    state.workspaceLabel = label;
    await loadRepositoryDataFromHandle(state.bankFolderHandle);
    state.loadError = "";
    state.lastSavedMessage = "A workspace CSV-k be lettek olvasva.";
    saveDraft();
    renderAll();
  } catch (error) {
    console.error(error);
    state.loadError = error.message || "Nem sikerült megnyitni a kiválasztott mappát";
    state.lastSavedMessage = "A kiválasztott mappát nem sikerült beolvasni.";
    renderWorkspaceError();
  }
}

async function resolveBankFolderHandle(rootHandle) {
  try {
    await rootHandle.getFileHandle("questions.csv");
    return rootHandle;
  } catch {
    // Fall through to a likely repo structure.
  }

  try {
    return await rootHandle.getDirectoryHandle("kerdesbank", { create: false });
  } catch {
    return rootHandle;
  }
}

async function reloadRepositoryData() {
  if (state.bankFolderHandle) {
    await loadRepositoryDataFromHandle(state.bankFolderHandle);
    state.loadError = "";
    state.lastSavedMessage = "A workspace CSV-k újra be lettek töltve.";
    return;
  }

  await loadRepositoryData();
  state.loadError = "";
  state.lastSavedMessage = "A CSV-k újra be lettek töltve.";
}

async function guessWorkspaceLabel(handle) {
  try {
    const q = await handle.getFileHandle("questions.csv");
    if (q) return handle.name || "kerdesbank";
  } catch {
    // ignore
  }
  return `${handle.name || "workspace"} / kerdesbank`;
}

function normalizeDraft() {
  state.form = {
    question_type: state.form.question_type || "single_choice",
    sourceMode: state.form.sourceMode || "existing",
    sourceId: state.form.sourceId || "",
    newSource: state.form.newSource || {
      title: "",
      path: "",
      source_type: "pdf",
      year: "",
      category: "vizsga",
      notes: "",
    },
    topic: state.form.topic || inferDefaultTopic(),
    subtopic: state.form.subtopic || "",
    difficulty: String(state.form.difficulty || 2),
    points: String(state.form.points || 1),
    time_estimate_sec: String(state.form.time_estimate_sec || 20),
    source_locator: state.form.source_locator || "",
    tags: state.form.tags || "",
    language: state.form.language || "hu",
    prompt_md: state.form.prompt_md || "",
    explanation_md: state.form.explanation_md || "",
    choiceRowsByType: state.form.choiceRowsByType || {},
    trueFalseCorrect: state.form.trueFalseCorrect || "true",
    orderingText: state.form.orderingText || "",
    matchingText: state.form.matchingText || "",
    groupingText: state.form.groupingText || "",
    numericAnswer: state.form.numericAnswer || "",
    numericTolerance: state.form.numericTolerance || "0",
  };
  state.editingQuestionId = state.editingQuestionId || null;
  ensureTypeDefaults();
}

function inferDefaultTopic() {
  const topics = getTopicOptions();
  return topics[0] || "vezetékek";
}

function getOrderedQuestions() {
  return [...state.data.questions].sort((a, b) => compareQuestionIds(a.question_id, b.question_id));
}

function compareQuestionIds(left, right) {
  return getIdNumber(left, "Q") - getIdNumber(right, "Q");
}

function getIdNumber(value, prefix) {
  const text = String(value || "");
  if (!text.startsWith(prefix)) return 0;
  const match = text.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function formatQuestionOption(question) {
  const prompt = String(question.prompt_md || "").replace(/\s+/g, " ").trim();
  const preview = prompt ? prompt.slice(0, 60) : "Nincs szöveg";
  return `${question.question_id} — ${preview}${prompt.length > 60 ? "…" : ""}`;
}

function loadExistingQuestion(questionId) {
  const question = state.data.questions.find((item) => item.question_id === questionId);
  if (!question) return;
  clearDeleteConfirmation(false);
  state.editingQuestionId = question.question_id;
  state.form = createDraftFromQuestion(question);
  state.assetFiles = [];
  els.assetFilesInput.value = "";
  saveDraft();
  renderAll();
}

function startNewDraft() {
  clearDeleteConfirmation(false);
  state.editingQuestionId = null;
  state.form = createBlankDraft();
  state.assetFiles = [];
  els.assetFilesInput.value = "";
  saveDraft();
  renderAll();
}

function navigateQuestion(direction) {
  const questions = getOrderedQuestions();
  if (questions.length === 0) return;
  const currentIndex = questions.findIndex((question) => question.question_id === state.editingQuestionId);
  if (currentIndex === -1) {
    loadExistingQuestion(direction < 0 ? questions[questions.length - 1].question_id : questions[0].question_id);
    return;
  }
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), questions.length - 1);
  loadExistingQuestion(questions[nextIndex].question_id);
}

function createBlankDraft() {
  return {
    question_type: "single_choice",
    sourceMode: "existing",
    sourceId: "",
    newSource: {
      title: "",
      path: "",
      source_type: "pdf",
      year: "",
      category: "vizsga",
      notes: "",
    },
    topic: inferDefaultTopic(),
    subtopic: "",
    difficulty: "2",
    points: "1",
    time_estimate_sec: "20",
    source_locator: "",
    tags: "",
    language: "hu",
    prompt_md: "",
    explanation_md: "",
    choiceRowsByType: {},
    trueFalseCorrect: "true",
    orderingText: "",
    matchingText: "",
    groupingText: "",
    numericAnswer: "",
    numericTolerance: "0",
  };
}

function createDraftFromQuestion(question) {
  const draft = createBlankDraft();
  draft.question_type = question.question_type || "single_choice";
  draft.sourceMode = "existing";
  draft.sourceId = question.source_id || "";
  draft.topic = question.topic || inferDefaultTopic();
  draft.subtopic = question.subtopic || "";
  draft.difficulty = String(question.difficulty || 2);
  draft.points = String(question.points || 1);
  draft.time_estimate_sec = String(question.time_estimate_sec || 20);
  draft.source_locator = question.source_locator || "";
  draft.tags = question.tags || "";
  draft.language = question.language || "hu";
  draft.prompt_md = question.prompt_md || "";
  draft.explanation_md = question.explanation_md || "";
  if (draft.question_type === "numeric_entry") {
    draft.numericAnswer = question.correct_answer_md || "";
    draft.numericTolerance = String(question.answer_tolerance || "0");
    return draft;
  }
  if (draft.question_type === "true_false") {
    draft.trueFalseCorrect = findTrueFalseCorrect(question.question_id);
    return draft;
  }
  if (draft.question_type === "ordering") {
    draft.orderingText = getChoicesForQuestion(question.question_id)
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
      .map((row) => row.choice_text_md || "")
      .join("\n");
    return draft;
  }
  if (draft.question_type === "matching") {
    draft.matchingText = buildMatchingDraft(question.question_id);
    return draft;
  }
  if (draft.question_type === "grouping") {
    draft.groupingText = getChoicesForQuestion(question.question_id)
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
      .map((row) => `${row.choice_text_md || ""} | ${row.group_label || ""}`)
      .join("\n");
    return draft;
  }

  draft.choiceRowsByType[draft.question_type] = getChoicesForQuestion(question.question_id)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
    .map((row) => ({ text: row.choice_text_md || "", correct: String(row.is_correct) === "true" }));

  if (draft.choiceRowsByType[draft.question_type].length === 0) {
    draft.choiceRowsByType[draft.question_type] = createDefaultChoiceRows(draft.question_type);
  }
  return draft;
}

function getChoicesForQuestion(questionId) {
  return state.data.choices.filter((choice) => choice.question_id === questionId);
}

function findTrueFalseCorrect(questionId) {
  const correctRow = getChoicesForQuestion(questionId).find((row) => String(row.is_correct) === "true");
  if (!correctRow) return "true";
  return String(correctRow.choice_text_md || "").trim().toLowerCase() === "hamis" ? "false" : "true";
}

function buildMatchingDraft(questionId) {
  const rows = getChoicesForQuestion(questionId);
  const rightRows = rows.filter((row) => row.match_role === "right").sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  const rightMap = new Map(rightRows.map((row) => [row.choice_id, row.choice_text_md || ""]));
  const leftRows = rows.filter((row) => row.match_role === "left").sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  return leftRows.map((row) => `${row.choice_text_md || ""} | ${rightMap.get(row.match_choice_id) || ""}`).join("\n");
}

function ensureTypeDefaults() {
  const type = state.form.question_type;
  if (type === "single_choice" || type === "multi_choice" || type === "list_choice") {
    const rows = getChoiceRows(type);
    if (rows.length === 0) {
      setChoiceRows(type, [
        { text: "", correct: true },
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
      ]);
    }
  } else if (type === "true_false") {
    if (!state.form.trueFalseCorrect) {
      state.form.trueFalseCorrect = "true";
    }
  }
}

function getChoiceRows(type) {
  const map = state.form.choiceRowsByType || {};
  if (!Array.isArray(map[type])) {
    map[type] = [];
  }
  return map[type];
}

function setChoiceRows(type, rows) {
  state.form.choiceRowsByType[type] = rows;
}

function renderStaticOptions() {
  const orderedQuestions = getOrderedQuestions();
  const filteredQuestions = getFilteredQuestions(orderedQuestions);
  const selectedQuestion = orderedQuestions.find((question) => question.question_id === state.editingQuestionId) || null;
  if (state.editingQuestionId && !orderedQuestions.some((question) => question.question_id === state.editingQuestionId)) {
    state.editingQuestionId = null;
  }
  els.questionTypeSelect.innerHTML = QUESTION_TYPES.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
  els.questionTypeSelect.value = state.form.question_type;
  els.sourceModeSelect.value = state.form.sourceMode;
  els.questionFilterInput.value = state.questionFilter;
  const shouldPinSelected = state.editingQuestionId && selectedQuestion && !filteredQuestions.some((question) => question.question_id === state.editingQuestionId);
  const questionOptions = shouldPinSelected ? [selectedQuestion, ...filteredQuestions] : filteredQuestions;
  els.questionSelect.innerHTML = [
    `<option value="${NEW_QUESTION_VALUE}">Új kérdés</option>`,
    ...questionOptions.map((question) => {
      const selected = question.question_id === state.editingQuestionId ? " selected" : "";
      return `<option value="${escapeHtml(question.question_id)}"${selected}>${escapeHtml(formatQuestionOption(question))}</option>`;
    }),
  ].join("");
  els.questionSelect.value = state.editingQuestionId || NEW_QUESTION_VALUE;
  els.sourceSelect.innerHTML = state.data.sources
    .map((source) => {
      const title = source.title || source.path || source.source_id;
      return `<option value="${escapeHtml(source.source_id)}">${escapeHtml(source.source_id)} - ${escapeHtml(title)}</option>`;
    })
    .join("");
  if (!state.form.sourceId && state.data.sources.length > 0 && state.form.sourceMode !== "new") {
    state.form.sourceId = state.data.sources[0].source_id;
  }
  if (state.form.sourceId) {
    els.sourceSelect.value = state.form.sourceId;
  }

  const topics = getTopicOptions();
  els.topicList.innerHTML = topics.map((topic) => `<option value="${escapeHtml(topic)}"></option>`).join("");
  els.topicInput.value = state.form.topic;
  els.subtopicInput.value = state.form.subtopic;
  els.difficultyInput.value = state.form.difficulty;
  els.pointsInput.value = state.form.points;
  els.timeEstimateInput.value = state.form.time_estimate_sec;
  els.languageInput.value = state.form.language;
  els.sourceLocatorInput.value = state.form.source_locator;
  els.tagsInput.value = state.form.tags;
  els.promptInput.value = state.form.prompt_md;
  els.explanationInput.value = state.form.explanation_md;
  els.newSourceTitle.value = state.form.newSource.title;
  els.newSourcePath.value = state.form.newSource.path;
  els.newSourceType.value = state.form.newSource.source_type;
  els.newSourceYear.value = state.form.newSource.year;
  els.newSourceCategory.value = state.form.newSource.category;
  els.newSourceNotes.value = state.form.newSource.notes;
  toggleSourceModeFields();
}

function toggleSourceModeFields() {
  const isNew = state.form.sourceMode === "new";
  els.newSourceFields.hidden = !isNew;
  els.existingSourceField.hidden = isNew;
  els.sourceSelect.hidden = isNew;
}

function getTopicOptions() {
  const topics = state.data.questions.map((question) => normalizeTopic(question.topic)).filter(Boolean);
  return [...new Set(topics)].sort((a, b) => a.localeCompare(b, "hu"));
}

function getFilteredQuestions(questions) {
  const filter = normalizeSearch(state.questionFilter);
  if (!filter) {
    return questions;
  }
  return questions.filter((question) => {
    const haystack = [
      question.question_id,
      question.question_type,
      question.topic,
      question.subtopic,
      question.tags,
      question.prompt_md,
      question.explanation_md,
      question.source_locator,
      question.source_id,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(filter);
  });
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTopic(topic) {
  return String(topic || "").trim();
}

function syncDraftFromInputs() {
  state.form.question_type = els.questionTypeSelect.value;
  state.form.sourceMode = els.sourceModeSelect.value;
  state.form.sourceId = els.sourceSelect.value;
  state.form.topic = els.topicInput.value.trim();
  state.form.subtopic = els.subtopicInput.value.trim();
  state.form.difficulty = String(els.difficultyInput.value || "2");
  state.form.points = String(els.pointsInput.value || "1");
  state.form.time_estimate_sec = String(els.timeEstimateInput.value || "20");
  state.form.language = els.languageInput.value.trim() || "hu";
  state.form.source_locator = els.sourceLocatorInput.value.trim();
  state.form.tags = els.tagsInput.value.trim();
  state.form.prompt_md = els.promptInput.value;
  state.form.explanation_md = els.explanationInput.value;
  state.form.newSource.title = els.newSourceTitle.value.trim();
  state.form.newSource.path = els.newSourcePath.value.trim();
  state.form.newSource.source_type = els.newSourceType.value.trim() || "pdf";
  state.form.newSource.year = els.newSourceYear.value.trim();
  state.form.newSource.category = els.newSourceCategory.value.trim() || "vizsga";
  state.form.newSource.notes = els.newSourceNotes.value.trim();
}

function renderAll() {
  toggleSourceModeFields();
  renderStaticOptions();
  renderAnswerEditor();
  updateWorkspaceSummary();
  updateAssetList();
  updatePreview();
  syncDeleteButtonState();
  syncDeletePanelState();
}

function renderAnswerEditor() {
  const type = state.form.question_type;
  els.questionTypeChipPreview.textContent = type;
  els.questionIdChipPreview.textContent = `ID ${getCurrentQuestionId()}`;
  els.sourceIdChipPreview.textContent = state.form.sourceMode === "new" ? `új forrás` : (state.form.sourceId || "forrás");
  if (type === "single_choice" || type === "multi_choice" || type === "list_choice" || type === "true_false") {
    els.answerMeta.textContent = "A helyességet jelöld meg, a gyakorlóban a megjelenési sorrend kevert lesz.";
  } else if (type === "matching" || type === "grouping") {
    els.answerMeta.textContent = "A helyes párosítás / csoportosítás számít, nem a látható sorrend.";
  } else if (type === "ordering") {
    els.answerMeta.textContent = "A sorrend itt a kanonikus helyes sorrend; a gyakorló ezt tesztindításkor keveri.";
  } else {
    els.answerMeta.textContent = `${type} formátum`;
  }

  if (type === "single_choice" || type === "multi_choice" || type === "list_choice") {
    const rows = getChoiceRows(type);
    if (rows.length === 0) {
      setChoiceRows(type, [
        { text: "", correct: true },
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
      ]);
    }
    const allowMany = type === "multi_choice";
    const allowAdd = true;
    const list = getChoiceRows(type)
      .map(
        (row, index) => `
          <div class="choice-row">
            <div class="choice-row__label">${choiceLabelForIndex(index)}</div>
            <input class="choice-row__input choice-text" data-index="${index}" type="text" value="${escapeHtml(row.text)}" placeholder="Válasz ${index + 1}" />
            <label class="choice-row__correct">
              <input
                class="choice-correct"
                data-index="${index}"
                type="${allowMany ? "checkbox" : "radio"}"
                name="correctChoice${type}"
                ${row.correct ? "checked" : ""}
              />
              Helyes
            </label>
            <button class="choice-row__remove" data-action="remove-choice" data-index="${index}" type="button">Törlés</button>
          </div>
        `,
      )
      .join("");
    els.answerEditor.innerHTML = `
      <div class="meta-pill">A helyes választ a jelöléssel add meg. A gyakorlófelületen a választási sorrend tesztindításkor kevert lesz.</div>
      <div class="choice-editor-list">
        ${list}
      </div>
      <div class="editor-actions">
        <button class="ghost" data-action="add-choice" type="button">Új válasz</button>
      </div>
    `;
    return;
  }

  if (type === "true_false") {
    els.answerEditor.innerHTML = `
      <div class="meta-pill">Az állítás igaz/hamis volta jelöli a helyes választ. A gyakorló a két opció sorrendjét keverve mutatja.</div>
      <div class="choice-row choice-row--truefalse">
        <label class="choice-radio">
          <input type="radio" name="trueFalseCorrect" value="true" ${state.form.trueFalseCorrect === "true" ? "checked" : ""} />
          Igaz
        </label>
        <label class="choice-radio">
          <input type="radio" name="trueFalseCorrect" value="false" ${state.form.trueFalseCorrect === "false" ? "checked" : ""} />
          Hamis
        </label>
        <div class="choice-row__label">T/F</div>
      </div>
    `;
    return;
  }

  if (type === "ordering") {
    els.answerEditor.innerHTML = `
      <div class="meta-pill">A sorok itt a kanonikus helyes sorrendet jelentik. A gyakorló a kezdő sorrendet keverve mutatja.</div>
      <label class="field field--wide">
        <span>Rendezett elemek, soronként egy tétel</span>
        <textarea id="orderingTextInput" class="ordering-text" rows="7" placeholder="1. elem&#10;2. elem&#10;3. elem">${escapeHtml(state.form.orderingText)}</textarea>
      </label>
    `;
    return;
  }

  if (type === "matching") {
    els.answerEditor.innerHTML = `
      <div class="meta-pill">A bal és jobb oldali elemek helyes párosítása számít; a gyakorló a megjelenési sorrendet keveri.</div>
      <label class="field field--wide">
        <span>Párok, soronként: bal | jobb</span>
        <textarea id="matchingTextInput" class="matching-text" rows="7" placeholder="Bal oldali elem | Jobb oldali elem">${escapeHtml(state.form.matchingText)}</textarea>
      </label>
    `;
    return;
  }

  if (type === "grouping") {
    els.answerEditor.innerHTML = `
      <div class="meta-pill">A csoportosítás helyessége számít, a megjelenési sorrend nem.</div>
      <label class="field field--wide">
        <span>Elemek, soronként: tétel | csoport</span>
        <textarea id="groupingTextInput" class="grouping-text" rows="7" placeholder="Elem | csoport">${escapeHtml(state.form.groupingText)}</textarea>
      </label>
    `;
    return;
  }

  if (type === "numeric_entry") {
    els.answerEditor.innerHTML = `
      <div class="field-grid">
        <label class="field">
          <span>Helyes válasz</span>
          <input id="numericAnswerInput" type="text" value="${escapeHtml(state.form.numericAnswer)}" placeholder="pl. 4.90" />
        </label>
        <label class="field">
          <span>Tűrés</span>
          <input id="numericToleranceInput" type="number" min="0" step="0.01" value="${escapeHtml(state.form.numericTolerance)}" />
        </label>
      </div>
    `;
    return;
  }

  els.answerEditor.innerHTML = "";
}

function updateWorkspaceSummary() {
  const nextQuestionId = getNextQuestionId();
  const nextChoiceId = getNextChoiceId();
  const nextAssetId = getNextAssetId();
  const filteredQuestions = getFilteredQuestions(getOrderedQuestions());
  els.loadedCountsChip.textContent = `${state.data.questions.length} kérdés`;
  els.editModeChip.textContent = `${QUESTION_TYPE_LABELS[state.form.question_type] || state.form.question_type}`;
  els.nextQuestionIdPreview.textContent = getCurrentQuestionId();
  els.questionNavMeta.textContent = state.questionFilter
    ? `${filteredQuestions.length} találat`
    : state.editingQuestionId
      ? `Szerkesztés: ${state.editingQuestionId}`
      : "Új piszkozat";
  els.choiceCountPreview.textContent = String(getCurrentChoiceRowsCount());
  els.assetCountPreview.textContent = String(getCurrentAssetCount());
  els.draftStatus.textContent = `${state.editingQuestionId ? "Szerkesztés" : "Új kérdés"} • ${getCurrentQuestionId()}`;
  els.draftSaveState.textContent = state.lastSavedMessage;
  els.workspaceStatus.textContent = state.workspaceLabel;
  if (state.loadError) {
    els.workspaceMeta.textContent = `CSV-betöltési hiba: ${state.loadError}`;
  } else {
    els.workspaceMeta.textContent = state.bankFolderHandle
      ? `Kész a mentésre a kiválasztott munkaterületre`
      : "Válaszd ki a repo gyökerét, hogy a CSV-kbe közvetlenül menteni tudjunk";
  }
  els.workspaceFiles.textContent = `Q:${nextQuestionId} / C:${nextChoiceId} / A:${nextAssetId}`;
  els.sourceIdChipPreview.textContent = state.form.sourceMode === "new" ? "új forrás" : (state.form.sourceId || "forrás");
}

function syncDeleteButtonState() {
  if (!els.deleteQuestionButton) return;
  const disabled = state.busy || !state.editingQuestionId;
  els.deleteQuestionButton.disabled = disabled;
  els.deleteQuestionButton.textContent = state.editingQuestionId ? `Kérdés törlése` : "Kérdés törlése";
}

function syncDeletePanelState() {
  if (!els.deleteQuestionPanel || !els.deleteQuestionMessage || !els.deleteQuestionConfirmInput || !els.confirmDeleteQuestionButton) {
    return;
  }
  const questionId = state.deletePendingQuestionId;
  const open = Boolean(questionId);
  els.deleteQuestionPanel.hidden = !open;
  if (!open) {
    els.deleteQuestionMessage.textContent = "";
    els.deleteQuestionConfirmInput.value = "";
    els.confirmDeleteQuestionButton.disabled = true;
    return;
  }
  const question = state.data.questions.find((item) => item.question_id === questionId) || null;
  els.deleteQuestionMessage.textContent = question
    ? `${question.question_id}: ${question.prompt_md || "Nincs kérdésszöveg."}`
    : `A kérdés törlésre kész: ${questionId}`;
  if (els.deleteQuestionConfirmInput.value !== state.deleteConfirmText) {
    els.deleteQuestionConfirmInput.value = state.deleteConfirmText;
  }
  els.confirmDeleteQuestionButton.disabled = state.busy || normalizeQuestionId(state.deleteConfirmText) !== questionId;
  if (!state.busy && document.activeElement !== els.deleteQuestionConfirmInput) {
    els.deleteQuestionConfirmInput.focus();
  }
}

function clearDeleteConfirmation(shouldRender = true) {
  state.deletePendingQuestionId = null;
  state.deleteConfirmText = "";
  if (shouldRender) {
    syncDeletePanelState();
  }
}

function getCurrentChoiceRowsCount() {
  const type = state.form.question_type;
  if (type === "single_choice" || type === "multi_choice" || type === "list_choice") {
    return getChoiceRows(type).length;
  }
  if (type === "true_false") {
    return 2;
  }
  return 0;
}

function getCurrentAssetCount() {
  const existingCount = state.editingQuestionId
    ? state.data.assets.filter((asset) => asset.question_id === state.editingQuestionId).length
    : 0;
  return existingCount + state.assetFiles.length;
}

function updateAssetList() {
  const existingAssets = state.editingQuestionId
    ? state.data.assets.filter((asset) => asset.question_id === state.editingQuestionId)
    : [];
  if (existingAssets.length === 0 && state.assetFiles.length === 0) {
    els.assetList.innerHTML = `<div class="meta-pill">Nincs kiválasztott asset.</div>`;
    return;
  }
  const kind = els.assetKindInput.value || "image";
  const existingSection = existingAssets.length
    ? `
      <div class="meta-pill">Meglévő assetek</div>
      ${existingAssets
        .map(
          (asset, index) => `
            <div class="asset-row asset-row--existing">
              <div class="choice-row__label">${index + 1}</div>
              <div>
                <strong>${escapeHtml(asset.path || asset.asset_id)}</strong>
                <div class="review-item__meta">${escapeHtml(asset.kind || "asset")} • ${escapeHtml(asset.source_locator || "nincs hely")}</div>
              </div>
              <div class="chip chip--soft">${escapeHtml(asset.kind || "asset")}</div>
            </div>
          `,
        )
        .join("")}
    `
    : "";
  const newSection = state.assetFiles.length
    ? `
      <div class="meta-pill">Újonnan kiválasztott assetek</div>
      ${state.assetFiles
        .map(
          (file, index) => `
            <div class="asset-row">
              <div class="choice-row__label">${index + 1}</div>
              <div>
                <strong>${escapeHtml(file.name)}</strong>
                <div class="review-item__meta">${escapeHtml(kind)} • ${formatBytes(file.size)}</div>
              </div>
              <div class="chip chip--soft">${escapeHtml(kind)}</div>
              <button class="asset-row__remove" type="button" data-remove-asset="${index}">Törlés</button>
            </div>
          `,
        )
        .join("")}
    `
    : "";
  els.assetList.innerHTML = `${existingSection}${newSection}`;

  for (const button of els.assetList.querySelectorAll("[data-remove-asset]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeAsset || "-1");
      state.assetFiles = state.assetFiles.filter((_file, fileIndex) => fileIndex !== index);
      els.assetFilesInput.value = "";
      updateAssetList();
      updateSummary();
      updatePreview();
    });
  }
}

function updateSummary() {
  els.choiceCountPreview.textContent = String(getCurrentChoiceRowsCount());
  els.assetCountPreview.textContent = String(getCurrentAssetCount());
  els.questionIdChipPreview.textContent = `ID ${getCurrentQuestionId()}`;
  els.sourceIdChipPreview.textContent = state.form.sourceMode === "new" ? "új forrás" : (state.form.sourceId || "forrás");
  els.draftStatus.textContent = `${state.editingQuestionId ? "Szerkesztés" : "Új kérdés"} • ${getCurrentQuestionId()}`;
  els.draftSaveState.textContent = state.lastSavedMessage;
}

function updatePreview() {
  const validation = validateDraft();
  els.validationState.textContent = validation.ok ? "Kész a mentésre" : validation.message;
  els.draftProgressFill.style.width = validation.ok ? "100%" : `${Math.max(12, 100 - validation.errors.length * 18)}%`;
  els.csvPreview.textContent = renderPreviewCsv(validation);
}

function validateDraft() {
  const errors = [];
  const type = state.form.question_type;
  if (!state.form.prompt_md.trim()) {
    errors.push("A kérdés szövege hiányzik.");
  }
  if (!getSelectedSource()) {
    errors.push("A forrás nincs megadva.");
  }
  if (type === "single_choice" || type === "multi_choice" || type === "list_choice") {
    const rows = getChoiceRows(type).filter((row) => row.text.trim());
    const correctCount = rows.filter((row) => row.correct).length;
    if (rows.length < 2) errors.push("Legalább két válasz kell.");
    if (type !== "multi_choice" && correctCount !== 1) errors.push("Pontosan egy helyes választ jelölj meg.");
    if (type === "multi_choice" && correctCount < 1) errors.push("Jelölj meg legalább egy helyes választ.");
  }
  if (type === "true_false" && !state.form.trueFalseCorrect) {
    errors.push("Válaszd ki, hogy az állítás igaz vagy hamis.");
  }
  if (type === "ordering" && state.form.orderingText.trim().split(/\r?\n/).filter(Boolean).length < 2) {
    errors.push("Az ordering kérdéshez legalább két elem kell.");
  }
  if (type === "matching" && state.form.matchingText.trim().split(/\r?\n/).filter(Boolean).length < 2) {
    errors.push("A matching kérdéshez legalább két pár kell.");
  }
  if (type === "grouping" && state.form.groupingText.trim().split(/\r?\n/).filter(Boolean).length < 2) {
    errors.push("A grouping kérdéshez legalább két elem kell.");
  }
  if (type === "matching") {
    const pairs = parsePairs(state.form.matchingText);
    if (pairs.some(([left, right]) => !left.trim() || !right.trim())) {
      errors.push("A matching sorokban mindkét oldalnak ki kell lennie töltve.");
    }
  }
  if (type === "grouping") {
    const pairs = parsePairs(state.form.groupingText);
    if (pairs.some(([item, group]) => !item.trim() || !group.trim())) {
      errors.push("A grouping sorokban az elem és a csoport neve is kell.");
    }
  }
  if (type === "numeric_entry" && !state.form.numericAnswer.trim()) {
    errors.push("A numerikus helyes válasz hiányzik.");
  }
  return {
    ok: errors.length === 0,
    errors,
    message: errors[0] || "Kész a mentésre",
  };
}

function renderPreviewCsv(validation) {
  const questionRow = buildQuestionRow();
  const sourceRow = getSelectedSource();
  const choiceRows = buildChoiceRowsPreview();
  const assetRows = buildAssetRowsPreview();

  const questionCsv = serializeCsv([questionRow], QUESTION_FIELDS);
  const choiceCsv = choiceRows.length ? serializeCsv(choiceRows, CHOICE_FIELDS) : "(nincs choices.csv sor)";
  const assetCsv = assetRows.length ? serializeCsv(assetRows, ASSET_FIELDS) : "(nincs assets.csv sor)";

  return [
    `STATE: ${validation.ok ? "OK" : validation.message}`,
    "",
    "QUESTION",
    questionCsv,
    "",
    "CHOICES",
    choiceCsv,
    "",
    "ASSETS",
    assetCsv,
    "",
    `SOURCE: ${sourceRow ? sourceRow.source_id : "n/a"} / ${sourceRow ? sourceRow.title : ""}`,
  ].join("\n");
}

function renderWorkspaceError() {
  renderStaticOptions();
  renderAnswerEditor();
  updateWorkspaceSummary();
  updateAssetList();
  updatePreview();
}

function buildQuestionRow() {
  const source = getSelectedSource();
  const type = state.form.question_type;
  const question = {
    question_id: getCurrentQuestionId(),
    question_type: type,
    prompt_md: state.form.prompt_md.trim(),
    explanation_md: state.form.explanation_md.trim(),
    topic: state.form.topic.trim(),
    subtopic: state.form.subtopic.trim(),
    difficulty: String(state.form.difficulty || 2),
    points: String(state.form.points || 1),
    time_estimate_sec: String(state.form.time_estimate_sec || 20),
    source_id: source ? source.source_id : "",
    source_locator: state.form.source_locator.trim(),
    tags: state.form.tags.trim(),
    language: state.form.language.trim() || "hu",
    correct_answer_md: "",
    answer_tolerance: "",
  };

  if (type === "numeric_entry") {
    question.correct_answer_md = state.form.numericAnswer.trim();
    question.answer_tolerance = String(state.form.numericTolerance || 0);
  }
  return question;
}

function buildChoiceRowsPreview() {
  const type = state.form.question_type;
  const questionId = getCurrentQuestionId();
  const rows = [];
  let nextChoiceIndex = getNextChoiceIdNumber();

  const addRow = (choiceLabel, text, isCorrect, sortOrder, extra = {}) => {
    rows.push({
      choice_id: `C${nextChoiceIndex++}`,
      question_id: questionId,
      choice_label: choiceLabel,
      choice_text_md: text,
      is_correct: String(Boolean(isCorrect)),
      sort_order: String(sortOrder),
      feedback_md: "",
      match_role: extra.match_role || "",
      match_choice_id: extra.match_choice_id || "",
      group_label: extra.group_label || "",
    });
  };

  if (type === "single_choice" || type === "multi_choice" || type === "list_choice") {
    getChoiceRows(type)
      .filter((row) => row.text.trim())
      .forEach((row, index) => {
        addRow(choiceLabelForIndex(index), row.text.trim(), row.correct, index + 1);
      });
    return rows;
  }

  if (type === "true_false") {
    const firstCorrect = state.form.trueFalseCorrect === "true";
    addRow("A", "Igaz", firstCorrect, 1);
    addRow("B", "Hamis", !firstCorrect, 2);
    return rows;
  }

  if (type === "ordering") {
    parseLines(state.form.orderingText).forEach((line, index) => {
      addRow(choiceLabelForIndex(index), line, false, index + 1);
    });
    return rows;
  }

  if (type === "matching") {
    const pairs = parsePairs(state.form.matchingText);
    const rightIds = [];
    pairs.forEach(([left, right], index) => {
      const rightChoiceId = `C${nextChoiceIndex++}`;
      rightIds.push(rightChoiceId);
      rows.push({
        choice_id: rightChoiceId,
        question_id: questionId,
        choice_label: String(index + 1),
        choice_text_md: right,
        is_correct: "false",
        sort_order: String(index + 1),
        feedback_md: "",
        match_role: "right",
        match_choice_id: "",
        group_label: "",
      });
    });
    pairs.forEach(([left, right], index) => {
      rows.push({
        choice_id: `C${nextChoiceIndex++}`,
        question_id: questionId,
        choice_label: choiceLabelForIndex(index),
        choice_text_md: left,
        is_correct: "false",
        sort_order: String(index + 1),
        feedback_md: "",
        match_role: "left",
        match_choice_id: rightIds[index] || "",
        group_label: "",
      });
    });
    return rows;
  }

  if (type === "grouping") {
    parsePairs(state.form.groupingText).forEach(([item, groupLabel], index) => {
      addRow(choiceLabelForIndex(index), item, false, index + 1, { group_label: groupLabel });
    });
    return rows;
  }

  return rows;
}

function buildAssetRowsPreview() {
  const source = getSelectedSource();
  const questionId = getCurrentQuestionId();
  const kind = els.assetKindInput.value || "image";
  const existingRows = state.editingQuestionId
    ? state.data.assets.filter((asset) => asset.question_id === state.editingQuestionId)
    : [];
  const existingPreview = existingRows.map((row) => ({ ...row }));
  const newPreview = state.assetFiles.map((file, index) => ({
    asset_id: `A${String(getNextAssetIdNumber() + index).padStart(4, "0")}`,
    question_id: questionId,
    path: `../kerdesbank/media/${sanitizeFilename(file.name)}`,
    kind,
    alt_text: PathLike(file.name),
    source_id: source ? source.source_id : "",
    source_locator: state.form.source_locator.trim(),
  }));
  return [...existingPreview, ...newPreview];
}

function getSelectedSource() {
  if (state.form.sourceMode === "new") {
    if (!state.form.newSource.title.trim()) {
      return null;
    }
    const source = {
      source_id: getNextSourceId(),
      title: state.form.newSource.title.trim(),
      path: state.form.newSource.path.trim(),
      source_type: state.form.newSource.source_type.trim() || "pdf",
      year: state.form.newSource.year.trim(),
      category: state.form.newSource.category.trim() || "vizsga",
      notes: state.form.newSource.notes.trim(),
    };
    return source;
  }
  return state.data.sources.find((source) => source.source_id === state.form.sourceId) || null;
}

function getNextQuestionId() {
  return `Q${String(getNextNumericId(state.data.questions, "question_id", "Q")).padStart(4, "0")}`;
}

function getCurrentQuestionId() {
  return state.editingQuestionId || getNextQuestionId();
}

function getNextChoiceIdNumber() {
  return getNextNumericId(state.data.choices, "choice_id", "C");
}

function getNextAssetIdNumber() {
  return getNextNumericId(state.data.assets, "asset_id", "A");
}

function getNextAssetId() {
  return `A${String(getNextAssetIdNumber()).padStart(4, "0")}`;
}

function getNextSourceId() {
  return `S${String(getNextNumericId(state.data.sources, "source_id", "S")).padStart(4, "0")}`;
}

function getNextNumericId(rows, field, prefix) {
  let max = 0;
  for (const row of rows) {
    const value = String(row[field] || "");
    if (!value.startsWith(prefix)) continue;
    const match = value.match(/(\d+)$/);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

async function saveDraftToWorkspace() {
  syncDraftFromInputs();
  const validation = validateDraft();
  if (!validation.ok) {
    state.lastSavedMessage = validation.message;
    updatePreview();
    updateWorkspaceSummary();
    return;
  }

  if (!state.bankFolderHandle) {
    try {
      await pickWorkspace();
    } catch {
      state.lastSavedMessage = "Mappa kiválasztása szükséges";
      updateWorkspaceSummary();
      return;
    }
  }

  state.busy = true;
  els.saveButton.disabled = true;
  els.saveButtonTop.disabled = true;

  try {
    const questionRow = buildQuestionRow();
    const sourceRow = getSelectedSource();
    const editingQuestionId = state.editingQuestionId;
    const questionRows = editingQuestionId
      ? state.data.questions.map((row) => (row.question_id === editingQuestionId ? questionRow : row))
      : [...state.data.questions, questionRow];
    let sourcesRows = [...state.data.sources];
    if (state.form.sourceMode === "new") {
      sourcesRows = [...sourcesRows, sourceRow];
    }

    let choiceRows = editingQuestionId
      ? state.data.choices.filter((row) => row.question_id !== editingQuestionId)
      : [...state.data.choices];
    const newChoiceRows = buildChoiceRowsPreview();
    choiceRows.push(...newChoiceRows);

    const assetRows = [...state.data.assets];
    const copiedAssetRows = await writeAssetFiles(questionRow.question_id, sourceRow);
    assetRows.push(...copiedAssetRows);

    await writeWorkspaceCsv("questions.csv", questionRows, QUESTION_FIELDS);
    await writeWorkspaceCsv("choices.csv", choiceRows, CHOICE_FIELDS);
    await writeWorkspaceCsv("assets.csv", assetRows, ASSET_FIELDS);
    await writeWorkspaceCsv("sources.csv", sourcesRows, SOURCE_FIELDS);

    state.data.questions = questionRows;
    state.data.choices = choiceRows;
    state.data.assets = assetRows;
    state.data.sources = sourcesRows;
    state.assetFiles = [];
    els.assetFilesInput.value = "";
    state.lastSavedMessage = `Elmentve: ${questionRow.question_id}`;
    if (state.form.sourceMode === "new") {
      state.form.sourceMode = "existing";
      state.form.sourceId = sourceRow.source_id;
    }
    if (!editingQuestionId) {
      state.editingQuestionId = null;
      state.form = createBlankDraft();
      state.form.sourceMode = "existing";
      if (state.data.sources.length > 0) {
        state.form.sourceId = state.data.sources[0].source_id;
      }
    }
    saveDraft();
    renderStaticOptions();
    renderAll();
  } catch (error) {
    console.error(error);
    state.lastSavedMessage = `Mentési hiba: ${error.message}`;
  } finally {
    state.busy = false;
    els.saveButton.disabled = false;
    els.saveButtonTop.disabled = false;
    updateWorkspaceSummary();
  }
}

function deleteCurrentQuestion() {
  const questionId = state.editingQuestionId;
  if (!questionId) return;
  state.deletePendingQuestionId = questionId;
  state.deleteConfirmText = "";
  syncDeletePanelState();
}

async function confirmDeleteCurrentQuestion() {
  const questionId = state.deletePendingQuestionId;
  if (!questionId) return;
  if (normalizeQuestionId(state.deleteConfirmText) !== questionId) {
    state.lastSavedMessage = `Törléshez írd be pontosan ezt: ${questionId}`;
    updateWorkspaceSummary();
    syncDeletePanelState();
    return;
  }

  if (!state.bankFolderHandle) {
    try {
      await pickWorkspace();
    } catch {
      state.lastSavedMessage = "Mappa kiválasztása szükséges";
      updateWorkspaceSummary();
      return;
    }
  }

  const orderedQuestions = getOrderedQuestions();
  const currentIndex = orderedQuestions.findIndex((question) => question.question_id === questionId);
  const fallbackQuestion =
    orderedQuestions[currentIndex + 1] ||
    orderedQuestions[currentIndex - 1] ||
    null;

  state.busy = true;
  els.saveButton.disabled = true;
  els.saveButtonTop.disabled = true;
  if (els.deleteQuestionButton) els.deleteQuestionButton.disabled = true;
  if (els.confirmDeleteQuestionButton) els.confirmDeleteQuestionButton.disabled = true;

  try {
    const questionRows = state.data.questions.filter((row) => row.question_id !== questionId);
    const choiceRows = state.data.choices.filter((row) => row.question_id !== questionId);
    const assetRows = state.data.assets.filter((row) => row.question_id !== questionId);

    await writeWorkspaceCsv("questions.csv", questionRows, QUESTION_FIELDS);
    await writeWorkspaceCsv("choices.csv", choiceRows, CHOICE_FIELDS);
    await writeWorkspaceCsv("assets.csv", assetRows, ASSET_FIELDS);

    state.data.questions = questionRows;
    state.data.choices = choiceRows;
    state.data.assets = assetRows;
    state.assetFiles = [];
    els.assetFilesInput.value = "";
    clearDeleteConfirmation(false);

    if (fallbackQuestion) {
      state.editingQuestionId = fallbackQuestion.question_id;
      state.form = createDraftFromQuestion(fallbackQuestion);
      saveDraft();
    } else {
      startNewDraft();
    }

    state.lastSavedMessage = `Törölve: ${questionId}`;
    renderStaticOptions();
    renderAll();
  } catch (error) {
    console.error(error);
    state.lastSavedMessage = `Törlési hiba: ${error.message}`;
    updateWorkspaceSummary();
  } finally {
    state.busy = false;
    els.saveButton.disabled = false;
    els.saveButtonTop.disabled = false;
    syncDeleteButtonState();
    syncDeletePanelState();
    updateWorkspaceSummary();
  }
}

async function writeAssetFiles(questionId, sourceRow) {
  if (state.assetFiles.length === 0) return [];
  const mediaDir = await state.bankFolderHandle.getDirectoryHandle("media", { create: true });
  const rows = [];
  const kind = els.assetKindInput.value || "image";
  const sourceLocator = state.form.source_locator.trim();
  for (const file of state.assetFiles) {
    const targetName = await uniqueFileName(mediaDir, file.name);
    const targetHandle = await mediaDir.getFileHandle(targetName, { create: true });
    const writable = await targetHandle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
    rows.push({
      asset_id: `A${String(getNextAssetIdNumber() + rows.length).padStart(4, "0")}`,
      question_id: questionId,
      path: `../kerdesbank/media/${targetName}`,
      kind,
      alt_text: PathLike(file.name),
      source_id: sourceRow ? sourceRow.source_id : "",
      source_locator: sourceLocator,
    });
  }
  return rows;
}

async function uniqueFileName(directoryHandle, desiredName) {
  const sanitized = sanitizeFilename(desiredName);
  let candidate = sanitized;
  let suffix = 1;
  while (await fileExists(directoryHandle, candidate)) {
    const extIndex = sanitized.lastIndexOf(".");
    if (extIndex > 0) {
      const stem = sanitized.slice(0, extIndex);
      const ext = sanitized.slice(extIndex);
      candidate = `${stem}_${suffix}${ext}`;
    } else {
      candidate = `${sanitized}_${suffix}`;
    }
    suffix += 1;
  }
  return candidate;
}

async function fileExists(directoryHandle, name) {
  try {
    await directoryHandle.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function writeWorkspaceCsv(filename, rows, fields) {
  const fileHandle = await state.bankFolderHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(serializeCsv(rows, fields));
  await writable.close();
}

function resetDraftForm() {
  if (!confirm("Biztosan törlöd a jelenlegi piszkozatot?")) return;
  startNewDraft();
}

function createDefaultChoiceRows(type) {
  if (type === "multi_choice") {
    return [
      { text: "", correct: true },
      { text: "", correct: false },
      { text: "", correct: false },
      { text: "", correct: false },
    ];
  }
  return [
    { text: "", correct: true },
    { text: "", correct: false },
    { text: "", correct: false },
    { text: "", correct: false },
  ];
}

function getNextChoiceId() {
  return `C${String(getNextChoiceIdNumber()).padStart(4, "0")}`;
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    form: state.form,
    assetFiles: [],
    workspaceLabel: state.workspaceLabel,
    editingQuestionId: state.editingQuestionId,
    questionFilter: state.questionFilter,
  }));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { form: createBlankDraft(), editingQuestionId: null };
    }
    const parsed = JSON.parse(raw);
    if (parsed && parsed.form) {
      return {
        form: parsed.form,
        editingQuestionId: parsed.editingQuestionId || null,
        questionFilter: parsed.questionFilter || "",
      };
    }
    return { form: parsed || createBlankDraft(), editingQuestionId: null, questionFilter: "" };
  } catch {
    return { form: createBlankDraft(), editingQuestionId: null, questionFilter: "" };
  }
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

function serializeCsv(rows, fields) {
  const escape = (value) => {
    const text = String(value ?? "");
    if (/[;"\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [fields.join(";")];
  for (const row of rows) {
    lines.push(fields.map((field) => escape(row[field])).join(";"));
  }
  return `${lines.join("\n")}\n`;
}

function choiceLabelForIndex(index) {
  let num = index + 1;
  let letters = "";
  while (num > 0) {
    num -= 1;
    letters = String.fromCharCode(65 + (num % 26)) + letters;
    num = Math.floor(num / 26);
  }
  return letters;
}

function parseLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePairs(text) {
  return parseLines(text).map((line) => {
    if (line.includes("|")) {
      const [left, right] = line.split("|", 2);
      return [left.trim(), right.trim()];
    }
    if (line.includes("=>")) {
      const [left, right] = line.split("=>", 2);
      return [left.trim(), right.trim()];
    }
    if (line.includes("=")) {
      const [left, right] = line.split("=", 2);
      return [left.trim(), right.trim()];
    }
    return [line, ""];
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function normalizeQuestionId(text) {
  return normalizeText(text).toUpperCase();
}

function sanitizeFilename(name) {
  return String(name || "asset")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_");
}

function PathLike(name) {
  return String(name || "").replace(/\.[^.]+$/, "");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
