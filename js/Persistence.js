.pragma library

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function cleanString(value, fallback) {
  if (value === undefined || value === null) return fallback
  var text = String(value).trim()
  return text || fallback
}

function isFiniteNumberValue(value) {
  if (value === undefined || value === null || typeof value === "boolean") return false
  if (typeof value === "string" && !value.trim()) return false
  return isFinite(Number(value))
}

function finiteNumber(value, fallback, minimum, maximum) {
  if (!isFiniteNumberValue(value)) return fallback
  var number = Number(value)
  if (minimum !== undefined) number = Math.max(minimum, number)
  if (maximum !== undefined) number = Math.min(maximum, number)
  return number
}

function finiteInteger(value, fallback, minimum, maximum) {
  return Math.round(finiteNumber(value, fallback, minimum, maximum))
}

function enumValue(value, allowed, fallback) {
  var candidate = String(value === undefined || value === null ? "" : value)
  return allowed.indexOf(candidate) >= 0 ? candidate : fallback
}

function booleanValue(value, fallback) {
  return typeof value === "boolean" ? value : fallback
}

function sanitizeSettings(value, defaults) {
  var base = isObject(defaults) ? defaults : {}
  var input = isObject(value) ? value : {}
  var issues = []
  if (!isObject(value)) issues.push("settings must be an object")

  function checkedEnum(name, allowed) {
    var fallback = base[name]
    var result = enumValue(input[name], allowed, fallback)
    if (input[name] !== undefined && String(input[name]) !== String(result)) issues.push(name)
    return result
  }

  function checkedBoolean(name) {
    var fallback = base[name]
    var result = booleanValue(input[name], fallback)
    if (input[name] !== undefined && typeof input[name] !== "boolean") issues.push(name)
    return result
  }

  var duration = finiteInteger(input.defaultDurationSeconds, base.defaultDurationSeconds, 15, 3600)
  if (input.defaultDurationSeconds !== undefined && (!isFiniteNumberValue(input.defaultDurationSeconds) || Number(input.defaultDurationSeconds) !== duration)) issues.push("defaultDurationSeconds")
  var adaptiveWindow = finiteInteger(input.adaptiveHistoryWindow, base.adaptiveHistoryWindow, 5, 50)
  if (input.adaptiveHistoryWindow !== undefined && (!isFiniteNumberValue(input.adaptiveHistoryWindow) || Number(input.adaptiveHistoryWindow) !== adaptiveWindow)) issues.push("adaptiveHistoryWindow")

  return {
    value: {
      schemaVersion: 2,
      defaultLanguage: checkedEnum("defaultLanguage", ["en", "fa"]),
      defaultDurationSeconds: duration,
      defaultCategory: checkedEnum("defaultCategory", ["common", "literature", "programming", "punctuation", "formal", "difficult", "custom", "mixed"]),
      defaultDifficulty: checkedEnum("defaultDifficulty", ["mixed", "1", "2", "3"]),
      showLiveWpm: checkedBoolean("showLiveWpm"),
      showLiveAccuracy: checkedBoolean("showLiveAccuracy"),
      persianNormalization: checkedEnum("persianNormalization", ["forgiving", "strict"]),
      digitNormalization: checkedEnum("digitNormalization", ["exact", "persian-arabic", "all"]),
      zwnjCountsAsError: checkedBoolean("zwnjCountsAsError"),
      includeCorrectedErrorsInDifficulty: checkedBoolean("includeCorrectedErrorsInDifficulty"),
      adaptiveHistoryWindow: adaptiveWindow,
      progressRange: checkedEnum("progressRange", ["7-tests", "30-tests", "all"]),
      coachingEnabled: checkedBoolean("coachingEnabled")
    },
    issues: issues
  }
}

function parseSettings(raw, defaults) {
  var source = String(raw || "")
  try {
    var sanitized = sanitizeSettings(JSON.parse(source || "{}"), defaults)
    return {
      value: sanitized.value,
      issues: sanitized.issues,
      invalidJson: false
    }
  } catch (error) {
    return {
      value: sanitizeSettings({}, defaults).value,
      issues: ["settings JSON is invalid"],
      invalidJson: true
    }
  }
}

