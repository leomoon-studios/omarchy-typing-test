import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function qmlLibrary(relativePath, extras = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8")
    .replace(/^\.pragma\s+library\s*$/gm, "")
    .replace(/^\.import\s+.*$/gm, "");
  const context = vm.createContext({ ...extras });
  vm.runInContext(source, context, { filename });
  return context;
}

function qmlFunctionSource(relativePath, functionName) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${relativePath} is missing ${functionName}()`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === "{") depth++;
    else if (source[index] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not parse ${functionName}() from ${relativePath}`);
}

const Normalization = qmlLibrary("js/Normalization.js");
const Metrics = qmlLibrary("js/Metrics.js", { Normalization });
const PassageLoader = qmlLibrary("js/PassageLoader.js");
const ImportSafety = qmlLibrary("js/ImportSafety.js");
const Pagination = qmlLibrary("js/Pagination.js");
const Persistence = qmlLibrary("js/Persistence.js");
const AdaptivePractice = qmlLibrary("js/AdaptivePractice.js", { Normalization });
const Coaching = qmlLibrary("js/Coaching.js");
const Progress = qmlLibrary("js/Progress.js");
const KeyboardNavigation = qmlLibrary("js/KeyboardNavigation.js");
const KeyboardHeatmap = qmlLibrary("js/KeyboardHeatmap.js");

assert.equal(ImportSafety.utf8ByteLength("abc"), 3);
assert.equal(ImportSafety.utf8ByteLength("ش"), 2);
assert.equal(ImportSafety.utf8ByteLength("😀"), 4);
assert.equal(ImportSafety.validateCollection("  My passages  ").value, "My passages");
assert.equal(ImportSafety.validateCollection("x".repeat(ImportSafety.MAX_COLLECTION_CHARACTERS + 1)).ok, false);

const safeEnglishImport = ImportSafety.prepare("First passage.\n\nSecond passage.", "en", "English set", "", 123);
assert.equal(safeEnglishImport.ok, true);
assert.equal(safeEnglishImport.count, 2);
const safeEnglishRows = safeEnglishImport.addition.trim().split("\n").map(line => JSON.parse(line));
assert.deepEqual(safeEnglishRows.map(row => row.id), ["custom-en-123-1", "custom-en-123-2"]);
assert.deepEqual(safeEnglishRows.map(row => row.text), ["First passage.", "Second passage."]);
assert.equal(safeEnglishRows[0].collection, "English set");

const safePersianImport = ImportSafety.prepare("متن نخست\n\nمتن دوم", "fa", "متن‌های من", "", 456);
assert.equal(safePersianImport.ok, true);
assert.equal(safePersianImport.count, 2);
assert.equal(JSON.parse(safePersianImport.addition.split("\n")[0]).language, "fa");

const excessivePassages = Array.from({ length: ImportSafety.MAX_PASSAGES + 1 }, () => "a").join("\n\n");
assert.equal(ImportSafety.prepare(excessivePassages, "en", "Too many", "", 1).ok, false);
assert.equal(ImportSafety.prepare("x".repeat(ImportSafety.MAX_PASSAGE_CHARACTERS + 1), "en", "Too long", "", 1).ok, false);
assert.equal(ImportSafety.prepare("one", "en", "Full", "x".repeat(ImportSafety.MAX_SERIALIZED_BYTES), 1).ok, false);
assert.equal(ImportSafety.prepare(" \n\n\t", "en", "Empty", "", 1).ok, false);

const navigationRoot = { parent: null, name: "root" };
const navigationFirst = { parent: navigationRoot, name: "first", focused: false };
const navigationSecond = { parent: navigationRoot, name: "second", focused: false };
const navigationOutside = { parent: null, name: "outside", focused: false };
const navigationChain = [navigationRoot, navigationFirst, navigationSecond, navigationOutside];
for (let index = 0; index < navigationChain.length; index++) {
  const item = navigationChain[index];
  item.nextItemInFocusChain = forward => navigationChain[(index + (forward ? 1 : -1) + navigationChain.length) % navigationChain.length];
  item.forceActiveFocus = () => { item.focused = true; };
}
assert.equal(KeyboardNavigation.contains(navigationRoot, navigationFirst), true);
assert.equal(KeyboardNavigation.contains(navigationRoot, navigationOutside), false);
assert.equal(KeyboardNavigation.focusNext(navigationRoot, navigationRoot, true), navigationFirst);
assert.equal(navigationFirst.focused, true);
assert.equal(KeyboardNavigation.focusNext(navigationRoot, navigationFirst, false), navigationSecond);
assert.equal(navigationSecond.focused, true);

assert.equal(Normalization.normalizeCharacter("ي", { persianNormalization: "forgiving" }), "ی");
assert.equal(Normalization.normalizeCharacter("ك", { persianNormalization: "forgiving" }), "ک");
assert.equal(Normalization.normalizeCharacter("ي", { persianNormalization: "strict" }), "ي");
assert.equal(Normalization.normalizeCharacter("٤", { digitNormalization: "persian-arabic" }), "۴");
assert.equal(Normalization.normalizeCharacter("۴", { digitNormalization: "all" }), "4");
assert.equal(Normalization.normalizeCharacter("\u200c", { zwnjCountsAsError: false }), "");
assert.equal(Normalization.equivalent("ی", "ي", { persianNormalization: "forgiving" }), true);
assert.deepEqual(Array.from(Normalization.normalizedCharacters("می‌روم", { zwnjCountsAsError: false })), Array.from("میروم"));

const oneMinute = Metrics.calculate(250, 245, 5, 60, 42);
assert.equal(oneMinute.grossWpm, 50);
assert.equal(oneMinute.netWpm, 49);
assert.equal(oneMinute.literalWpm, 42);
assert.equal(oneMinute.accuracy, 98);
assert.equal(Metrics.consistency([{ grossWpm: 50 }, { grossWpm: 50 }, { grossWpm: 50 }]), 100);
assert.equal(Metrics.consistency([{ grossWpm: 50 }, { grossWpm: 52 }]), null);
assert.equal(Metrics.completedWordCount("one two three", 8), 2);
assert.equal(Metrics.completedWordCount("one two three", 13), 3);
assert.equal(JSON.stringify(Metrics.evaluateFinal("یک", "يك", { persianNormalization: "forgiving" })), JSON.stringify({ correct: 2, incorrect: 0, entered: 2 }));
assert.equal(JSON.stringify(Metrics.evaluateFinal("می‌روم", "میروم", { zwnjCountsAsError: false })), JSON.stringify({ correct: 5, incorrect: 0, entered: 5 }));
assert.equal(JSON.stringify(Metrics.evaluateFinal("میروم", "می‌روم", { zwnjCountsAsError: false })), JSON.stringify({ correct: 5, incorrect: 0, entered: 5 }));
assert.equal(JSON.stringify(Metrics.evaluateFinal("می‌روم", "میروم", { zwnjCountsAsError: true })), JSON.stringify({ correct: 2, incorrect: 3, entered: 5 }));

assert.equal(Pagination.wordBoundaryEnd(Array.from("one two three"), 0, 9), 8);
assert.equal(Pagination.wordBoundaryEnd(Array.from("one two three"), 8, 11), 11);
assert.equal(Pagination.wordBoundaryEnd(Array.from("یک دو سه"), 0, 6), 6);
assert.equal(Pagination.wordBoundaryEnd(Array.from("longword"), 0, 4), 4);

const events = [
  { expected: "e", actual: "r", corrected: false, firstAttempt: true },
  { expected: "e", actual: "r", corrected: true, firstAttempt: false },
  { expected: "e", actual: "w", corrected: false, firstAttempt: true }
];
const substitutions = Metrics.substitutions(events, true);
assert.equal(substitutions[0].expected, "e");
assert.equal(substitutions[0].actual, "r");
assert.equal(substitutions[0].count, 2);
const difficult = Metrics.difficultCharacters(events, { e: 10 }, true, 3);
assert.equal(difficult.length, 1);
assert.equal(difficult[0].totalErrors, 3);
assert.equal(difficult[0].firstAttemptErrors, 2);
const completeCharacterStats = Metrics.characterStats(events, { e: 10, "ي": 3, " ": 4 }, { persianNormalization: "forgiving" });
assert.equal(completeCharacterStats.length, 2);
assert.deepEqual(JSON.parse(JSON.stringify(completeCharacterStats[0])), {
  character: "e",
  opportunities: 10,
  firstAttemptErrors: 2,
  totalErrors: 3
});
assert.equal(completeCharacterStats[1].character, "ی");
assert.equal(completeCharacterStats[1].opportunities, 3);

