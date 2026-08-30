.pragma library

function finiteNumber(value, fallback) {
  if (value === undefined || value === null || typeof value === "boolean") return fallback
  if (typeof value === "string" && !value.trim()) return fallback
  var number = Number(value)
  return isFinite(number) ? number : fallback
}

function average(rows, field) {
  var total = 0
  var count = 0
  var source = Array.isArray(rows) ? rows : []
  for (var index = 0; index < source.length; index++) {
    var row = source[index]
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    var value = row[field]
    if (value === null || value === undefined || !isFinite(Number(value))) continue
    total += Number(value)
    count++
  }
  return count > 0 ? total / count : null
}

function matchesFilters(row, filters) {
  if (!row) return false
  var selected = filters || {}
  var rowTestType = String(row.testType || "timed")
  var testType = String(selected.testType || "all")
  if (testType !== "all" && rowTestType !== testType) return false
  var duration = selected.durationSeconds
  if (duration !== undefined && duration !== null && String(duration) !== "all"
      && (rowTestType !== "timed" || Number(row.configuredDurationSeconds || 0) !== Number(duration))) return false
  var targetWordCount = selected.targetWordCount
  if (targetWordCount !== undefined && targetWordCount !== null && String(targetWordCount) !== "all"
      && (rowTestType !== "words" || Number(row.targetWordCount || 0) !== Number(targetWordCount))) return false
  var mode = String(selected.mode || "all")
  if (mode !== "all" && String(row.mode || "standard") !== mode) return false
  var category = String(selected.category || "all")
  if (category !== "all" && String(row.category || "common") !== category) return false
  var difficulty = String(selected.difficulty || "all")
  if (difficulty !== "all" && String(row.difficulty || "mixed") !== difficulty) return false
  return true
}

function filterHistory(history, language, range, filters) {
  var selectedLanguage = language === "fa" ? "fa" : "en"
  var newest = []
  var source = Array.isArray(history) ? history : []
  for (var index = 0; index < source.length; index++) {
    if (source[index] && source[index].language === selectedLanguage && matchesFilters(source[index], filters)) newest.push(source[index])
  }
  newest.sort(function(a, b) { return String(b.completedAt || "").localeCompare(String(a.completedAt || "")) })
  var limit = range === "7-tests" ? 7 : range === "all" ? newest.length : 30
  return newest.slice(0, limit).reverse()
}

function durationOptions(history, language, preferredDuration) {
  var selectedLanguage = language === "fa" ? "fa" : "en"
  var values = {}
  var preferred = Math.max(15, Math.round(finiteNumber(preferredDuration, 60)))
  values[preferred] = true
  var source = Array.isArray(history) ? history : []
  for (var index = 0; index < source.length; index++) {
    if (!source[index] || source[index].language !== selectedLanguage || String(source[index].testType || "timed") !== "timed") continue
    var duration = Math.max(15, Math.round(finiteNumber(source[index].configuredDurationSeconds, 60)))
    values[duration] = true
  }
  var durations = Object.keys(values).map(function(value) { return Number(value) })
  durations.sort(function(a, b) { return a - b })
  var result = [{ value: "all", label: "All durations" }]
  for (var durationIndex = 0; durationIndex < durations.length; durationIndex++) {
    var seconds = durations[durationIndex]
    var label = seconds < 60
      ? seconds + " sec"
      : seconds % 60 === 0
        ? (seconds / 60) + " min"
        : Math.floor(seconds / 60) + "m " + (seconds % 60) + "s"
    result.push({ value: String(seconds), label: label })
  }
  return result
}

function wordCountOptions(history, language, preferredWordCount) {
  var selectedLanguage = language === "fa" ? "fa" : "en"
  var values = {}
  var preferred = Math.max(1, Math.round(finiteNumber(preferredWordCount, 25)))
  values[preferred] = true
  var source = Array.isArray(history) ? history : []
  for (var index = 0; index < source.length; index++) {
    if (!source[index] || source[index].language !== selectedLanguage || String(source[index].testType || "timed") !== "words") continue
    var count = Math.max(1, Math.round(finiteNumber(source[index].targetWordCount, 25)))
    values[count] = true
  }
  var counts = Object.keys(values).map(function(value) { return Number(value) })
  counts.sort(function(a, b) { return a - b })
  var result = [{ value: "all", label: "All word counts" }]
  for (var countIndex = 0; countIndex < counts.length; countIndex++) {
    result.push({ value: String(counts[countIndex]), label: counts[countIndex] + " words" })
  }
  return result
}

