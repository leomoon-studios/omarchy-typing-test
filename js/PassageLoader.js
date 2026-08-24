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

function buildTest(passages, language, category, difficulty, targetCharacters, randomFunction) {
  var candidates = filter(passages, language, category, difficulty)
  if (candidates.length === 0 && difficulty !== "mixed") candidates = filter(passages, language, category, "mixed")
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