function sanitizeResult(value) {
  if (!isObject(value)) return { value: null, issues: ["record must be an object"] }

  var issues = []
  var id = cleanString(value.id, "")
  var completedAt = cleanString(value.completedAt, "")
  if (!id) return { value: null, issues: ["record id is missing"] }
  if (!completedAt || !isFinite(Date.parse(completedAt))) return { value: null, issues: ["completion date is invalid"] }

  function numberField(name, fallback, minimum, maximum) {
    var result = finiteNumber(value[name], fallback, minimum, maximum)
    if (value[name] !== undefined && (!isFiniteNumberValue(value[name]) || Number(value[name]) !== result)) issues.push(name)
    return result
  }

  function integerField(name, fallback) {
    var result = finiteInteger(value[name], fallback, 0)
    if (value[name] !== undefined && (!isFiniteNumberValue(value[name]) || Number(value[name]) !== result)) issues.push(name)
    return result
  }

  var language = enumValue(value.language, ["en", "fa"], "en")
  if (value.language !== undefined && value.language !== language) issues.push("language")
  var declaredSchema = finiteInteger(value.schemaVersion, 1, 1, 2)
  if (value.schemaVersion !== undefined && (!isFiniteNumberValue(value.schemaVersion) || Number(value.schemaVersion) !== declaredSchema)) issues.push("schemaVersion")
  var schemaVersion = declaredSchema >= 2 ? 2 : 1
  var mode = enumValue(value.mode, ["standard", "adaptive"], "standard")
  if (value.mode !== undefined && value.mode !== mode) issues.push("mode")

  var passageIds = []
  if (value.passageIds !== undefined && !Array.isArray(value.passageIds)) issues.push("passageIds")
  var sourceIds = Array.isArray(value.passageIds) ? value.passageIds : []
  for (var passageIndex = 0; passageIndex < sourceIds.length; passageIndex++) {
    if (sourceIds[passageIndex] === null || sourceIds[passageIndex] === undefined) { issues.push("passageIds[" + passageIndex + "]"); continue }
    var passageId = cleanString(sourceIds[passageIndex], "")
    if (passageId) passageIds.push(passageId)
  }

  var difficultCharacters = []
  if (value.difficultCharacters !== undefined && !Array.isArray(value.difficultCharacters)) issues.push("difficultCharacters")
  var difficultSource = Array.isArray(value.difficultCharacters) ? value.difficultCharacters : []
  for (var difficultIndex = 0; difficultIndex < difficultSource.length; difficultIndex++) {
    var difficult = difficultSource[difficultIndex]
    if (!isObject(difficult)) { issues.push("difficultCharacters[" + difficultIndex + "]"); continue }
    var character = cleanString(difficult.character, "")
    if (!character) { issues.push("difficultCharacters[" + difficultIndex + "].character"); continue }
    var opportunities = finiteInteger(difficult.opportunities, 0, 0)
    var firstAttemptErrors = finiteInteger(difficult.firstAttemptErrors, 0, 0)
    var totalErrors = finiteInteger(difficult.totalErrors, firstAttemptErrors, 0)
    var derivedRate = opportunities > 0 ? firstAttemptErrors / opportunities : 0
    var errorRate = finiteNumber(difficult.errorRate, derivedRate, 0, 1)
    if (difficult.opportunities !== undefined && (!isFiniteNumberValue(difficult.opportunities) || Number(difficult.opportunities) !== opportunities)) issues.push("difficultCharacters[" + difficultIndex + "].opportunities")
    if (difficult.firstAttemptErrors !== undefined && (!isFiniteNumberValue(difficult.firstAttemptErrors) || Number(difficult.firstAttemptErrors) !== firstAttemptErrors)) issues.push("difficultCharacters[" + difficultIndex + "].firstAttemptErrors")
    if (difficult.totalErrors !== undefined && (!isFiniteNumberValue(difficult.totalErrors) || Number(difficult.totalErrors) !== totalErrors)) issues.push("difficultCharacters[" + difficultIndex + "].totalErrors")
    if (difficult.errorRate !== undefined && (!isFiniteNumberValue(difficult.errorRate) || Number(difficult.errorRate) !== errorRate)) issues.push("difficultCharacters[" + difficultIndex + "].errorRate")
    difficultCharacters.push({
      character: character,
      opportunities: opportunities,
      firstAttemptErrors: firstAttemptErrors,
      totalErrors: totalErrors,
      errorRate: errorRate,
      mostCommonSubstitution: cleanString(difficult.mostCommonSubstitution, "")
    })
  }

  var adaptiveTargets = []
  if (value.adaptiveTargets !== undefined && !Array.isArray(value.adaptiveTargets)) issues.push("adaptiveTargets")
  var targetSource = Array.isArray(value.adaptiveTargets) ? value.adaptiveTargets : []
  if (targetSource.length > 5) issues.push("adaptiveTargets.length")
  for (var targetIndex = 0; targetIndex < targetSource.length && adaptiveTargets.length < 5; targetIndex++) {
    var targetCharacter = cleanString(targetSource[targetIndex], "")
    if (!targetCharacter || /\s/.test(targetCharacter)) {
      issues.push("adaptiveTargets[" + targetIndex + "]")
      continue
    }
    if (adaptiveTargets.indexOf(targetCharacter) < 0) adaptiveTargets.push(targetCharacter)
  }

  var characterStats = []
  if (value.characterStats !== undefined && !Array.isArray(value.characterStats)) issues.push("characterStats")
  var characterSource = Array.isArray(value.characterStats) ? value.characterStats : []
  if (characterSource.length > 256) issues.push("characterStats.length")
  for (var characterIndex = 0; characterIndex < characterSource.length && characterStats.length < 256; characterIndex++) {
    var characterStat = characterSource[characterIndex]
    if (!isObject(characterStat)) { issues.push("characterStats[" + characterIndex + "]"); continue }
    var statCharacter = cleanString(characterStat.character, "")
    if (!statCharacter || /\s/.test(statCharacter)) { issues.push("characterStats[" + characterIndex + "].character"); continue }
    var statOpportunities = finiteInteger(characterStat.opportunities, 0, 0)
    var statFirstErrors = finiteInteger(characterStat.firstAttemptErrors, 0, 0, statOpportunities)
    var statTotalErrors = finiteInteger(characterStat.totalErrors, statFirstErrors, statFirstErrors)
    if (characterStat.opportunities !== undefined && (!isFiniteNumberValue(characterStat.opportunities) || Number(characterStat.opportunities) !== statOpportunities)) issues.push("characterStats[" + characterIndex + "].opportunities")
    if (characterStat.firstAttemptErrors !== undefined && (!isFiniteNumberValue(characterStat.firstAttemptErrors) || Number(characterStat.firstAttemptErrors) !== statFirstErrors)) issues.push("characterStats[" + characterIndex + "].firstAttemptErrors")
    if (characterStat.totalErrors !== undefined && (!isFiniteNumberValue(characterStat.totalErrors) || Number(characterStat.totalErrors) !== statTotalErrors)) issues.push("characterStats[" + characterIndex + "].totalErrors")
    characterStats.push({
      character: statCharacter,
      opportunities: statOpportunities,
      firstAttemptErrors: statFirstErrors,
      totalErrors: statTotalErrors
    })
  }

  var substitutions = []
  if (value.substitutions !== undefined && !Array.isArray(value.substitutions)) issues.push("substitutions")
  var substitutionSource = Array.isArray(value.substitutions) ? value.substitutions : []
  for (var substitutionIndex = 0; substitutionIndex < substitutionSource.length; substitutionIndex++) {
    var substitution = substitutionSource[substitutionIndex]
    if (!isObject(substitution)) { issues.push("substitutions[" + substitutionIndex + "]"); continue }
    // Empty expected/actual values are meaningful: they represent an extra or
    // missing keystroke. Preserve whitespace too, since it can be the key that
    // was mistyped.
    var expected = substitution.expected === undefined || substitution.expected === null ? "" : String(substitution.expected)
    var actual = substitution.actual === undefined || substitution.actual === null ? "" : String(substitution.actual)
    if (!expected && !actual) { issues.push("substitutions[" + substitutionIndex + "]"); continue }
    var count = finiteInteger(substitution.count, 1, 1)
    if (substitution.count !== undefined && (!isFiniteNumberValue(substitution.count) || Number(substitution.count) !== count)) issues.push("substitutions[" + substitutionIndex + "].count")
    substitutions.push({
      expected: expected,
      actual: actual,
      count: count
    })
  }

  var wpmSamples = []
  if (value.wpmSamples !== undefined && !Array.isArray(value.wpmSamples)) issues.push("wpmSamples")
  var sampleSource = Array.isArray(value.wpmSamples) ? value.wpmSamples : []
  for (var sampleIndex = 0; sampleIndex < sampleSource.length; sampleIndex++) {
    var sample = sampleSource[sampleIndex]
    if (!isObject(sample) || !isFiniteNumberValue(sample.elapsedSeconds) || !isFiniteNumberValue(sample.grossWpm)) {
      issues.push("wpmSamples[" + sampleIndex + "]")
      continue
    }
    wpmSamples.push({
      elapsedSeconds: finiteNumber(sample.elapsedSeconds, 0, 0),
      grossWpm: finiteNumber(sample.grossWpm, 0, 0)
    })
  }

  var consistency = value.consistency === null || value.consistency === undefined
    ? null
    : numberField("consistency", null, 0, 100)

  return {
    value: {
      schemaVersion: schemaVersion,
      id: id,
      startedAt: cleanString(value.startedAt, completedAt),
      completedAt: completedAt,
      language: language,
      mode: mode,
      durationSeconds: numberField("durationSeconds", 0, 0),
      configuredDurationSeconds: numberField("configuredDurationSeconds", 60, 15, 3600),
      category: cleanString(value.category, "common"),
      difficulty: cleanString(value.difficulty, "mixed"),
      grossWpm: numberField("grossWpm", 0, 0),
      netWpm: numberField("netWpm", 0, 0),
      literalWpm: numberField("literalWpm", 0, 0),
      accuracy: numberField("accuracy", 0, 0, 100),
      consistency: consistency,
      correctKeystrokes: integerField("correctKeystrokes", 0),
      incorrectKeystrokes: integerField("incorrectKeystrokes", 0),
      correctedErrors: integerField("correctedErrors", 0),
      uncorrectedErrors: integerField("uncorrectedErrors", 0),
      backspaces: integerField("backspaces", 0),
      passageIds: passageIds,
      adaptiveTargets: adaptiveTargets,
      characterStats: characterStats,
      difficultCharacters: difficultCharacters,
      substitutions: substitutions,
      wpmSamples: wpmSamples
    },
    issues: issues
  }
}

