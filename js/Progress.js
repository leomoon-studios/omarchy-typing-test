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
  for (var index = 0; index < rows.length; index++) {
    var value = rows[index][field]
    if (value === null || value === undefined || !isFinite(Number(value))) continue
    total += Number(value)
    count++
  }
  return count > 0 ? total / count : null
}

function filterHistory(history, language, range) {
  var selectedLanguage = language === "fa" ? "fa" : "en"
  var newest = []
  var source = Array.isArray(history) ? history : []
  for (var index = 0; index < source.length; index++) {
    if (source[index] && source[index].language === selectedLanguage) newest.push(source[index])
  }
  newest.sort(function(a, b) { return String(b.completedAt || "").localeCompare(String(a.completedAt || "")) })
  var limit = range === "7-tests" ? 7 : range === "all" ? newest.length : 30
  return newest.slice(0, limit).reverse()
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
  var source = Array.isArray(rows) ? rows : []
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
