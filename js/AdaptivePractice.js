.pragma library
.import "Normalization.js" as Normalization

var DEFAULT_WINDOW = 10
var MAX_TARGETS = 5
var MAX_DRILL_TARGETS = 32
var MAX_PATTERN_TARGETS = 3
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

function rankErrorPatterns(table, keyName, maximum) {
  var ranked = []
  for (var name in table) {
    var row = table[name]
    if (row.weightedOpportunities <= 0 || row.weightedErrors <= 0 || row.testsWithError < 2) continue
    var rate = row.weightedErrors / row.weightedOpportunities
    var confidence = Math.min(1, row.weightedOpportunities / 6)
    var recurrence = Math.min(1, row.testsWithError / 3)
    row.errorRate = rate
    row.score = rate * confidence * (0.7 + 0.3 * recurrence)
    ranked.push(row)
  }
  ranked.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score
    if (b.weightedErrors !== a.weightedErrors) return b.weightedErrors - a.weightedErrors
    return String(a[keyName]).localeCompare(String(b[keyName]))
  })
  return ranked.slice(0, maximum)
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
  var bigramTable = {}
  var wordTable = {}
  var hesitationTable = {}
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

    var bigrams = Array.isArray(matching[resultIndex].difficultBigrams) ? matching[resultIndex].difficultBigrams : []
    for (var bigramIndex = 0; bigramIndex < bigrams.length; bigramIndex++) {
      var bigramRow = bigrams[bigramIndex] || {}
      var bigram = String(bigramRow.bigram || "")
      if (!bigram || /\s/.test(bigram) || bigram.length > 8) continue
      if (!bigramTable[bigram]) bigramTable[bigram] = { bigram: bigram, weightedOpportunities: 0, weightedErrors: 0, testsWithError: 0 }
      bigramTable[bigram].weightedOpportunities += Math.max(0, finiteNumber(bigramRow.opportunities, 0)) * weight
      var bigramErrors = Math.max(0, finiteNumber(bigramRow.firstAttemptErrors, finiteNumber(bigramRow.totalErrors, 0)))
      bigramTable[bigram].weightedErrors += bigramErrors * weight
      if (bigramErrors > 0) bigramTable[bigram].testsWithError++
    }

    var words = Array.isArray(matching[resultIndex].difficultWords) ? matching[resultIndex].difficultWords : []
    for (var wordIndex = 0; wordIndex < words.length; wordIndex++) {
      var wordRow = words[wordIndex] || {}
      var word = String(wordRow.word || "").toLowerCase()
      if (!word || /\s/.test(word) || word.length > 48) continue
      if (!wordTable[word]) wordTable[word] = { word: word, weightedOpportunities: 0, weightedErrors: 0, testsWithError: 0 }
      wordTable[word].weightedOpportunities += Math.max(0, finiteNumber(wordRow.opportunities, 0)) * weight
      var wordErrors = Math.max(0, finiteNumber(wordRow.errorOccurrences, finiteNumber(wordRow.totalErrors, 0)))
      wordTable[word].weightedErrors += wordErrors * weight
      if (wordErrors > 0) wordTable[word].testsWithError++
    }

    var hesitations = Array.isArray(matching[resultIndex].hesitationStats) ? matching[resultIndex].hesitationStats : []
    for (var hesitationIndex = 0; hesitationIndex < hesitations.length; hesitationIndex++) {
      var hesitationRow = hesitations[hesitationIndex] || {}
      var hesitationCharacter = normalizedCharacter(hesitationRow.character, settings)
      if (!isTargetCharacter(hesitationCharacter, selectedLanguage)) continue
      if (!hesitationTable[hesitationCharacter]) hesitationTable[hesitationCharacter] = {
        character: hesitationCharacter, weightedCount: 0, weightedDelay: 0, testsWithHesitation: 0
      }
      var hesitationCount = Math.max(0, finiteNumber(hesitationRow.count, 0))
      hesitationTable[hesitationCharacter].weightedCount += hesitationCount * weight
      hesitationTable[hesitationCharacter].weightedDelay += Math.max(0, finiteNumber(hesitationRow.totalDelayMs,
        finiteNumber(hesitationRow.averageDelayMs, 0) * hesitationCount)) * weight
      if (hesitationCount > 0) hesitationTable[hesitationCharacter].testsWithHesitation++
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
  var bigramTargets = rankErrorPatterns(bigramTable, "bigram", MAX_PATTERN_TARGETS)
  var wordTargets = rankErrorPatterns(wordTable, "word", MAX_PATTERN_TARGETS)
  var hesitationTargets = []
  for (var hesitationName in hesitationTable) {
    var hesitationTarget = hesitationTable[hesitationName]
    if (hesitationTarget.weightedCount < 2 || hesitationTarget.testsWithHesitation < 2) continue
    hesitationTarget.averageDelayMs = hesitationTarget.weightedDelay / hesitationTarget.weightedCount
    hesitationTarget.score = hesitationTarget.averageDelayMs * Math.min(1, hesitationTarget.weightedCount / 3)
      * (0.7 + 0.3 * Math.min(1, hesitationTarget.testsWithHesitation / 3))
    hesitationTargets.push(hesitationTarget)
  }
  hesitationTargets.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score
    return String(a.character).localeCompare(String(b.character))
  })
  hesitationTargets = hesitationTargets.slice(0, MAX_PATTERN_TARGETS)
  var enoughTests = matching.length >= 3
  var hasTargets = targets.length > 0 || bigramTargets.length > 0 || wordTargets.length > 0 || hesitationTargets.length > 0
  return {
    available: enoughTests && hasTargets,
    analyzedTests: matching.length,
    historyWindow: historyWindow,
    language: selectedLanguage,
    targets: targets,
    characters: targets.map(function(row) { return row.character }),
    bigramTargets: bigramTargets,
    bigrams: bigramTargets.map(function(row) { return row.bigram }),
    wordTargets: wordTargets,
    words: wordTargets.map(function(row) { return row.word }),
    hesitationTargets: hesitationTargets,
    hesitationCharacters: hesitationTargets.map(function(row) { return row.character }),
    reason: !enoughTests
      ? "Complete at least three " + (selectedLanguage === "fa" ? "Parsi" : "English") + " tests to unlock adaptive practice."
      : !hasTargets
        ? "No recurring error or hesitation pattern has enough recent evidence yet."
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

function passageScore(passage, characters, contentTargets) {
  var text = String(passage && passage.text || "")
  var patterns = contentTargets || {}
  var lowerText = Normalization.normalizeText(text, patterns.settings || {}).toLowerCase()
  var total = 0
  var unique = 0
  for (var index = 0; index < characters.length; index++) {
    var count = countCharacter(text, characters[index])
    if (count > 0) unique++
    total += count * Math.max(1, characters.length - index)
  }
  var bigrams = Array.isArray(patterns.bigrams) ? patterns.bigrams : []
  for (var bigramIndex = 0; bigramIndex < bigrams.length; bigramIndex++) {
    var bigramCount = countCharacter(lowerText, String(bigrams[bigramIndex] || "").toLowerCase())
    if (bigramCount > 0) unique++
    total += bigramCount * 8
  }
  var passageWords = lowerText.split(/\s+/)
  var words = Array.isArray(patterns.words) ? patterns.words : []
  for (var wordIndex = 0; wordIndex < words.length; wordIndex++) {
    var targetWord = String(words[wordIndex] || "").toLowerCase()
    var wordCount = 0
    for (var passageWordIndex = 0; passageWordIndex < passageWords.length; passageWordIndex++) {
      if (passageWords[passageWordIndex].replace(/^[.,!?;:()[\]{}'"«»،؛؟]+/, "").replace(/[.,!?;:()[\]{}'"«»،؛؟]+$/, "") === targetWord) wordCount++
    }
    if (wordCount > 0) unique++
    total += wordCount * 14
  }
  var hesitationCharacters = Array.isArray(patterns.hesitationCharacters) ? patterns.hesitationCharacters : []
  for (var hesitationIndex = 0; hesitationIndex < hesitationCharacters.length; hesitationIndex++) {
    var hesitationCount = countCharacter(lowerText, String(hesitationCharacters[hesitationIndex] || "").toLowerCase())
    if (hesitationCount > 0) unique++
    total += hesitationCount * 3
  }
  var density = text.length > 0 ? total / text.length * 100 : 0
  return unique * 4 + density
}

function adaptiveCandidates(passages, language, targetCharacters, avoidedIds, contentTargets) {
  var characters = Array.isArray(targetCharacters) ? targetCharacters.slice(0, MAX_DRILL_TARGETS) : []
  var avoided = Array.isArray(avoidedIds) ? avoidedIds : []
  var candidates = []
  var source = Array.isArray(passages) ? passages : []
  for (var index = 0; index < source.length; index++) {
    var passage = source[index]
    if (!passage || passage.language !== language || !allowedCategory(language, passage.category)) continue
    if (!String(passage.id || "") || !String(passage.text || "").trim()) continue
    candidates.push({
      passage: passage,
      score: passageScore(passage, characters, contentTargets),
      avoided: avoided.indexOf(String(passage.id || "")) >= 0
    })
  }

  var hasFresh = candidates.some(function(row) { return !row.avoided && row.score > 0 })
  candidates.sort(function(a, b) {
    if (hasFresh && a.avoided !== b.avoided) return a.avoided ? 1 : -1
    if (b.score !== a.score) return b.score - a.score
    return String(a.passage.id || "").localeCompare(String(b.passage.id || ""))
  })
  return { candidates: candidates, characters: characters }
}

function buildAdaptiveTest(passages, language, targetCharacters, targetLength, avoidedIds, contentTargets) {
  var ranked = adaptiveCandidates(passages, language, targetCharacters, avoidedIds, contentTargets)
  var candidates = ranked.candidates
  var characters = ranked.characters

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

function buildAdaptiveWordTest(passages, language, targetCharacters, targetWordCount, avoidedIds, contentTargets) {
  var desiredWords = Math.max(1, Math.round(finiteNumber(targetWordCount, 25)))
  var ranked = adaptiveCandidates(passages, language, targetCharacters, avoidedIds, contentTargets)
  var candidates = ranked.candidates
  var selectedWords = []
  var ids = []
  var lastId = ""
  var cursor = 0
  while (candidates.length > 0 && selectedWords.length < desiredWords) {
    var row = candidates[cursor % candidates.length]
    cursor++
    var id = String(row.passage.id || "")
    if (candidates.length > 1 && id === lastId) continue
    var passageWords = String(row.passage.text || "").trim().split(/\s+/)
    if (passageWords.length === 1 && !passageWords[0]) continue
    selectedWords = selectedWords.concat(passageWords.slice(0, desiredWords - selectedWords.length))
    ids.push(id)
    lastId = id
  }
  return {
    text: selectedWords.join(" "),
    passageIds: ids,
    targetCharacters: ranked.characters,
    matchedPassages: candidates.filter(function(candidate) { return candidate.score > 0 }).length,
    wordCount: selectedWords.length
  }
}
