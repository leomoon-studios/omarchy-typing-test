.pragma library
.import "Normalization.js" as Normalization

var DEFAULT_WINDOW = 10
var MAX_TARGETS = 5
var RECENCY_DECAY = 0.85
var MIN_OPPORTUNITIES = 8
var MIN_ERRORS = 2
var HIGH_ERROR_RATE = 0.25

function finiteNumber(value, fallback) {
  if (value === undefined || value === null || typeof value === "boolean") return fallback
  if (typeof value === "string" && !value.trim()) return fallback
  var number = Number(value)
  return isFinite(number) ? number : fallback
}

function normalizedCharacter(character, settings) {
  return Normalization.normalizeCharacter(character, settings || {})
}

function isTargetCharacter(character, language) {
  var value = String(character || "")
  if (!value || /\s/.test(value) || value === "\u200c") return false
  if (language === "en") return /^[A-Za-z]$/.test(value)
  if (/[0-9۰-۹٠-٩،؛؟.,:;!؟«»()[\]{}'"%+\-=/_\\]/.test(value)) return false
  var code = value.charCodeAt(0)
  return (code >= 0x0621 && code <= 0x063a)
    || (code >= 0x0641 && code <= 0x064a)
    || (code >= 0x066e && code <= 0x06d3)
    || (code >= 0x06fa && code <= 0x06ff)
}

function sourceStats(result) {
  if (result && Array.isArray(result.characterStats) && result.characterStats.length > 0) return result.characterStats
  return result && Array.isArray(result.difficultCharacters) ? result.difficultCharacters : []
}

function rankTargets(history, language, settings, requestedWindow) {
  var selectedLanguage = language === "fa" ? "fa" : "en"
  var configuredWindow = requestedWindow === undefined
    ? finiteNumber(settings && settings.adaptiveHistoryWindow, DEFAULT_WINDOW)
    : finiteNumber(requestedWindow, DEFAULT_WINDOW)
  var historyWindow = Math.max(5, Math.min(50, Math.round(configuredWindow)))
  var matching = []
  var source = Array.isArray(history) ? history : []
  for (var historyIndex = 0; historyIndex < source.length && matching.length < historyWindow; historyIndex++) {
    var result = source[historyIndex]
    if (result && result.language === selectedLanguage) matching.push(result)
  }

  var table = {}
  for (var resultIndex = 0; resultIndex < matching.length; resultIndex++) {
    var weight = Math.pow(RECENCY_DECAY, resultIndex)
    var stats = sourceStats(matching[resultIndex])
    var seenErrors = {}
    for (var statIndex = 0; statIndex < stats.length; statIndex++) {
      var stat = stats[statIndex] || {}
      var character = normalizedCharacter(stat.character, settings)
      if (!isTargetCharacter(character, selectedLanguage)) continue
      if (!table[character]) {
        table[character] = {
          character: character,
          weightedOpportunities: 0,
          weightedErrors: 0,
          testsWithError: 0
        }
      }
      var opportunities = Math.max(0, finiteNumber(stat.opportunities, 0))
      var errors = Math.max(0, finiteNumber(stat.firstAttemptErrors, finiteNumber(stat.totalErrors, 0)))
      table[character].weightedOpportunities += opportunities * weight
      table[character].weightedErrors += errors * weight
      if (errors > 0 && !seenErrors[character]) {
        table[character].testsWithError++
        seenErrors[character] = true
      }
    }
  }

  var ranked = []
  for (var name in table) {
    var row = table[name]
    if (row.weightedOpportunities <= 0) continue
    var rate = row.weightedErrors / row.weightedOpportunities
    if (row.weightedOpportunities < MIN_OPPORTUNITIES) continue
    if (row.weightedErrors < MIN_ERRORS && rate < HIGH_ERROR_RATE) continue
    var confidence = Math.min(1, row.weightedOpportunities / 20)
    var recurrence = Math.min(1, row.testsWithError / 3)
    row.errorRate = rate
    row.score = rate * confidence * (0.75 + 0.25 * recurrence)
    ranked.push(row)
  }

  ranked.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score
    if (b.weightedErrors !== a.weightedErrors) return b.weightedErrors - a.weightedErrors
    return String(a.character).localeCompare(String(b.character))
  })

  var targets = ranked.slice(0, MAX_TARGETS)
  var enoughTests = matching.length >= 3
  return {
    available: enoughTests && targets.length > 0,
    analyzedTests: matching.length,
    historyWindow: historyWindow,
    language: selectedLanguage,
    targets: targets,
    characters: targets.map(function(row) { return row.character }),
    reason: !enoughTests
      ? "Complete at least three " + (selectedLanguage === "fa" ? "Parsi" : "English") + " tests to unlock adaptive practice."
      : targets.length === 0
        ? "No character has enough recent errors for adaptive practice yet."
        : ""
  }
}