const reachedPositions = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index, true]));
const patternEvents = [
  { position: 1, expected: "h", actual: "x", corrected: false, firstAttempt: true },
  { position: 5, expected: "h", actual: "j", corrected: false, firstAttempt: true }
];
const difficultBigrams = Metrics.difficultBigrams("the the", patternEvents, reachedPositions, {}, true, 24);
assert.equal(difficultBigrams[0].bigram, "th");
assert.equal(difficultBigrams[0].opportunities, 2);
assert.equal(difficultBigrams[0].firstAttemptErrors, 2);
assert.equal(difficultBigrams[0].errorRate, 1);
const difficultWords = Metrics.difficultWords("The the", patternEvents, reachedPositions, {}, true, 24);
assert.equal(difficultWords[0].word, "the");
assert.equal(difficultWords[0].opportunities, 2);
assert.equal(difficultWords[0].errorOccurrences, 2);
assert.equal(difficultWords[0].totalErrors, 2);
const persianDifficultWord = Metrics.difficultWords("كتاب کتاب", [
  { position: 1, expected: "ت", actual: "ب", corrected: false, firstAttempt: true },
  { position: 6, expected: "ت", actual: "ب", corrected: false, firstAttempt: true }
], Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index, true])), { persianNormalization: "forgiving" }, true, 24);
assert.equal(persianDifficultWord.length, 1);
assert.equal(persianDifficultWord[0].word, "کتاب");
assert.equal(persianDifficultWord[0].opportunities, 2);
const hesitationStats = Metrics.hesitationStats([
  { character: "e", delayMs: 1200 },
  { character: "e", delayMs: 1800 },
  { character: "x", delayMs: 999 },
  { character: " ", delayMs: 2500 }
], {}, 24);
assert.equal(hesitationStats.length, 1);
assert.equal(hesitationStats[0].character, "e");
assert.equal(hesitationStats[0].count, 2);
assert.equal(hesitationStats[0].averageDelayMs, 1500);
const keyTimingStats = Metrics.keyTimingStats([
  { character: "e", intervalMs: 200 },
  { character: "e", intervalMs: 300 },
  { character: "x", intervalMs: 150 },
  { character: " ", intervalMs: 400 }
], [{ expected: "e", firstAttempt: true }], { e: 4, x: 2, " ": 3 }, {});
assert.equal(keyTimingStats.length, 2);
assert.equal(keyTimingStats[0].character, "e");
assert.equal(keyTimingStats[0].opportunities, 4);
assert.equal(keyTimingStats[0].errorRate, 0.25);
assert.equal(keyTimingStats[0].averageIntervalMs, 250);
assert.equal(keyTimingStats[0].speedCpm, 240);
assert.equal(keyTimingStats[1].character, "x");
const parsiPatternEvents = [
  { position: 1, expected: "ب", actual: "پ", corrected: false, firstAttempt: true },
  { position: 4, expected: "ب", actual: "پ", corrected: false, firstAttempt: true }
];
const parsiReachedPositions = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [index, true]));
const parsiDifficultBigrams = Metrics.difficultBigrams("شب شب", parsiPatternEvents, parsiReachedPositions, {}, true, 24);
assert.equal(parsiDifficultBigrams[0].bigram, "شب");
assert.equal(parsiDifficultBigrams[0].opportunities, 2);
assert.equal(parsiDifficultBigrams[0].firstAttemptErrors, 2);
const parsiPatternWords = Metrics.difficultWords("شب شب", parsiPatternEvents, parsiReachedPositions, {}, true, 24);
assert.equal(parsiPatternWords[0].word, "شب");
assert.equal(parsiPatternWords[0].opportunities, 2);
assert.equal(parsiPatternWords[0].errorOccurrences, 2);
const parsiHesitations = Metrics.hesitationStats([
  { character: "ي", delayMs: 1200 },
  { character: "ی", delayMs: 1800 }
], { persianNormalization: "forgiving" }, 24);
assert.equal(parsiHesitations[0].character, "ی");
assert.equal(parsiHesitations[0].count, 2);
assert.equal(parsiHesitations[0].averageDelayMs, 1500);
const parsiKeyTimings = Metrics.keyTimingStats([
  { character: "ي", intervalMs: 400 },
  { character: "ی", intervalMs: 600 }
], [{ expected: "ی", firstAttempt: true }], { "ی": 4 }, { persianNormalization: "forgiving" });
assert.equal(parsiKeyTimings[0].character, "ی");
assert.equal(parsiKeyTimings[0].opportunities, 4);
assert.equal(parsiKeyTimings[0].averageIntervalMs, 500);
assert.equal(parsiKeyTimings[0].speedCpm, 120);
assert.equal(parsiKeyTimings[0].errorRate, 0.25);

const parsed = PassageLoader.parseJsonLines('{"id":"one","language":"en","text":"Hello"}\nnot-json\n{"id":"empty","language":"en","text":"   "}\n{"id":"two","language":"fa","text":"سلام"}\n');
assert.equal(parsed.length, 2);
assert.equal(PassageLoader.filter(parsed, "fa", "mixed", "mixed").length, 1);

const defaultSettings = {
  schemaVersion: 3,
  defaultLanguage: "en",
  defaultTestType: "timed",
  defaultDurationSeconds: 60,
  defaultWordCount: 25,
  defaultCategory: "common",
  defaultDifficulty: "mixed",
  showLiveWpm: true,
  showLiveAccuracy: true,
  persianNormalization: "forgiving",
  digitNormalization: "exact",
  zwnjCountsAsError: true,
  includeCorrectedErrorsInDifficulty: true,
  adaptiveHistoryWindow: 10,
  progressRange: "30-tests",
  coachingEnabled: true
};
const nullSettings = Persistence.sanitizeSettings(null, defaultSettings);
assert.equal(nullSettings.value.defaultLanguage, "en");
assert.equal(nullSettings.value.defaultTestType, "timed");
assert.equal(nullSettings.value.defaultWordCount, 25);
assert.equal(nullSettings.value.defaultDurationSeconds, 60);
assert.equal(nullSettings.issues.length > 0, true);
const malformedSettings = Persistence.parseSettings('{"defaultLanguage":', defaultSettings);
assert.equal(malformedSettings.invalidJson, true);
assert.equal(malformedSettings.value.defaultLanguage, "en");
assert.equal(malformedSettings.value.showLiveWpm, true);
const emptySettings = Persistence.parseSettings("", defaultSettings);
assert.equal(emptySettings.invalidJson, false);
assert.equal(emptySettings.issues.length, 0);
const nullSettingsJson = Persistence.parseSettings("null", defaultSettings);
assert.equal(nullSettingsJson.invalidJson, false);
assert.equal(nullSettingsJson.issues.length > 0, true);
assert.equal(nullSettingsJson.value.defaultLanguage, "en");
const repairedSettings = Persistence.sanitizeSettings({
  defaultLanguage: null,
  defaultTestType: "laps",
  defaultDurationSeconds: -10,
  defaultWordCount: 42,
  defaultCategory: [],
  defaultDifficulty: 2,
  showLiveWpm: "yes",
  showLiveAccuracy: false,
  persianNormalization: "unknown",
  digitNormalization: "all",
  zwnjCountsAsError: null,
  includeCorrectedErrorsInDifficulty: true,
  adaptiveHistoryWindow: 100,
  progressRange: "invalid",
  coachingEnabled: "yes"
}, defaultSettings);
assert.equal(repairedSettings.value.defaultLanguage, "en");
assert.equal(repairedSettings.value.defaultTestType, "timed");
assert.equal(repairedSettings.value.defaultDurationSeconds, 15);
assert.equal(repairedSettings.value.defaultWordCount, 25);
assert.equal(repairedSettings.value.defaultCategory, "common");
assert.equal(repairedSettings.value.defaultDifficulty, "2");
assert.equal(repairedSettings.value.showLiveWpm, true);
assert.equal(repairedSettings.value.showLiveAccuracy, false);
assert.equal(repairedSettings.value.persianNormalization, "forgiving");
assert.equal(repairedSettings.value.digitNormalization, "all");
assert.equal(repairedSettings.value.adaptiveHistoryWindow, 50);
assert.equal(repairedSettings.value.progressRange, "30-tests");
assert.equal(repairedSettings.value.coachingEnabled, true);