function comparisonDurationLabel(value) {
  if (value === undefined || value === null || String(value) === "all") return "All durations"
  var seconds = Math.max(15, Math.round(finiteNumber(value, 60)))
  if (seconds < 60) return seconds + " sec"
  if (seconds % 60 === 0) return (seconds / 60) + " min"
  return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s"
}

function comparisonModeLabel(value) {
  var mode = String(value || "all")
  if (mode === "standard") return "Standard"
  if (mode === "adaptive") return "Adaptive"
  return "All modes"
}

function comparisonTestLabel(testType, durationSeconds, targetWordCount) {
  var format = String(testType || "all")
  if (format === "timed") return comparisonDurationLabel(durationSeconds)
  if (format === "words") {
    if (targetWordCount === undefined || targetWordCount === null || String(targetWordCount) === "all") return "All word counts"
    return Math.max(1, Math.round(finiteNumber(targetWordCount, 25))) + " words"
  }
  if (format === "passage") return "Passage completion"
  return "All test formats"
}

function comparisonCategoryLabel(value) {
  var category = String(value || "all")
  var labels = {
    all: "All content",
    common: "Common",
    formal: "Formal",
    literature: "Literature",
    programming: "Programming",
    punctuation: "Numbers & punctuation",
    difficult: "Difficult-character practice",
    custom: "Imported",
    mixed: "Mixed content"
  }
  return labels[category] || category.replace(/[-_]/g, " ")
}

function comparisonDifficultyLabel(value) {
  var difficulty = String(value || "all")
  if (difficulty === "1") return "Easy"
  if (difficulty === "2") return "Medium"
  if (difficulty === "3") return "Hard"
  if (difficulty === "mixed") return "Mixed difficulty"
  return "All difficulties"
}

function comparisonRangeLabel(value) {
  if (value === "7-tests") return "Last 7 tests"
  if (value === "30-tests") return "Last 30 tests"
  return "All history"
}

function comparisonContext(rows, language, range, filters) {
  var selected = filters || {}
  var metrics = summary(rows)
  var selectedTestType = selected.testType
  if (!selectedTestType && selected.targetWordCount !== undefined && String(selected.targetWordCount) !== "all") selectedTestType = "words"
  if (!selectedTestType && selected.durationSeconds !== undefined && String(selected.durationSeconds) !== "all") selectedTestType = "timed"
  var context = {
    language: language === "fa" ? "fa" : "en",
    range: range === "7-tests" || range === "30-tests" ? range : "all",
    testType: String(selectedTestType || "all"),
    durationSeconds: selected.durationSeconds === undefined || selected.durationSeconds === null
      ? "all" : String(selected.durationSeconds),
    targetWordCount: selected.targetWordCount === undefined || selected.targetWordCount === null
      ? "all" : String(selected.targetWordCount),
    mode: String(selected.mode || "all"),
    category: String(selected.category || "all"),
    difficulty: String(selected.difficulty || "all"),
    count: metrics.count,
    bestWpm: metrics.bestWpm
  }
  context.label = [
    context.language === "fa" ? "Parsi" : "English",
    comparisonTestLabel(context.testType, context.durationSeconds, context.targetWordCount),
    comparisonModeLabel(context.mode),
    comparisonCategoryLabel(context.category),
    comparisonDifficultyLabel(context.difficulty),
    comparisonRangeLabel(context.range)
  ].join(" · ")
  return context
}

function errorRate(result) {
  var correct = Math.max(0, finiteNumber(result && result.correctKeystrokes, 0))
  var incorrect = Math.max(0, finiteNumber(result && result.incorrectKeystrokes, 0))
  var total = correct + incorrect
  return total > 0 ? incorrect / total * 100 : 0
}

function points(rows) {
  var result = []
  var source = Array.isArray(rows) ? rows : []
  for (var index = 0; index < source.length; index++) {
    var row = source[index]
    if (!row) continue
    result.push({
      id: String(row.id || ""),
      completedAt: String(row.completedAt || ""),
      label: String(index + 1),
      result: row,
      netWpm: Math.max(0, finiteNumber(row.netWpm, 0)),
      accuracy: Math.max(0, Math.min(100, finiteNumber(row.accuracy, 0))),
      consistency: row.consistency === null || row.consistency === undefined ? null : Math.max(0, Math.min(100, finiteNumber(row.consistency, 0))),
      errorRate: errorRate(row)
    })
  }
  return result
}

