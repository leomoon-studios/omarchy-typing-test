import assert from "node:assert/strict";
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

const Normalization = qmlLibrary("js/Normalization.js");
const Metrics = qmlLibrary("js/Metrics.js", { Normalization });
const PassageLoader = qmlLibrary("js/PassageLoader.js");
const Pagination = qmlLibrary("js/Pagination.js");
const Persistence = qmlLibrary("js/Persistence.js");
const AdaptivePractice = qmlLibrary("js/AdaptivePractice.js", { Normalization });
const Coaching = qmlLibrary("js/Coaching.js");
const Progress = qmlLibrary("js/Progress.js");
const KeyboardNavigation = qmlLibrary("js/KeyboardNavigation.js");

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

const oneMinute = Metrics.calculate(250, 245, 5, 60, 42);
assert.equal(oneMinute.grossWpm, 50);
assert.equal(oneMinute.netWpm, 49);
assert.equal(oneMinute.literalWpm, 42);
assert.equal(oneMinute.accuracy, 98);
assert.equal(Metrics.consistency([{ grossWpm: 50 }, { grossWpm: 50 }, { grossWpm: 50 }]), 100);
assert.equal(Metrics.consistency([{ grossWpm: 50 }, { grossWpm: 52 }]), null);
assert.equal(JSON.stringify(Metrics.evaluateFinal("یک", "يك", { persianNormalization: "forgiving" })), JSON.stringify({ correct: 2, incorrect: 0, entered: 2 }));

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

const parsed = PassageLoader.parseJsonLines('{"id":"one","language":"en","text":"Hello"}\nnot-json\n{"id":"empty","language":"en","text":"   "}\n{"id":"two","language":"fa","text":"سلام"}\n');
assert.equal(parsed.length, 2);
assert.equal(PassageLoader.filter(parsed, "fa", "mixed", "mixed").length, 1);

const defaultSettings = {
  schemaVersion: 2,
  defaultLanguage: "en",
  defaultDurationSeconds: 60,
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
  defaultDurationSeconds: -10,
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
assert.equal(repairedSettings.value.defaultDurationSeconds, 15);
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
  { ...progressNewest[1], characterStats: [{ character: "e", opportunities: 12, firstAttemptErrors: 5, totalErrors: 5 }] },
  { ...progressNewest[2], characterStats: [{ character: "e", opportunities: 12, firstAttemptErrors: 4, totalErrors: 4 }] },
  { ...progressNewest[3], characterStats: [{ character: "e", opportunities: 12, firstAttemptErrors: 4, totalErrors: 4 }] }
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
assert.equal(manifest.version, "0.2.2");
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
const safeFileSource = fs.readFileSync(path.join(root, "scripts", "safe-file.py"), "utf8");
assert.match(safeFileSource, /O_NOFOLLOW/u, "safe file reads must reject symlink swaps");
assert.match(safeFileSource, /os\.fstat\(fd\)/u, "safe file reads must inspect the opened descriptor");
assert.match(safeFileSource, /MAX_BYTES/u, "safe file reads must enforce a byte limit");
const passageLibrarySource = fs.readFileSync(path.join(root, "PassageLibrary.qml"), "utf8");
assert.match(passageLibrarySource, /failedCount === 0/u, "corpus readiness must reject failed collections");
const panelSource = fs.readFileSync(path.join(root, "TypingTestPanel.qml"), "utf8");
assert.match(panelSource, /"progress"/u, "panel must route to the Progress view");
assert.match(panelSource, /startAdaptive/u, "panel must support adaptive recommendations");
const testViewSource = fs.readFileSync(path.join(root, "components", "TestView.qml"), "utf8");
assert.match(testViewSource, /schemaVersion:\s*2/u, "new results must use schema version 2");
assert.match(testViewSource, /Metrics\.characterStats/u, "new results must store safe character aggregates");
for (const component of ["SetupView.qml", "TestView.qml", "ResultsView.qml", "HistoryView.qml", "SettingsView.qml", "MetricCard.qml", "ProgressView.qml", "ProgressChart.qml", "CoachingSummary.qml"]) {
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