const malformedHistoryResult = {
  id: "result-1",
  completedAt: "2026-08-23T12:00:00.000Z",
  language: "fa",
  accuracy: 150,
  consistency: "not-a-number",
  passageIds: [null, "fa-common-001"],
  difficultCharacters: [
    null,
    { character: "ش", opportunities: "10", firstAttemptErrors: "3", totalErrors: "4", errorRate: "not-a-number" }
  ],
  substitutions: [
    null,
    { expected: "ش", actual: null, count: "2" },
    { expected: "", actual: "x", count: 1 },
    { expected: " ", actual: "", count: 1 }
  ],
  wpmSamples: [null, { elapsedSeconds: "5", grossWpm: "42" }]
};
const malformedHistoryRaw = [
  JSON.stringify(malformedHistoryResult),
  "not-json",
  "null",
  JSON.stringify({ id: "missing-date" })
].join("\n") + "\n";
const parsedHistory = Persistence.parseHistory(malformedHistoryRaw);
assert.equal(parsedHistory.rows.length, 1);
assert.equal(parsedHistory.rejectedLines.length, 3);
assert.equal(parsedHistory.repairedCount, 1);
assert.equal(parsedHistory.rows[0].accuracy, 100);
assert.equal(parsedHistory.rows[0].consistency, null);
assert.deepEqual(Array.from(parsedHistory.rows[0].passageIds), ["fa-common-001"]);
assert.equal(parsedHistory.rows[0].difficultCharacters.length, 1);
assert.equal(parsedHistory.rows[0].difficultCharacters[0].character, "ش");
assert.equal(parsedHistory.rows[0].substitutions.length, 3);
assert.equal(parsedHistory.rows[0].substitutions[0].actual, "");
assert.equal(parsedHistory.rows[0].substitutions[1].expected, "");
assert.equal(parsedHistory.rows[0].substitutions[1].actual, "x");
assert.equal(parsedHistory.rows[0].substitutions[2].expected, " ");
assert.equal(parsedHistory.rows[0].wpmSamples.length, 1);
assert.equal(parsedHistory.rows[0].wpmSamples[0].grossWpm, 42);
assert.equal(parsedHistory.rows[0].schemaVersion, 1);
assert.equal(parsedHistory.rows[0].mode, "standard");
assert.equal(parsedHistory.rows[0].testType, "timed");
assert.equal(parsedHistory.rows[0].targetWordCount, 0);
assert.deepEqual(Array.from(parsedHistory.rows[0].adaptiveTargets), []);
assert.deepEqual(Array.from(parsedHistory.rows[0].characterStats), []);
assert.equal(Persistence.sanitizeResult(null).value, null);
assert.deepEqual(Array.from(Persistence.parseHistory(null).rows), []);
assert.deepEqual(Array.from(Persistence.parseHistory("").rejectedLines), []);
const malformedNestedResult = Persistence.sanitizeResult({
  id: "nested-types",
  completedAt: "2026-08-23T12:00:00.000Z",
  configuredDurationSeconds: null,
  accuracy: "",
  passageIds: {},
  difficultCharacters: "broken",
  substitutions: 12,
  wpmSamples: false
});
assert.notEqual(malformedNestedResult.value, null);
assert.deepEqual(Array.from(malformedNestedResult.value.passageIds), []);
assert.deepEqual(Array.from(malformedNestedResult.value.difficultCharacters), []);
assert.deepEqual(Array.from(malformedNestedResult.value.substitutions), []);
assert.deepEqual(Array.from(malformedNestedResult.value.wpmSamples), []);
assert.equal(malformedNestedResult.value.configuredDurationSeconds, 60);
assert.equal(malformedNestedResult.value.accuracy, 0);
assert.equal(malformedNestedResult.issues.length >= 6, true);
const versionTwoResult = Persistence.sanitizeResult({
  schemaVersion: 2,
  id: "version-two",
  completedAt: "2026-08-23T13:00:00.000Z",
  language: "fa",
  mode: "adaptive",
  typedText: "private input",
  expectedText: "private passage",
  adaptiveTargets: ["ش", null, "ش", " "],
  characterStats: [
    { character: "ش", opportunities: "12", firstAttemptErrors: "3", totalErrors: "4" },
    null,
    { character: " ", opportunities: 4, firstAttemptErrors: 2, totalErrors: 2 }
  ]
});
assert.equal(versionTwoResult.value.schemaVersion, 2);
assert.equal(versionTwoResult.value.mode, "adaptive");
assert.deepEqual(Array.from(versionTwoResult.value.adaptiveTargets), ["ش"]);
assert.equal(versionTwoResult.value.characterStats.length, 1);
assert.equal(versionTwoResult.value.characterStats[0].opportunities, 12);
assert.equal(versionTwoResult.issues.length > 0, true);
assert.equal(Object.hasOwn(versionTwoResult.value, "typedText"), false);
assert.equal(Object.hasOwn(versionTwoResult.value, "expectedText"), false);
const versionThreeWordResult = Persistence.sanitizeResult({
  schemaVersion: 3,
  id: "version-three-words",
  completedAt: "2026-08-23T14:00:00.000Z",
  language: "en",
  mode: "adaptive",
  testType: "words",
  targetWordCount: 50,
  configuredDurationSeconds: 300,
  durationSeconds: 42
});
assert.equal(versionThreeWordResult.value.schemaVersion, 3);
assert.equal(versionThreeWordResult.value.testType, "words");
assert.equal(versionThreeWordResult.value.targetWordCount, 50);
assert.equal(versionThreeWordResult.value.configuredDurationSeconds, 0);
const repairedPassageResult = Persistence.sanitizeResult({
  schemaVersion: 3,
  id: "version-three-passage",
  completedAt: "2026-08-23T15:00:00.000Z",
  mode: "adaptive",
  testType: "passage",
  targetWordCount: 100
});
assert.equal(repairedPassageResult.value.testType, "passage");
assert.equal(repairedPassageResult.value.mode, "standard");
assert.equal(repairedPassageResult.value.targetWordCount, 0);
const versionFourAnalysisResult = Persistence.sanitizeResult({
  schemaVersion: 4,
  id: "version-four-analysis",
  completedAt: "2026-08-23T16:00:00.000Z",
  difficultBigrams: [{ bigram: "th", opportunities: 4, firstAttemptErrors: 2, totalErrors: 3, errorRate: 0.5 }],
  difficultWords: [{ word: "there", opportunities: 3, errorOccurrences: 2, totalErrors: 3, errorRate: 2 / 3 }],
  hesitationStats: [{ character: "e", count: 2, totalDelayMs: 3000, averageDelayMs: 1500, maxDelayMs: 1800 }],
  adaptiveBigrams: ["th"],
  adaptiveWords: ["there"],
  adaptiveHesitationCharacters: ["e"],
  typedText: "must not persist",
  expectedText: "must not persist",
  hesitationEvents: [{ character: "e", delayMs: 1500 }]
});
assert.equal(versionFourAnalysisResult.value.schemaVersion, 4);
assert.equal(versionFourAnalysisResult.value.difficultBigrams[0].bigram, "th");
assert.equal(versionFourAnalysisResult.value.difficultWords[0].word, "there");
assert.equal(versionFourAnalysisResult.value.hesitationStats[0].averageDelayMs, 1500);
assert.deepEqual(Array.from(versionFourAnalysisResult.value.adaptiveWords), ["there"]);
for (const privateField of ["typedText", "expectedText", "hesitationEvents"]) {
  assert.equal(Object.hasOwn(versionFourAnalysisResult.value, privateField), false);
}
const versionFiveHeatmapResult = Persistence.sanitizeResult({
  schemaVersion: 5,
  id: "version-five-heatmap",
  completedAt: "2026-08-23T17:00:00.000Z",
  language: "en",
  keyTimingStats: [{
    character: "e", opportunities: 8, firstAttemptErrors: 2, totalErrors: 3,
    timedAttempts: 4, totalIntervalMs: 1000, averageIntervalMs: 250,
    maxIntervalMs: 400, speedCpm: 240
  }],
  keyTimingEvents: [{ character: "e", intervalMs: 250 }],
  typedText: "must not persist"
});
assert.equal(versionFiveHeatmapResult.value.schemaVersion, 5);
assert.equal(versionFiveHeatmapResult.value.keyTimingStats.length, 1);
assert.equal(versionFiveHeatmapResult.value.keyTimingStats[0].character, "e");
assert.equal(versionFiveHeatmapResult.value.keyTimingStats[0].opportunities, 8);
assert.equal(versionFiveHeatmapResult.value.keyTimingStats[0].averageIntervalMs, 250);
assert.equal(versionFiveHeatmapResult.value.keyTimingStats[0].speedCpm, 240);
for (const privateField of ["typedText", "keyTimingEvents"]) {
  assert.equal(Object.hasOwn(versionFiveHeatmapResult.value, privateField), false);
}
const mixedHistory = Persistence.parseHistory([
  JSON.stringify(parsedHistory.rows[0]),
  JSON.stringify(versionTwoResult.value)
].join("\n"));
assert.equal(mixedHistory.rows.length, 2);
assert.equal(mixedHistory.rows.some(row => row.schemaVersion === 1), true);
assert.equal(mixedHistory.rows.some(row => row.schemaVersion === 2), true);
const preservedHistory = Persistence.serializeHistory(parsedHistory.rows, parsedHistory.rejectedLines);
assert.match(preservedHistory, /^not-json$/mu);
assert.match(preservedHistory, /^null$/mu);
const reparsedHistory = Persistence.parseHistory(preservedHistory);
assert.equal(reparsedHistory.rows.length, 1);
assert.equal(reparsedHistory.rejectedLines.length, 3);

const repeatedBuild = PassageLoader.buildTest([
  { id: "a", language: "en", category: "common", difficulty: 1, text: "First distinct passage." },
  { id: "b", language: "en", category: "common", difficulty: 1, text: "Second distinct passage." }
], "en", "common", 1, 300, () => 0.25);
assert.equal(repeatedBuild.text.length >= 300, true);
assert.equal(repeatedBuild.passageIds.length > 2, true);
assert.equal(new Set(repeatedBuild.passageIds.slice(0, 2)).size, 2);
for (let index = 1; index < repeatedBuild.passageIds.length; index++) {
  assert.notEqual(repeatedBuild.passageIds[index], repeatedBuild.passageIds[index - 1]);
}
const completionPassages = [
  { id: "short-a", language: "en", category: "common", difficulty: 1, text: "one two three four five six" },
  { id: "short-b", language: "en", category: "common", difficulty: 1, text: "seven eight nine ten eleven twelve" }
];
for (const targetWordCount of [10, 25, 50, 100]) {
  const wordBuild = PassageLoader.buildWordTest(completionPassages, "en", "common", 1, targetWordCount, () => 0.25);
  assert.equal(wordBuild.text.trim().split(/\s+/u).length, targetWordCount);
  assert.equal(wordBuild.wordCount, targetWordCount);
}
const passageBuild = PassageLoader.buildPassageTest(completionPassages, "en", "common", 1, () => 0.999);
assert.equal(passageBuild.text, completionPassages[0].text);
assert.deepEqual(Array.from(passageBuild.passageIds), ["short-a"]);
const persianWordBuild = PassageLoader.buildWordTest([
  { id: "fa-words", language: "fa", category: "common", difficulty: 1, text: "یک دو سه چهار پنج شش هفت هشت نه ده" }
], "fa", "common", 1, 10);
assert.equal(persianWordBuild.text.split(/\s+/u).length, 10);
for (const targetWordCount of [10, 25, 50, 100]) {
  const parsiCompletionBuild = PassageLoader.buildWordTest([
    { id: "fa-session-a", language: "fa", category: "common", difficulty: 1, text: "یک دو سه چهار پنج شش" },
    { id: "fa-session-b", language: "fa", category: "common", difficulty: 1, text: "هفت هشت نه ده یازده دوازده" }
  ], "fa", "common", 1, targetWordCount, () => 0.25);
  assert.equal(parsiCompletionBuild.text.trim().split(/\s+/u).length, targetWordCount);
  assert.equal(parsiCompletionBuild.wordCount, targetWordCount);
}
const parsiPassageBuild = PassageLoader.buildPassageTest([
  { id: "fa-passage-a", language: "fa", category: "literature", difficulty: 2, text: "شب آرامی بود و شهر در سکوت نفس می‌کشید." },
  { id: "fa-passage-b", language: "fa", category: "literature", difficulty: 2, text: "باران روی پنجره می‌بارید." }
], "fa", "literature", 2, () => 0.999);
assert.equal(parsiPassageBuild.text, "شب آرامی بود و شهر در سکوت نفس می‌کشید.");
assert.deepEqual(Array.from(parsiPassageBuild.passageIds), ["fa-passage-a"]);
const retrySources = [
  { id: "retry-a", language: "en", category: "common", difficulty: 1, text: "First  passage keeps its spacing." },
  { id: "retry-b", language: "en", category: "common", difficulty: 1, text: "Second passage follows exactly." }
];
const timedRetry = PassageLoader.buildRetryTest(retrySources, ["retry-b", "retry-a", "retry-b"], "timed", 0);
assert.equal(timedRetry.available, true);
assert.equal(timedRetry.text, "Second passage follows exactly. First  passage keeps its spacing. Second passage follows exactly.");
assert.deepEqual(Array.from(timedRetry.passageIds), ["retry-b", "retry-a", "retry-b"]);
const wordRetryIds = ["retry-a", "retry-b", "retry-a", "retry-b", "retry-a", "retry-b"];
const wordRetry = PassageLoader.buildRetryTest(retrySources, wordRetryIds, "words", 25);
assert.equal(wordRetry.available, true);
assert.equal(wordRetry.text.split(/\s+/u).length, 25);
assert.deepEqual(Array.from(wordRetry.passageIds), wordRetryIds);
const passageRetry = PassageLoader.buildRetryTest(retrySources, ["retry-b"], "passage", 0);
assert.equal(passageRetry.text, retrySources[1].text);
assert.deepEqual(Array.from(passageRetry.passageIds), ["retry-b"]);
const removedImportRetry = PassageLoader.buildRetryTest(retrySources, ["custom-en-removed-1"], "passage", 0);
assert.equal(removedImportRetry.available, false);
assert.deepEqual(Array.from(removedImportRetry.missingPassageIds), ["custom-en-removed-1"]);
assert.equal(PassageLoader.buildRetryTest(retrySources, [], "timed", 0).available, false);
const freshPassageA = PassageLoader.buildPassageTest(retrySources, "en", "common", 1, () => 0);
const freshPassageB = PassageLoader.buildPassageTest(retrySources, "en", "common", 1, () => 0.999999);
assert.notEqual(freshPassageA.passageIds[0], freshPassageB.passageIds[0],
  "new passage with the same settings must still perform a fresh selection");