function parseHistory(raw) {
  var rows = []
  var rejectedLines = []
  var repairedCount = 0
  var lines = String(raw || "").split(/\r?\n/)

  for (var index = 0; index < lines.length; index++) {
    var original = lines[index]
    var line = original.trim()
    if (!line) continue
    try {
      var parsed = JSON.parse(line)
      var sanitized = sanitizeResult(parsed)
      if (!sanitized.value) {
        rejectedLines.push(original)
        continue
      }
      if (sanitized.issues.length > 0) repairedCount++
      rows.push(sanitized.value)
    } catch (error) {
      rejectedLines.push(original)
    }
  }

  rows.sort(function(a, b) { return String(b.completedAt).localeCompare(String(a.completedAt)) })
  return { rows: rows, rejectedLines: rejectedLines, repairedCount: repairedCount }
}

function serializeHistory(rows, rejectedLines) {
  var lines = []
  var safeRows = Array.isArray(rows) ? rows : []
  for (var index = 0; index < safeRows.length; index++) {
    var sanitized = sanitizeResult(safeRows[index])
    if (sanitized.value) lines.push(JSON.stringify(sanitized.value))
  }
  var rejected = Array.isArray(rejectedLines) ? rejectedLines : []
  for (var rejectedIndex = 0; rejectedIndex < rejected.length; rejectedIndex++) {
    var rawLine = String(rejected[rejectedIndex] || "")
    if (rawLine.trim()) lines.push(rawLine)
  }
  return lines.length ? lines.join("\n") + "\n" : ""
}