function summary(rows) {
  var input = Array.isArray(rows) ? rows : []
  var source = []
  for (var sourceIndex = 0; sourceIndex < input.length; sourceIndex++) {
    if (input[sourceIndex] && typeof input[sourceIndex] === "object" && !Array.isArray(input[sourceIndex])) source.push(input[sourceIndex])
  }
  var recent = source.slice(Math.max(0, source.length - 3))
  var previous = source.slice(Math.max(0, source.length - 6), Math.max(0, source.length - 3))
  var currentWpm = average(recent, "netWpm")
  var previousWpm = previous.length >= 3 ? average(previous, "netWpm") : null
  var bestWpm = null
  for (var index = 0; index < source.length; index++) {
    var value = Math.max(0, finiteNumber(source[index].netWpm, 0))
    if (bestWpm === null || value > bestWpm) bestWpm = value
  }
  return {
    count: source.length,
    currentWpm: currentWpm,
    wpmChange: currentWpm !== null && previousWpm !== null ? currentWpm - previousWpm : null,
    accuracy: average(recent, "accuracy"),
    bestWpm: bestWpm,
    trendReady: source.length >= 6
  }
}

function downsample(source, maximumPoints) {
  var rows = Array.isArray(source) ? source : []
  var maximum = Math.max(2, Math.round(finiteNumber(maximumPoints, 120)))
  if (rows.length <= maximum) return rows.slice()
  var result = []
  var previousIndex = -1
  for (var index = 0; index < maximum; index++) {
    var sourceIndex = Math.round(index * (rows.length - 1) / (maximum - 1))
    if (sourceIndex !== previousIndex) result.push(rows[sourceIndex])
    previousIndex = sourceIndex
  }
  return result
}

function metricPoints(rows, field, maximumPoints) {
  var all = points(rows)
  var selected = []
  for (var index = 0; index < all.length; index++) {
    if (all[index][field] === null || all[index][field] === undefined) continue
    selected.push({
      id: all[index].id,
      completedAt: all[index].completedAt,
      label: all[index].label,
      result: all[index].result,
      value: all[index][field]
    })
  }
  return downsample(selected, maximumPoints)
}

function sourceCharacterStats(result) {
  if (result && Array.isArray(result.characterStats) && result.characterStats.length > 0) return result.characterStats
  return result && Array.isArray(result.difficultCharacters) ? result.difficultCharacters : []
}

function characters(rows) {
  var table = {}
  var source = Array.isArray(rows) ? rows : []
  for (var index = 0; index < source.length; index++) {
    var stats = sourceCharacterStats(source[index])
    for (var statIndex = 0; statIndex < stats.length; statIndex++) {
      var stat = stats[statIndex] || {}
      var character = String(stat.character || "")
      if (!character || /\s/.test(character)) continue
      if (!table[character]) table[character] = { character: character, opportunities: 0, errors: 0 }
      table[character].opportunities += Math.max(0, finiteNumber(stat.opportunities, 0))
      table[character].errors += Math.max(0, finiteNumber(stat.firstAttemptErrors, finiteNumber(stat.totalErrors, 0)))
    }
  }
  var result = []
  for (var name in table) {
    table[name].errorRate = table[name].opportunities > 0 ? table[name].errors / table[name].opportunities * 100 : 0
    if (table[name].errors > 0) result.push(table[name])
  }
  result.sort(function(a, b) {
    if (b.errors !== a.errors) return b.errors - a.errors
    if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate
    return String(a.character).localeCompare(String(b.character))
  })
  return result
}

function characterTrend(rows, character, maximumPoints) {
  var result = []
  var source = Array.isArray(rows) ? rows : []
  for (var index = 0; index < source.length; index++) {
    var stats = sourceCharacterStats(source[index])
    for (var statIndex = 0; statIndex < stats.length; statIndex++) {
      var stat = stats[statIndex] || {}
      if (String(stat.character || "") !== String(character || "")) continue
      var opportunities = Math.max(0, finiteNumber(stat.opportunities, 0))
      var errors = Math.max(0, finiteNumber(stat.firstAttemptErrors, finiteNumber(stat.totalErrors, 0)))
      if (opportunities <= 0) continue
      result.push({
        id: String(source[index].id || ""),
        completedAt: String(source[index].completedAt || ""),
        label: String(index + 1),
        result: source[index],
        value: errors / opportunities * 100,
        opportunities: opportunities,
        errors: errors
      })
      break
    }
  }
  return downsample(result, maximumPoints)
}