const parsiRetrySources = [
  { id: "retry-fa-a", language: "fa", category: "common", difficulty: 1, text: "یک دو سه چهار پنج شش هفت هشت نه ده" },
  { id: "retry-fa-b", language: "fa", category: "common", difficulty: 1, text: "یازده دوازده سیزده چهارده پانزده شانزده هفده هجده نوزده بیست" }
];
const parsiTimedRetry = PassageLoader.buildRetryTest(parsiRetrySources, ["retry-fa-b", "retry-fa-a"], "timed", 0);
assert.equal(parsiTimedRetry.available, true);
assert.equal(parsiTimedRetry.text, `${parsiRetrySources[1].text} ${parsiRetrySources[0].text}`);
assert.deepEqual(Array.from(parsiTimedRetry.passageIds), ["retry-fa-b", "retry-fa-a"]);
const parsiWordRetry = PassageLoader.buildRetryTest(parsiRetrySources, ["retry-fa-a", "retry-fa-b"], "words", 10);
assert.equal(parsiWordRetry.available, true);
assert.equal(parsiWordRetry.text, parsiRetrySources[0].text);
const parsiPassageRetry = PassageLoader.buildRetryTest(parsiRetrySources, ["retry-fa-b"], "passage", 0);
assert.equal(parsiPassageRetry.text, parsiRetrySources[1].text);
assert.deepEqual(Array.from(parsiPassageRetry.passageIds), ["retry-fa-b"]);
const partialMissingParsiRetry = PassageLoader.buildRetryTest(parsiRetrySources,
  ["retry-fa-a", "removed-fa-import"], "timed", 0);
assert.equal(partialMissingParsiRetry.available, false);
assert.equal(partialMissingParsiRetry.text, "");
assert.deepEqual(Array.from(partialMissingParsiRetry.missingPassageIds), ["removed-fa-import"]);

function adaptiveResult(id, language, character, opportunities, errors, passageIds = []) {
  return {
    schemaVersion: 2,
    id,
    completedAt: `2026-08-${String(20 - Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T12:00:00.000Z`,
    language,
    mode: "standard",
    passageIds,
    characterStats: [{ character, opportunities, firstAttemptErrors: errors, totalErrors: errors }],
    difficultCharacters: [],
    substitutions: [],
    wpmSamples: []
  };
}

const adaptiveHistory = [
  adaptiveResult("en-1", "en", "e", 20, 6, ["recent"]),
  adaptiveResult("en-2", "en", "e", 20, 5),
  adaptiveResult("en-3", "en", "e", 20, 4),
  adaptiveResult("fa-1", "fa", "ش", 20, 8),
  adaptiveResult("fa-2", "fa", "ش", 20, 7),
  adaptiveResult("fa-3", "fa", "ش", 20, 6)
];
const englishTargets = AdaptivePractice.rankTargets(adaptiveHistory, "en", defaultSettings);
assert.equal(englishTargets.available, true);
assert.deepEqual(Array.from(englishTargets.characters), ["e"]);
assert.equal(englishTargets.analyzedTests, 3);
const parsiTargets = AdaptivePractice.rankTargets(adaptiveHistory, "fa", defaultSettings);
assert.deepEqual(Array.from(parsiTargets.characters), ["ش"]);
const insufficientTargets = AdaptivePractice.rankTargets(adaptiveHistory.slice(0, 2), "en", defaultSettings);
assert.equal(insufficientTargets.available, false);
assert.match(insufficientTargets.reason, /at least three/u);
assert.equal(AdaptivePractice.rankTargets([null, { language: "en", characterStats: [null] }], "en", null).available, false);

const stableTies = AdaptivePractice.rankTargets([
  { ...adaptiveResult("tie-1", "en", "e", 10, 4), characterStats: [
    { character: "r", opportunities: 10, firstAttemptErrors: 4, totalErrors: 4 },
    { character: "e", opportunities: 10, firstAttemptErrors: 4, totalErrors: 4 }
  ] },
  { ...adaptiveResult("tie-2", "en", "e", 10, 4), characterStats: [
    { character: "r", opportunities: 10, firstAttemptErrors: 4, totalErrors: 4 },
    { character: "e", opportunities: 10, firstAttemptErrors: 4, totalErrors: 4 }
  ] },
  { ...adaptiveResult("tie-3", "en", "e", 10, 4), characterStats: [
    { character: "r", opportunities: 10, firstAttemptErrors: 4, totalErrors: 4 },
    { character: "e", opportunities: 10, firstAttemptErrors: 4, totalErrors: 4 }
  ] }
], "en", defaultSettings);
assert.deepEqual(Array.from(stableTies.characters), ["e", "r"]);

const correctedWindow = [];
for (let index = 0; index < 10; index++) correctedWindow.push(adaptiveResult(`clean-${index}`, "en", "e", 20, 0));
correctedWindow.push(adaptiveResult("old-error", "en", "e", 20, 10));
assert.equal(AdaptivePractice.rankTargets(correctedWindow, "en", defaultSettings).targets.length, 0);
const recencyRanking = AdaptivePractice.rankTargets([
  { ...adaptiveResult("recent-a", "en", "e", 20, 6), characterStats: [{ character: "e", opportunities: 20, firstAttemptErrors: 6, totalErrors: 6 }] },
  { ...adaptiveResult("middle-a", "en", "e", 20, 6), characterStats: [{ character: "e", opportunities: 20, firstAttemptErrors: 6, totalErrors: 6 }] },
  { ...adaptiveResult("old-a", "en", "r", 20, 6), characterStats: [{ character: "r", opportunities: 20, firstAttemptErrors: 6, totalErrors: 6 }] }
], "en", defaultSettings);
assert.equal(recencyRanking.characters[0], "e");

const adaptiveBuild = AdaptivePractice.buildAdaptiveTest([
  { id: "recent", language: "en", category: "common", text: "eeee target passage with repeated examples" },
  { id: "fresh", language: "en", category: "literature", text: "Every evening the evergreen trees rested." },
  { id: "programming", language: "en", category: "programming", text: "eeee should not enter the prose pool" }
], "en", ["e"], 300, ["recent"]);
assert.equal(adaptiveBuild.passageIds[0], "fresh");
assert.equal(adaptiveBuild.passageIds.includes("programming"), false);
for (let index = 1; index < adaptiveBuild.passageIds.length; index++) {
  assert.notEqual(adaptiveBuild.passageIds[index], adaptiveBuild.passageIds[index - 1]);
}
assert.equal(AdaptivePractice.buildAdaptiveTest([], "en", ["e"], 300, []).text, "");
const adaptiveWordBuild = AdaptivePractice.buildAdaptiveWordTest([
  { id: "adaptive-a", language: "en", category: "common", text: "every eager example encourages even effort" },
  { id: "adaptive-b", language: "en", category: "literature", text: "evening settles gently over evergreen trees" }
], "en", ["e"], 25, []);
assert.equal(adaptiveWordBuild.text.split(/\s+/u).length, 25);
assert.equal(adaptiveWordBuild.wordCount, 25);
const aggregateAdaptiveHistory = [0, 1, 2].map(index => ({
  id: `aggregate-${index}`,
  language: "en",
  completedAt: `2026-08-${20 - index}T12:00:00.000Z`,
  characterStats: [],
  difficultBigrams: [{ bigram: "qu", opportunities: 4, firstAttemptErrors: 2, totalErrors: 2 }],
  difficultWords: [{ word: "quiet", opportunities: 2, errorOccurrences: 1, totalErrors: 1 }],
  hesitationStats: [{ character: "q", count: 2, totalDelayMs: 3000, averageDelayMs: 1500, maxDelayMs: 1700 }]
}));
const aggregateTargets = AdaptivePractice.rankTargets(aggregateAdaptiveHistory, "en", defaultSettings);
assert.equal(aggregateTargets.available, true);
assert.deepEqual(Array.from(aggregateTargets.bigrams), ["qu"]);
assert.deepEqual(Array.from(aggregateTargets.words), ["quiet"]);
assert.deepEqual(Array.from(aggregateTargets.hesitationCharacters), ["q"]);
const aggregateAdaptiveBuild = AdaptivePractice.buildAdaptiveTest([
  { id: "low-pattern", language: "en", category: "common", text: "Simple words appear in this ordinary sentence." },
  { id: "high-pattern", language: "en", category: "literature", text: "The quiet queen quickly questioned the quiet crowd." }
], "en", [], 300, [], {
  bigrams: aggregateTargets.bigrams,
  words: aggregateTargets.words,
  hesitationCharacters: aggregateTargets.hesitationCharacters,
  settings: defaultSettings
});
assert.equal(aggregateAdaptiveBuild.passageIds[0], "high-pattern");
const parsiAggregateHistory = [0, 1, 2].map(index => ({
  id: `fa-aggregate-${index}`,
  language: "fa",
  completedAt: `2026-08-${17 - index}T12:00:00.000Z`,
  characterStats: [],
  difficultBigrams: [{ bigram: "شب", opportunities: 4, firstAttemptErrors: 2, totalErrors: 2 }],
  difficultWords: [{ word: "شب", opportunities: 2, errorOccurrences: 1, totalErrors: 1 }],
  hesitationStats: [{ character: "ش", count: 2, totalDelayMs: 3200, averageDelayMs: 1600, maxDelayMs: 1800 }]
}));
const parsiAggregateTargets = AdaptivePractice.rankTargets(parsiAggregateHistory, "fa", defaultSettings);
assert.equal(parsiAggregateTargets.available, true);
assert.deepEqual(Array.from(parsiAggregateTargets.bigrams), ["شب"]);
assert.deepEqual(Array.from(parsiAggregateTargets.words), ["شب"]);
assert.deepEqual(Array.from(parsiAggregateTargets.hesitationCharacters), ["ش"]);
const parsiAggregateBuild = AdaptivePractice.buildAdaptiveTest([
  { id: "fa-low-pattern", language: "fa", category: "common", text: "روز روشن و آرامی در شهر آغاز شد." },
  { id: "fa-high-pattern", language: "fa", category: "literature", text: "شب آرام بود و شبنم شبانه روی شیشه نشست." }
], "fa", [], 300, [], {
  bigrams: parsiAggregateTargets.bigrams,
  words: parsiAggregateTargets.words,
  hesitationCharacters: parsiAggregateTargets.hesitationCharacters,
  settings: defaultSettings
});
assert.equal(parsiAggregateBuild.passageIds[0], "fa-high-pattern");

