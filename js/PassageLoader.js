.pragma library

function parseJsonLines(raw) {
  var results = []
  var lines = String(raw || "").split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    try {
      var item = JSON.parse(line)
      if (item && item.id && String(item.text || "").trim() && (item.language === "en" || item.language === "fa")) results.push(item)
    } catch (error) {
      // A malformed record is intentionally isolated to its own line.
    }
  }
  return results
}

function shuffled(items, randomFunction) {
  var copy = (items || []).slice()
  var random = randomFunction || Math.random
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(random() * (i + 1))
    var temporary = copy[i]
    copy[i] = copy[j]
    copy[j] = temporary
  }
  return copy
}

function filter(passages, language, category, difficulty) {
  var selected = []
  for (var i = 0; i < (passages || []).length; i++) {
    var item = passages[i]
    if (item.language !== language) continue
    if (category && category !== "mixed" && item.category !== category) continue
    if (difficulty !== "mixed" && Number(item.difficulty) !== Number(difficulty)) continue
    selected.push(item)
  }
  return selected
}

function words(value) {
  var text = String(value || "").trim()
  return text ? text.split(/\s+/) : []
}

function candidatesFor(passages, language, category, difficulty) {
  var candidates = filter(passages, language, category, difficulty)
  if (candidates.length === 0 && difficulty !== "mixed") candidates = filter(passages, language, category, "mixed")
  return candidates
}

function buildTest(passages, language, category, difficulty, targetCharacters, randomFunction) {
  var candidates = candidatesFor(passages, language, category, difficulty)
  candidates = shuffled(candidates, randomFunction)
  var text = ""
  var ids = []
  var target = Math.max(300, Number(targetCharacters) || 1000)
  var lastId = ""
  while (candidates.length > 0 && text.length < target) {
    if (lastId && candidates.length > 1 && candidates[0].id === lastId) {
      var first = candidates[0]
      candidates[0] = candidates[1]
      candidates[1] = first
    }
    for (var i = 0; i < candidates.length && text.length < target; i++) {
      if (text.length > 0) text += " "
      text += String(candidates[i].text).trim()
      ids.push(candidates[i].id)
      lastId = candidates[i].id
    }
    if (text.length < target) candidates = shuffled(candidates, randomFunction)
  }
  return { text: text, passageIds: ids }
}

function buildWordTest(passages, language, category, difficulty, targetWordCount, randomFunction) {
  var candidates = shuffled(candidatesFor(passages, language, category, difficulty), randomFunction)
  var target = Math.max(1, Math.round(Number(targetWordCount) || 25))
  var selectedWords = []
  var ids = []
  var lastId = ""
  var cursor = 0
  while (candidates.length > 0 && selectedWords.length < target) {
    var item = candidates[cursor % candidates.length]
    cursor++
    if (candidates.length > 1 && item.id === lastId) continue
    var available = words(item.text)
    if (available.length === 0) continue
    var remaining = target - selectedWords.length
    selectedWords = selectedWords.concat(available.slice(0, remaining))
    ids.push(item.id)
    lastId = item.id
    if (cursor % candidates.length === 0) candidates = shuffled(candidates, randomFunction)
  }
  return { text: selectedWords.join(" "), passageIds: ids, wordCount: selectedWords.length }
}

function buildPassageTest(passages, language, category, difficulty, randomFunction) {
  var candidates = shuffled(candidatesFor(passages, language, category, difficulty), randomFunction)
  if (candidates.length === 0) return { text: "", passageIds: [] }
  return { text: String(candidates[0].text || "").trim(), passageIds: [candidates[0].id] }
}

function buildDifficultTest(passages, language, difficultCharacters, targetCharacters) {
  var characters = (difficultCharacters || []).slice(0, 12)
  if (characters.length === 0) return buildTest(passages, language, "common", "mixed", targetCharacters)
  var candidates = filter(passages, language, "mixed", "mixed")
  candidates.sort(function(a, b) {
    function score(item) {
      var value = 0
      var text = String(item.text || "")
      for (var i = 0; i < characters.length; i++) {
        var needle = String(characters[i] || "")
        if (!needle) continue
        var position = text.indexOf(needle)
        while (position >= 0) { value++; position = text.indexOf(needle, position + needle.length) }
      }
      return value
    }
    return score(b) - score(a)
  })
  var selectedText = ""
  var ids = []
  var target = Math.max(300, Number(targetCharacters) || 1000)
  for (var j = 0; j < candidates.length && selectedText.length < target; j++) {
    if (selectedText) selectedText += " "
    selectedText += String(candidates[j].text).trim()
    ids.push(candidates[j].id)
  }
  return { text: selectedText, passageIds: ids }
}

function difficultCandidates(passages, language, difficultCharacters) {
  var characters = (difficultCharacters || []).slice(0, 12)
  var candidates = filter(passages, language, "mixed", "mixed")
  candidates.sort(function(a, b) {
    function score(item) {
      var value = 0
      var text = String(item.text || "")
      for (var i = 0; i < characters.length; i++) {
        var needle = String(characters[i] || "")
        if (!needle) continue
        var position = text.indexOf(needle)
        while (position >= 0) { value++; position = text.indexOf(needle, position + needle.length) }
      }
      return value
    }
    return score(b) - score(a)
  })
  return candidates
}

function buildDifficultWordTest(passages, language, difficultCharacters, targetWordCount) {
  if (!Array.isArray(difficultCharacters) || difficultCharacters.length === 0)
    return buildWordTest(passages, language, "common", "mixed", targetWordCount)
  return buildWordTest(difficultCandidates(passages, language, difficultCharacters), language, "mixed", "mixed", targetWordCount, function() { return 0.999999 })
}

function buildDifficultPassageTest(passages, language, difficultCharacters) {
  if (!Array.isArray(difficultCharacters) || difficultCharacters.length === 0)
    return buildPassageTest(passages, language, "common", "mixed")
  var candidates = difficultCandidates(passages, language, difficultCharacters)
  if (candidates.length === 0) return { text: "", passageIds: [] }
  return { text: String(candidates[0].text || "").trim(), passageIds: [candidates[0].id] }
}