function recentPassageIds(history, language, resultLimit) {
  var limit = Math.max(1, Math.round(finiteNumber(resultLimit, 3)))
  var source = Array.isArray(history) ? history : []
  var ids = []
  var matched = 0
  for (var index = 0; index < source.length && matched < limit; index++) {
    var result = source[index]
    if (!result || result.language !== language) continue
    matched++
    var passageIds = Array.isArray(result.passageIds) ? result.passageIds : []
    for (var passageIndex = 0; passageIndex < passageIds.length; passageIndex++) {
      var id = String(passageIds[passageIndex] || "")
      if (id && ids.indexOf(id) < 0) ids.push(id)
    }
  }
  return ids
}

function countCharacter(text, character) {
  var count = 0
  var position = String(text || "").indexOf(character)
  while (position >= 0) {
    count++
    position = String(text || "").indexOf(character, position + character.length)
  }
  return count
}

function allowedCategory(language, category) {
  if (category === "custom" || category === "common" || category === "literature") return true
  return language === "fa" && category === "formal"
}

function passageScore(passage, characters) {
  var text = String(passage && passage.text || "")
  var total = 0
  var unique = 0
  for (var index = 0; index < characters.length; index++) {
    var count = countCharacter(text, characters[index])
    if (count > 0) unique++
    total += count * Math.max(1, characters.length - index)
  }
  var density = text.length > 0 ? total / text.length * 100 : 0
  return unique * 4 + density
}

function buildAdaptiveTest(passages, language, targetCharacters, targetLength, avoidedIds) {
  var characters = Array.isArray(targetCharacters) ? targetCharacters.slice(0, MAX_TARGETS) : []
  var avoided = Array.isArray(avoidedIds) ? avoidedIds : []
  var candidates = []
  var source = Array.isArray(passages) ? passages : []
  for (var index = 0; index < source.length; index++) {
    var passage = source[index]
    if (!passage || passage.language !== language || !allowedCategory(language, passage.category)) continue
    if (!String(passage.id || "") || !String(passage.text || "").trim()) continue
    candidates.push({
      passage: passage,
      score: passageScore(passage, characters),
      avoided: avoided.indexOf(String(passage.id || "")) >= 0
    })
  }

  var hasFresh = candidates.some(function(row) { return !row.avoided && row.score > 0 })
  candidates.sort(function(a, b) {
    if (hasFresh && a.avoided !== b.avoided) return a.avoided ? 1 : -1
    if (b.score !== a.score) return b.score - a.score
    return String(a.passage.id || "").localeCompare(String(b.passage.id || ""))
  })

  var desired = Math.max(300, finiteNumber(targetLength, 1000))
  var text = ""
  var ids = []
  var lastId = ""
  var cursor = 0
  while (candidates.length > 0 && text.length < desired) {
    var row = candidates[cursor % candidates.length]
    cursor++
    var id = String(row.passage.id || "")
    if (candidates.length > 1 && id === lastId) continue
    if (text) text += " "
    text += String(row.passage.text || "").trim()
    ids.push(id)
    lastId = id
  }

  return {
    text: text,
    passageIds: ids,
    targetCharacters: characters,
    matchedPassages: candidates.filter(function(row) { return row.score > 0 }).length
  }
}