const progressNewest = [];
for (let index = 10; index >= 1; index--) {
  progressNewest.push({
    ...adaptiveResult(`progress-${index}`, "en", "e", 20, index % 3),
    completedAt: `2026-08-${String(index).padStart(2, "0")}T12:00:00.000Z`,
    netWpm: index * 10,
    accuracy: 90 + index / 10,
    consistency: 80 + index,
    correctKeystrokes: 100,
    incorrectKeystrokes: index
  });
}
const progressSeven = Progress.filterHistory(progressNewest, "en", "7-tests");
assert.equal(progressSeven.length, 7);
assert.equal(progressSeven[0].id, "progress-4");
assert.equal(progressSeven[6].id, "progress-10");
const scopedProgress = [
  { ...progressNewest[0], id: "scope-match", testType: "timed", configuredDurationSeconds: 60, mode: "standard", category: "common", difficulty: "1" },
  { ...progressNewest[1], id: "scope-duration", testType: "timed", configuredDurationSeconds: 180, mode: "standard", category: "common", difficulty: "1" },
  { ...progressNewest[2], id: "scope-mode", testType: "timed", configuredDurationSeconds: 60, mode: "adaptive", category: "mixed", difficulty: "mixed" },
  { ...progressNewest[3], id: "scope-category", testType: "timed", configuredDurationSeconds: 60, mode: "standard", category: "literature", difficulty: "1" },
  { ...progressNewest[4], id: "scope-difficulty", testType: "timed", configuredDurationSeconds: 60, mode: "standard", category: "common", difficulty: "3" },
  { ...progressNewest[5], id: "scope-words", testType: "words", targetWordCount: 25, configuredDurationSeconds: 0, mode: "standard", category: "common", difficulty: "1" },
  { ...progressNewest[6], id: "scope-passage", testType: "passage", configuredDurationSeconds: 0, mode: "standard", category: "common", difficulty: "1" }
];
const exactScope = Progress.filterHistory(scopedProgress, "en", "all", {
  testType: "timed",
  durationSeconds: "60",
  mode: "standard",
  category: "common",
  difficulty: "1"
});
assert.deepEqual(Array.from(exactScope, row => row.id), ["scope-match"]);
assert.equal(Progress.filterHistory(scopedProgress, "en", "all", {
  testType: "all", durationSeconds: "all", targetWordCount: "all", mode: "all", category: "all", difficulty: "all"
}).length, 7);
assert.deepEqual(Array.from(Progress.durationOptions(scopedProgress, "en", 300), row => row.value), ["all", "60", "180", "300"]);
assert.deepEqual(Array.from(Progress.wordCountOptions(scopedProgress, "en", 50), row => row.value), ["all", "25", "50"]);
assert.deepEqual(Array.from(Progress.filterHistory(scopedProgress, "en", "all", {
  testType: "words", durationSeconds: "all", targetWordCount: "25", mode: "standard", category: "common", difficulty: "1"
}), row => row.id), ["scope-words"]);
const scopedComparison = Progress.comparisonContext(exactScope, "en", "30-tests", {
  testType: "timed",
  durationSeconds: "60",
  mode: "standard",
  category: "common",
  difficulty: "1"
});
assert.equal(scopedComparison.label, "English · 1 min · Standard · Common · Easy · Last 30 tests");
assert.equal(scopedComparison.count, 1);
assert.equal(scopedComparison.bestWpm, 100);
assert.equal(Progress.comparisonContext([], "fa", "all", {
  testType: "all", durationSeconds: "all", targetWordCount: "all", mode: "all", category: "all", difficulty: "all"
}).label, "Parsi · All test formats · All modes · All content · All difficulties · All history");
assert.equal(Progress.comparisonContext([], "en", "all", {
  testType: "words", targetWordCount: "25", mode: "standard", category: "all", difficulty: "all"
}).label, "English · 25 words · Standard · All content · All difficulties · All history");
const progressSummary = Progress.summary(progressSeven);
assert.equal(progressSummary.count, 7);
assert.equal(progressSummary.currentWpm, 90);
assert.equal(progressSummary.wpmChange, 30);
assert.equal(progressSummary.bestWpm, 100);
const manyPoints = Array.from({ length: 1000 }, (_, index) => ({ value: index }));
const sampledPoints = Progress.downsample(manyPoints, 120);
assert.equal(sampledPoints.length, 120);
assert.equal(sampledPoints[0].value, 0);
assert.equal(sampledPoints.at(-1).value, 999);
const progressCharacters = Progress.characters(progressSeven);
assert.equal(progressCharacters[0].character, "e");
assert.equal(Progress.characterTrend(progressSeven, "e", 120).length, 7);
assert.deepEqual(Array.from(Progress.filterHistory(null, "en", "all")), []);
assert.equal(Progress.summary(null).count, 0);
const parsiScopedProgress = [
  { id: "fa-scope-match", completedAt: "2026-08-20T12:00:00.000Z", language: "fa", testType: "timed", configuredDurationSeconds: 60, mode: "standard", category: "formal", difficulty: "2", netWpm: 48 },
  { id: "fa-scope-duration", completedAt: "2026-08-19T12:00:00.000Z", language: "fa", testType: "timed", configuredDurationSeconds: 180, mode: "standard", category: "formal", difficulty: "2", netWpm: 52 },
  { id: "fa-scope-mode", completedAt: "2026-08-18T12:00:00.000Z", language: "fa", testType: "timed", configuredDurationSeconds: 60, mode: "adaptive", category: "formal", difficulty: "2", netWpm: 50 },
  { id: "fa-scope-category", completedAt: "2026-08-17T12:00:00.000Z", language: "fa", testType: "timed", configuredDurationSeconds: 60, mode: "standard", category: "literature", difficulty: "2", netWpm: 51 },
  { id: "fa-scope-difficulty", completedAt: "2026-08-16T12:00:00.000Z", language: "fa", testType: "timed", configuredDurationSeconds: 60, mode: "standard", category: "formal", difficulty: "3", netWpm: 53 },
  { id: "en-not-parsi", completedAt: "2026-08-21T12:00:00.000Z", language: "en", testType: "timed", configuredDurationSeconds: 60, mode: "standard", category: "formal", difficulty: "2", netWpm: 99 }
];
const exactParsiScope = Progress.filterHistory(parsiScopedProgress, "fa", "all", {
  testType: "timed", durationSeconds: "60", mode: "standard", category: "formal", difficulty: "2"
});
assert.deepEqual(Array.from(exactParsiScope, row => row.id), ["fa-scope-match"]);
const exactParsiComparison = Progress.comparisonContext(exactParsiScope, "fa", "all", {
  testType: "timed", durationSeconds: "60", mode: "standard", category: "formal", difficulty: "2"
});
assert.equal(exactParsiComparison.label, "Parsi · 1 min · Standard · Formal · Medium · All history");
assert.equal(exactParsiComparison.bestWpm, 48);
const dataStoreScopeContext = vm.createContext({ history: parsiScopedProgress });
for (const functionName of ["matchesScope", "best", "averageAccuracy"]) {
  vm.runInContext(qmlFunctionSource("DataStore.qml", functionName), dataStoreScopeContext);
}
const parsiPersonalBest = vm.runInContext(`best("fa", {
  testType: "timed", durationSeconds: 60, mode: "standard", category: "formal", difficulty: "2"
})`, dataStoreScopeContext);
assert.equal(parsiPersonalBest, 48);
const excludedEnglishBest = vm.runInContext(`best("en", {
  testType: "timed", durationSeconds: 60, mode: "standard", category: "formal", difficulty: "2"
})`, dataStoreScopeContext);
assert.equal(excludedEnglishBest, 99);

const englishLayout = KeyboardHeatmap.layout("en");
assert.equal(englishLayout.length, 3);
assert.equal(englishLayout[0][0].character, "q");
assert.equal(englishLayout[0][0].finger, "left-pinky");
assert.equal(englishLayout[1].some(key => key.character === "j" && key.finger === "right-index"), true);
const persianLayout = KeyboardHeatmap.layout("fa");
assert.equal(persianLayout.length, 3);
assert.equal(persianLayout[0][0].character, "ض");
assert.equal(persianLayout[1].some(key => key.character === "ی" && key.finger === "left-middle"), true);
const englishHeatmap = KeyboardHeatmap.aggregate([
  {
    language: "en",
    keyTimingStats: [
      { character: "e", opportunities: 8, firstAttemptErrors: 2, totalErrors: 2, timedAttempts: 4, totalIntervalMs: 1000 },
      { character: "E", opportunities: 2, firstAttemptErrors: 1, totalErrors: 1, timedAttempts: 1, totalIntervalMs: 500 },
      { character: "q", opportunities: 5, firstAttemptErrors: 4, totalErrors: 4, timedAttempts: 5, totalIntervalMs: 2500 }
    ]
  },
  {
    language: "fa",
    keyTimingStats: [{ character: "ی", opportunities: 99, firstAttemptErrors: 99, timedAttempts: 1, totalIntervalMs: 5000 }]
  },
  {
    language: "en",
    characterStats: [{ character: "x", opportunities: 6, firstAttemptErrors: 2, totalErrors: 3 }]
  }
], "en");
const eHeat = englishHeatmap.keys.find(key => key.character === "e");
assert.equal(eHeat.opportunities, 10);
assert.equal(eHeat.speedCpm, 200);
assert.equal(eHeat.errorRate, 0.3);
assert.equal(englishHeatmap.keys.find(key => key.character === "x").opportunities, 6);
assert.equal(englishHeatmap.keys.find(key => key.character === "x").timedAttempts, 0);
assert.equal(englishHeatmap.keys.find(key => key.character === "ی"), undefined);
assert.equal(KeyboardHeatmap.weakestTargets(englishHeatmap)[0], "q");
assert.deepEqual(Array.from(KeyboardHeatmap.targetsForKey(englishHeatmap, "e")), ["e"]);
assert.deepEqual(Array.from(KeyboardHeatmap.targetsForKey(englishHeatmap, "ی")), []);
assert.equal(KeyboardHeatmap.targetsForHand(englishHeatmap, "left").every(character =>
  englishHeatmap.keys.find(key => key.character === character).hand === "left"), true);
assert.equal(KeyboardHeatmap.targetsForFinger(englishHeatmap, "left-middle").every(character =>
  englishHeatmap.keys.find(key => key.character === character).finger === "left-middle"), true);
assert.equal(KeyboardHeatmap.targetsForHand(englishHeatmap, "left").length,
  englishHeatmap.keys.filter(key => key.hand === "left").length);
assert.equal(KeyboardHeatmap.targetsForFinger(englishHeatmap, "left-index").length,
  englishHeatmap.keys.filter(key => key.finger === "left-index").length);
assert.equal(KeyboardHeatmap.weakestTargets(englishHeatmap).length <= 5, true);
assert.equal(KeyboardHeatmap.weakestTargets(KeyboardHeatmap.aggregate([], "en")).length, 0);
const parsiHeatmap = KeyboardHeatmap.aggregate([{
  language: "fa",
  keyTimingStats: [
    { character: "ش", opportunities: 12, firstAttemptErrors: 5, totalErrors: 6, timedAttempts: 6, totalIntervalMs: 3600 },
    { character: "ی", opportunities: 20, firstAttemptErrors: 2, totalErrors: 2, timedAttempts: 10, totalIntervalMs: 4000 },
    { character: "م", opportunities: 10, firstAttemptErrors: 1, totalErrors: 1, timedAttempts: 5, totalIntervalMs: 1500 }
  ]
}], "fa");
const sheenHeat = parsiHeatmap.keys.find(key => key.character === "ش");
assert.equal(sheenHeat.opportunities, 12);
assert.equal(sheenHeat.errorRate, 5 / 12);
assert.equal(sheenHeat.speedCpm, 100);
assert.equal(KeyboardHeatmap.weakestTargets(parsiHeatmap)[0], "ش");
assert.deepEqual(Array.from(KeyboardHeatmap.targetsForKey(parsiHeatmap, "ش")), ["ش"]);
assert.deepEqual(Array.from(KeyboardHeatmap.targetsForKey(parsiHeatmap, "e")), []);
assert.equal(KeyboardHeatmap.targetsForHand(parsiHeatmap, "right").every(character =>
  parsiHeatmap.keys.find(key => key.character === character).hand === "right"), true);
assert.equal(KeyboardHeatmap.targetsForFinger(parsiHeatmap, "left-middle").every(character =>
  parsiHeatmap.keys.find(key => key.character === character).finger === "left-middle"), true);
assert.equal(KeyboardHeatmap.targetsForHand(parsiHeatmap, "right").length,
  parsiHeatmap.keys.filter(key => key.hand === "right").length);

const coachingResult = {
  ...progressNewest[0],
  id: "coaching-current",
  netWpm: 100,
  accuracy: 98,
  backspaces: 1,
  substitutions: [{ expected: "e", actual: "r", count: 3 }],
  wpmSamples: [{ grossWpm: 80 }, { grossWpm: 82 }, { grossWpm: 78 }, { grossWpm: 77 }]
};
const coachingHistory = [coachingResult,
  { ...progressNewest[1], configuredDurationSeconds: coachingResult.configuredDurationSeconds },
  { ...progressNewest[2], configuredDurationSeconds: coachingResult.configuredDurationSeconds },
  { ...progressNewest[3], configuredDurationSeconds: coachingResult.configuredDurationSeconds }
];
const coaching = Coaching.summarize(coachingResult, coachingHistory, englishTargets);
assert.equal(coaching.baselineCount, 3);
assert.equal(coaching.baselineReady, true);
assert.equal(coaching.messages.length <= 3, true);
assert.equal(coaching.messages[0].kind, "substitution");
assert.equal(coaching.messages.some(message => message.kind === "accuracy"), true);
assert.equal(coaching.recommendation.mode, "adaptive");
const wordCoachingResult = { ...coachingResult, id: "word-coaching", testType: "words", targetWordCount: 25, configuredDurationSeconds: 0 };
const wordCoaching = Coaching.summarize(wordCoachingResult, [
  wordCoachingResult,
  { ...coachingHistory[1], id: "same-word-count", testType: "words", targetWordCount: 25, configuredDurationSeconds: 0 },
  { ...coachingHistory[2], id: "wrong-word-count", testType: "words", targetWordCount: 50, configuredDurationSeconds: 0 },
  { ...coachingHistory[3], id: "wrong-test-type", testType: "timed", targetWordCount: 0, configuredDurationSeconds: 60 }
], englishTargets);
assert.equal(wordCoaching.baselineCount, 1);
assert.equal(wordCoaching.recommendation.testType, "words");
assert.equal(wordCoaching.recommendation.targetWordCount, 25);
assert.match(wordCoaching.recommendation.text, /25-word adaptive/u);
const aggregateCoaching = Coaching.summarize({
  ...coachingResult,
  id: "aggregate-coaching",
  difficultWords: [{ word: "quiet", opportunities: 3, errorOccurrences: 2, totalErrors: 2, errorRate: 2 / 3 }],
  difficultBigrams: [{ bigram: "qu", opportunities: 4, firstAttemptErrors: 2, totalErrors: 2, errorRate: 0.5 }],
  hesitationStats: [{ character: "q", count: 2, averageDelayMs: 1500, totalDelayMs: 3000, maxDelayMs: 1700 }]
}, [], aggregateTargets);
assert.equal(aggregateCoaching.messages[0].kind, "difficult-word");
assert.match(aggregateCoaching.messages[0].text, /quiet/u);
assert.match(aggregateCoaching.recommendation.text, /qu|quiet|q/u);
assert.equal(Coaching.comparableBaseline({
  id: "strict-current", language: "en", configuredDurationSeconds: 60, mode: "standard"
}, [
  { id: "same", language: "en", configuredDurationSeconds: 60, mode: "standard" },
  { id: "wrong-duration", language: "en", configuredDurationSeconds: 180, mode: "standard" },
  { id: "wrong-mode", language: "en", configuredDurationSeconds: 60, mode: "adaptive" }
]).length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(Coaching.summarize(null, [null], null))), {
  messages: [], baselineCount: 0, recommendation: null
});
const coachingWithoutHistory = Coaching.summarize({
  ...coachingResult,
  id: "alone",
  substitutions: [],
  backspaces: 0,
  wpmSamples: []
}, [], { available: false });
assert.equal(coachingWithoutHistory.baselineReady, false);
assert.equal(coachingWithoutHistory.messages.length, 1);
assert.equal(coachingWithoutHistory.messages[0].kind, "recommendation");
const adaptiveCoachingCurrent = {
  ...coachingResult,
  id: "adaptive-current",
  mode: "adaptive",
  adaptiveTargets: ["e"],
  characterStats: [{ character: "e", opportunities: 12, firstAttemptErrors: 0, totalErrors: 0 }],
  substitutions: [],
  backspaces: 0,
  wpmSamples: []
};
const adaptiveCoachingHistory = [adaptiveCoachingCurrent,
  { ...progressNewest[1], mode: "adaptive", configuredDurationSeconds: adaptiveCoachingCurrent.configuredDurationSeconds, characterStats: [{ character: "e", opportunities: 12, firstAttemptErrors: 5, totalErrors: 5 }] },
  { ...progressNewest[2], mode: "adaptive", configuredDurationSeconds: adaptiveCoachingCurrent.configuredDurationSeconds, characterStats: [{ character: "e", opportunities: 12, firstAttemptErrors: 4, totalErrors: 4 }] },
  { ...progressNewest[3], mode: "adaptive", configuredDurationSeconds: adaptiveCoachingCurrent.configuredDurationSeconds, characterStats: [{ character: "e", opportunities: 12, firstAttemptErrors: 4, totalErrors: 4 }] }
];
const adaptiveCoaching = Coaching.summarize(adaptiveCoachingCurrent, adaptiveCoachingHistory, englishTargets);
assert.equal(adaptiveCoaching.messages.some(message => message.kind === "adaptive-target" && message.positive), true);

const largeHistory = [];
for (let index = 0; index < 10_000; index++) {
  largeHistory.push({
    id: `large-${index}`,
    completedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    language: "en",
    netWpm: index % 120,
    accuracy: 90,
    consistency: 85,
    correctKeystrokes: 100,
    incorrectKeystrokes: 5,
    characterStats: []
  });
}
const largeRows = Progress.filterHistory(largeHistory, "en", "all");
assert.equal(largeRows.length, 10_000);
assert.equal(Progress.metricPoints(largeRows, "netWpm", 120).length, 120);

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.id, "leomoon-studios.omarchy-typing-test");
assert.equal(manifest.version, "0.9.0");
assert.deepEqual(manifest.kinds, ["bar-widget", "panel"]);
for (const entryPoint of Object.values(manifest.entryPoints)) {
  assert.equal(fs.existsSync(path.join(root, entryPoint)), true, `missing entry point ${entryPoint}`);
}

const bundledFontPath = path.join(root, "assets/fonts/Vazirmatn-Regular.ttf");
const bundledFont = fs.readFileSync(bundledFontPath);
assert.equal(bundledFont.length > 100_000, true, "bundled Vazirmatn font is unexpectedly small");
assert.equal(bundledFont.readUInt32BE(0), 0x00010000, "bundled Vazirmatn asset is not a TrueType font");
assert.equal(fs.existsSync(path.join(root, "assets/fonts/OFL.txt")), true, "missing Vazirmatn OFL license");
assert.equal(fs.existsSync(path.join(root, "assets/fonts/AUTHORS.txt")), true, "missing Vazirmatn author list");
for (const entryPoint of ["BarWidget.qml", "StatsPopover.qml", "TypingTestPanel.qml"]) {
  const source = fs.readFileSync(path.join(root, entryPoint), "utf8");
  assert.match(source, /FontLoader\s*\{/u, `${entryPoint} must load the bundled font`);
  assert.match(source, /assets\/fonts\/Vazirmatn-Regular\.ttf/u, `${entryPoint} must use Vazirmatn`);
}
const barWidgetSource = fs.readFileSync(path.join(root, "BarWidget.qml"), "utf8");
assert.doesNotMatch(barWidgetSource, /showLatestWpm|latestWpmText/u, "bar widget must remain icon-only");
assert.match(barWidgetSource, /text:\s*"WPM"/u, "bar widget must use the WPM monogram");
assert.match(barWidgetSource, /id:\s*badge/u, "WPM monogram must retain its badge outline");
assert.equal(manifest.barWidget.schema, undefined, "icon-only widget should not expose obsolete settings");
const dataStoreSource = fs.readFileSync(path.join(root, "DataStore.qml"), "utf8");
assert.match(dataStoreSource, /onSaveFailed/u, "persistence writes must surface failures");
assert.doesNotMatch(dataStoreSource, /FileView\s*\{/u, "persistent data must not use unbounded FileView reads");
assert.doesNotMatch(dataStoreSource, /\bstat\b/u, "imports must not use a check-then-open stat process");
assert.match(dataStoreSource, /history-backup\.jsonl/u, "destructive history changes must create a backup");
assert.match(dataStoreSource, /history-recovery\.jsonl/u, "malformed history must create a recovery snapshot");
assert.match(dataStoreSource, /customEnglishText\s*=\s*updated/u, "English imports must update the active passage library immediately");
assert.match(dataStoreSource, /customPersianText\s*=\s*updated/u, "Parsi imports must update the active passage library immediately");
assert.match(dataStoreSource, /ImportSafety\.prepare\(raw,/u,
  "imports must pass through the bounded parser before creating passage records");
assert.match(dataStoreSource, /ImportSafety\.validateCollection\(collection\)/u,
  "collection names must be validated before opening the file picker");
assert.doesNotMatch(dataStoreSource, /split\(\/\\n\\s\*\\n/u,
  "imports must not eagerly split an attacker-controlled text file into an unbounded array");
assert.match(dataStoreSource, /onSaved:\s*root\.completeImport\("en"\)/u,
  "English imports must report success only after their custom-text file is saved");
assert.match(dataStoreSource, /onSaved:\s*root\.completeImport\("fa"\)/u,
  "Parsi imports must report success only after their custom-text file is saved");
assert.match(dataStoreSource, /pendingImportPreviousText/u,
  "failed imported-text saves must retain enough state to roll back the active library");
assert.match(dataStoreSource, /function matchesScope/u, "personal-best and accuracy queries must support comparison scopes");
const safeFileSource = fs.readFileSync(path.join(root, "scripts", "safe-file.py"), "utf8");
assert.match(safeFileSource, /O_NOFOLLOW/u, "safe file reads must reject symlink swaps");
assert.match(safeFileSource, /os\.fstat\(fd\)/u, "safe file reads must inspect the opened descriptor");
assert.match(safeFileSource, /MAX_BYTES/u, "safe file reads must enforce a byte limit");
assert.match(safeFileSource, /read\(maximum_bytes \+ 1\)/u, "safe file writes must use a bounded read");
const safeFileTests = spawnSync("python3", [path.join(root, "tests", "test-safe-file.py")], { encoding: "utf8" });
assert.equal(safeFileTests.status, 0, safeFileTests.stderr || "safe-file tests failed");
const safeFileQmlSource = fs.readFileSync(path.join(root, "SafeFile.qml"), "utf8");
assert.match(safeFileQmlSource, /write\(root\.pendingText\)[\s\S]*?stdinEnabled\s*=\s*false/u,
  "safe writes must close stdin after queuing the complete payload");
assert.match(safeFileQmlSource, /property bool hasQueuedWrite/u, "safe writes must retain a pending update");
assert.match(safeFileQmlSource, /queuedText\s*=\s*nextText/u, "safe writes must coalesce to the latest pending value");
assert.match(safeFileQmlSource, /continueQueuedWrite\(\)/u, "queued safe writes must continue after the active write exits");
const passageLibrarySource = fs.readFileSync(path.join(root, "PassageLibrary.qml"), "utf8");
assert.match(passageLibrarySource, /failedCount === 0/u, "corpus readiness must reject failed collections");
const panelSource = fs.readFileSync(path.join(root, "TypingTestPanel.qml"), "utf8");
assert.match(panelSource, /"progress"/u, "panel must route to the Progress view");
assert.match(panelSource, /startAdaptive/u, "panel must support adaptive recommendations");
assert.match(panelSource, /function comparisonForResult/u, "result pages must receive a comparison context");
assert.match(panelSource, /onResultRequested:\s*function\(result, comparison\)/u, "Progress-to-result navigation must preserve comparison context");
assert.match(panelSource, /function retrySamePassage/u, "results must support exact passage retries");
assert.match(panelSource, /function newPassageSameSettings/u, "results must support random repeats with unchanged settings");
assert.match(panelSource, /currentResult\.passageIds/u, "exact retry must use the completed result's saved passage IDs");
assert.match(panelSource, /function startDrill/u, "Progress heatmap actions must launch targeted drills");
assert.match(panelSource, /adaptiveTargets:\s*characters/u, "heatmap drills must feed selected keys into adaptive passage selection");
const testViewSource = fs.readFileSync(path.join(root, "components", "TestView.qml"), "utf8");
assert.match(testViewSource, /schemaVersion:\s*5/u, "new results must use schema version 5");
assert.match(testViewSource, /testType:\s*options\.testType/u, "new results must identify their test format");
assert.match(testViewSource, /options\.testType === "timed" && root\.remainingSeconds <= 0/u, "only timed tests may finish from the countdown");
assert.match(testViewSource, /Metrics\.characterStats/u, "new results must store safe character aggregates");
assert.match(testViewSource, /sourceValue\.replace\(\/\\u200c\/g/u, "typing input must remove ignored ZWNJs before positional comparison");
assert.match(testViewSource, /PassageLoader\.buildRetryTest/u, "typing tests must reconstruct exact retries before random selection");
assert.match(testViewSource, /saved passage is no longer available/u, "missing retry sources must display a fallback notice");
assert.match(testViewSource, /hesitationThresholdMs:\s*1000/u, "typing tests must use an explicit long-pause threshold");
assert.match(testViewSource, /Metrics\.difficultBigrams/u, "new results must aggregate difficult character pairs");
assert.match(testViewSource, /Metrics\.difficultWords/u, "new results must aggregate difficult words");
assert.match(testViewSource, /Metrics\.hesitationStats/u, "new results must aggregate long inter-key pauses");
assert.match(testViewSource, /Metrics\.keyTimingStats/u, "new results must aggregate per-key speed and errors");
const resultsViewSource = fs.readFileSync(path.join(root, "components", "ResultsView.qml"), "utf8");
assert.match(resultsViewSource, /if \(option === "1"\) return "EASY"/u, "results must label numeric difficulty values");
assert.match(resultsViewSource, /if \(character === " "\) return "Space"/u, "results must label whitespace substitutions");
assert.match(resultsViewSource, /text:\s*"PROGRESS COMPARISON"/u, "results must identify their active comparison group");
assert.match(resultsViewSource, /Scoped PB/u, "results must display the scoped personal best");
assert.match(resultsViewSource, /text:\s*"Retry same passage"/u, "results must label exact retries explicitly");
assert.match(resultsViewSource, /text:\s*"New passage, same settings"/u, "results must keep random repeat as a separate action");
assert.doesNotMatch(resultsViewSource, /text:\s*"Repeat"/u, "results must not retain the ambiguous Repeat action");
assert.match(resultsViewSource, /text:\s*"DEEP ANALYSIS"/u, "results must display bigram, word, and hesitation analysis");
const historyViewSource = fs.readFileSync(path.join(root, "components", "HistoryView.qml"), "utf8");
assert.match(historyViewSource, /if \(text === "1"\) return "Easy"/u, "history must label numeric difficulty values");
assert.match(historyViewSource, /if \(testType === "passage"\) return "PASSAGE"/u, "history must label passage-completion results");
const progressViewSource = fs.readFileSync(path.join(root, "components", "ProgressView.qml"), "utf8");
assert.match(progressViewSource, /text:\s*"ACTIVE COMPARISON"/u, "Progress must identify the active comparison group");
assert.match(progressViewSource, /contextLabel:\s*root\.comparison\.label/u, "Progress charts must carry the active comparison label");
assert.match(progressViewSource, /initialComparison:\s*null/u, "Progress must be able to restore its comparison filters");
assert.match(progressViewSource, /KeyboardHeatmap\s*\{/u, "Progress must display the bilingual keyboard heatmap");
assert.match(progressViewSource, /rows:\s*root\.rows/u, "the heatmap must use the active filtered comparison rows");
assert.match(progressViewSource, /onDrillRequested/u, "Progress must forward keyboard drill actions");
assert.equal(progressViewSource.indexOf("id: progressHeader") < progressViewSource.indexOf("id: progressScroll"), true,
  "Progress header must remain outside and above its scroll area");
assert.equal(progressViewSource.indexOf("id: progressScroll") < progressViewSource.indexOf("id: progressFooter"), true,
  "Progress footer must remain outside and below its scroll area");
assert.match(progressViewSource, /id:\s*progressScroll[\s\S]*?Layout\.fillHeight:\s*true/u,
  "Progress must give the middle scroll area the available height");
const keyboardHeatmapSource = fs.readFileSync(path.join(root, "components", "KeyboardHeatmap.qml"), "utf8");
assert.match(keyboardHeatmapSource, /CPM/u, "heatmap keys must display per-key speed");
assert.match(keyboardHeatmapSource, /tries/u, "heatmap keys must display opportunity counts");
assert.match(keyboardHeatmapSource, /% err/u, "heatmap keys must display error rate");
assert.match(keyboardHeatmapSource, /targetsForHand/u, "heatmap must support hand drills");
assert.match(keyboardHeatmapSource, /targetsForKey/u, "heatmap must support individual-key drills");
assert.match(keyboardHeatmapSource, /targetsForFinger/u, "heatmap must support finger drills");
assert.match(keyboardHeatmapSource, /weakestTargets/u, "heatmap must support weak-key drills");
assert.match(keyboardHeatmapSource, /uniformCellWidths:\s*true/u,
  "heatmap drill controls must use equal-width columns");
assert.match(keyboardHeatmapSource, /showLabel:\s*false/u,
  "the finger selector must not add a second vertical label row");
const setupViewSource = fs.readFileSync(path.join(root, "components", "SetupView.qml"), "utf8");
for (const format of ["timed", "words", "passage"]) {
  assert.match(setupViewSource, new RegExp(`chooseTestType\\("${format}"\\)`, "u"), `setup must expose ${format} tests`);
}
assert.match(setupViewSource, /model:\s*\[10, 25, 50, 100\]/u, "setup must expose 10, 25, 50, and 100-word tests");
const settingsViewSource = fs.readFileSync(path.join(root, "components", "SettingsView.qml"), "utf8");
assert.equal(settingsViewSource.indexOf("id: settingsHeader") < settingsViewSource.indexOf("id: settingsScroll"), true,
  "Settings header must remain outside and above its scroll area");
assert.equal(settingsViewSource.indexOf("id: settingsScroll") < settingsViewSource.indexOf("id: settingsFooter"), true,
  "Settings footer must remain outside and below its scroll area");
assert.match(settingsViewSource, /id:\s*settingsScroll[\s\S]*?Layout\.fillHeight:\s*true/u,
  "Settings must give the middle scroll area the available height");
assert.match(settingsViewSource,
  /id:\s*importCollectionField[\s\S]*?verticalPadding:\s*0[\s\S]*?verticalAlignment:\s*TextInput\.AlignVCenter[\s\S]*?Layout\.preferredHeight:\s*root\.importControlHeight/u,
  "the imported collection field must center its text without increasing the shared control height");
const resultsViewLayoutSource = fs.readFileSync(path.join(root, "components", "ResultsView.qml"), "utf8");
assert.equal(resultsViewLayoutSource.indexOf("id: resultsHeader") < resultsViewLayoutSource.indexOf("id: resultsScroll"), true,
  "Results header must remain outside and above its scroll area");
assert.equal(resultsViewLayoutSource.indexOf("id: resultsScroll") < resultsViewLayoutSource.indexOf("id: resultsFooter"), true,
  "Results footer must remain outside and below its scroll area");
assert.match(resultsViewLayoutSource, /id:\s*resultsScroll[\s\S]*?Layout\.fillHeight:\s*true/u,
  "Results must give the middle scroll area the available height");
assert.match(resultsViewLayoutSource,
  /rightPadding:\s*resultsContent\.implicitHeight\s*>\s*height\s*\+\s*0\.5[\s\S]*?ScrollBar\.vertical\.width\s*\+\s*Style\.spacing\.sm/u,
  "Results must reserve a gutter for its vertical scrollbar when content overflows");
assert.match(dataStoreSource, /readonly property bool importPickerActive:\s*picker\.running/u,
  "DataStore must expose the import picker lifecycle to the overlay");
assert.match(panelSource, /visible:\s*root\.opened\s*&&\s*!dataStore\.importPickerActive/u,
  "the overlay must hide while the desktop file chooser is active");
assert.match(panelSource, /WlrLayershell\.keyboardFocus:\s*panel\.visible\s*\?/u,
  "the overlay must release exclusive keyboard focus while hidden for the file chooser");
for (const component of ["SetupView.qml", "TestView.qml", "ResultsView.qml", "HistoryView.qml", "SettingsView.qml", "MetricCard.qml", "ProgressView.qml", "ProgressChart.qml", "CoachingSummary.qml", "KeyboardHeatmap.qml"]) {
  const source = fs.readFileSync(path.join(root, "components", component), "utf8");
  assert.doesNotMatch(source, /font\.family:\s*Style\.font\.family/u, `${component} bypasses the bundled font`);
}

const corpusFiles = [
  ["texts/en/common.jsonl", "en", "common"],
  ["texts/en/literature.jsonl", "en", "literature"],
  ["texts/en/programming.jsonl", "en", "programming"],
  ["texts/en/punctuation.jsonl", "en", "punctuation"],
  ["texts/fa/common.jsonl", "fa", "common"],
  ["texts/fa/formal.jsonl", "fa", "formal"],
  ["texts/fa/literature.jsonl", "fa", "literature"],
  ["texts/fa/punctuation.jsonl", "fa", "punctuation"]
];
const ids = new Set();
const normalizedTexts = new Set();
const languageCounts = { en: 0, fa: 0 };
const textsByLanguage = { en: [], fa: [] };

function normalizedTokens(value) {
  return new Set(value.toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\u200c]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean));
}

function jaccard(left, right) {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection / new Set([...left, ...right]).size;
}

for (const [relativePath, expectedLanguage, expectedCategory] of corpusFiles) {
  const rows = PassageLoader.parseJsonLines(fs.readFileSync(path.join(root, relativePath), "utf8"));
  assert.equal(rows.length, 50, `${relativePath} should contain 50 passages`);
  const difficultyCounts = { 1: 0, 2: 0, 3: 0 };
  let punctuationRichCount = 0;
  for (const row of rows) {
    assert.equal(ids.has(row.id), false, `duplicate passage id ${row.id}`);
    ids.add(row.id);
    assert.match(row.id, new RegExp(`^${expectedLanguage}-${expectedCategory}-\\d{3}$`));
    assert.equal(row.language, expectedLanguage, `${row.id} language must match its file`);
    assert.equal(row.category, expectedCategory, `${row.id} category must match its file`);
    assert.equal(Number.isInteger(row.difficulty) && row.difficulty >= 1 && row.difficulty <= 3, true, `${row.id} has invalid difficulty`);
    difficultyCounts[row.difficulty]++;
    languageCounts[row.language]++;
    assert.equal(row.source, "LeoMoon Studios CC0 corpus v2");
    assert.equal(row.license, "CC0-1.0");
    assert.equal(row.text, row.text.trim(), `${row.id} has outer whitespace`);
    assert.equal(row.text, row.text.normalize("NFC"), `${row.id} is not NFC-normalized`);
    assert.equal(Array.from(row.text).length >= 40 && Array.from(row.text).length <= 180, true, `${row.id} has unsuitable length`);
    assert.doesNotMatch(row.text, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/u, `${row.id} contains invalid controls`);
    assert.doesNotMatch(row.text, /[\u202a-\u202e\u2066-\u2069]/u, `${row.id} contains explicit bidi controls`);
    assert.doesNotMatch(row.text, /[\ufb50-\ufdff\ufe70-\ufeff]/u, `${row.id} contains Arabic presentation forms`);
    assert.doesNotMatch(row.text, /[ \t]{2,}/u, `${row.id} contains repeated horizontal whitespace`);
    assert.doesNotMatch(row.text, /[ \t]+[,.!?;:،؛؟](?=\s|$)/u, `${row.id} has whitespace before punctuation`);

    const normalizedText = row.text.normalize("NFC").toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
    assert.equal(normalizedTexts.has(normalizedText), false, `${row.id} duplicates another passage`);
    normalizedTexts.add(normalizedText);

    const letters = row.text.match(/\p{L}/gu) || [];
    const expectedScript = row.text.match(expectedLanguage === "en" ? /\p{Script=Latin}/gu : /\p{Script=Arabic}/gu) || [];
    const minimumScriptRatio = expectedCategory === "punctuation" && expectedLanguage === "fa" ? 0.45 : 0.85;
    assert.equal(expectedScript.length / letters.length >= minimumScriptRatio, true, `${row.id} does not match its declared language`);
    if (expectedLanguage === "fa") assert.doesNotMatch(row.text, /[يك]/u, `${row.id} uses Arabic-form yeh or kaf`);
    if (expectedCategory === "punctuation") {
      assert.match(row.text, /\p{N}/u, `${row.id} needs numeric practice`);
      if (/["',:;!?%()[\]{}\/=#@+×÷±°،؛؟٪«»–-]/u.test(row.text)) punctuationRichCount++;
    }
    textsByLanguage[expectedLanguage].push({ id: row.id, tokens: normalizedTokens(row.text) });
  }
  assert.equal(Object.values(difficultyCounts).every(count => count >= 15), true, `${relativePath} has an uneven difficulty distribution`);
  if (expectedCategory === "punctuation") {
    assert.equal(punctuationRichCount >= 35, true, `${relativePath} needs broader punctuation coverage`);
  }
}
assert.deepEqual(languageCounts, { en: 200, fa: 200 });

for (const [language, rows] of Object.entries(textsByLanguage)) {
  for (let left = 0; left < rows.length; left++) {
    for (let right = left + 1; right < rows.length; right++) {
      assert.equal(jaccard(rows[left].tokens, rows[right].tokens) < 0.55, true,
        `${rows[left].id} and ${rows[right].id} are near duplicates in ${language}`);
    }
  }
}

console.log("All typing-test logic and corpus checks passed.");
