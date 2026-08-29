.pragma library

function key(character, hand, finger) {
  return { character: character, hand: hand, finger: hand + "-" + finger }
}

function englishRows() {
  return [
    [key("q", "left", "pinky"), key("w", "left", "ring"), key("e", "left", "middle"), key("r", "left", "index"), key("t", "left", "index"), key("y", "right", "index"), key("u", "right", "index"), key("i", "right", "middle"), key("o", "right", "ring"), key("p", "right", "pinky")],
    [key("a", "left", "pinky"), key("s", "left", "ring"), key("d", "left", "middle"), key("f", "left", "index"), key("g", "left", "index"), key("h", "right", "index"), key("j", "right", "index"), key("k", "right", "middle"), key("l", "right", "ring")],
    [key("z", "left", "pinky"), key("x", "left", "ring"), key("c", "left", "middle"), key("v", "left", "index"), key("b", "left", "index"), key("n", "right", "index"), key("m", "right", "index")]
  ]
}

function persianRows() {
  return [
    [key("ض", "left", "pinky"), key("ص", "left", "ring"), key("ث", "left", "middle"), key("ق", "left", "index"), key("ف", "left", "index"), key("غ", "right", "index"), key("ع", "right", "index"), key("ه", "right", "middle"), key("خ", "right", "ring"), key("ح", "right", "pinky"), key("ج", "right", "pinky"), key("چ", "right", "pinky")],
    [key("ش", "left", "pinky"), key("س", "left", "ring"), key("ی", "left", "middle"), key("ب", "left", "index"), key("ل", "left", "index"), key("ا", "right", "index"), key("ت", "right", "index"), key("ن", "right", "middle"), key("م", "right", "ring"), key("ک", "right", "pinky"), key("گ", "right", "pinky")],
    [key("ظ", "left", "pinky"), key("ط", "left", "ring"), key("ز", "left", "middle"), key("ر", "left", "index"), key("ذ", "left", "index"), key("د", "right", "index"), key("پ", "right", "index"), key("و", "right", "middle")]
  ]
}

function layout(language) {
  return language === "fa" ? persianRows() : englishRows()
}

function aggregate(history, language) {
  var table = {}
  var source = Array.isArray(history) ? history : []
  for (var resultIndex = 0; resultIndex < source.length; resultIndex++) {
    var result = source[resultIndex]
    if (!result || result.language !== language) continue
    var stats = Array.isArray(result.keyTimingStats) && result.keyTimingStats.length > 0
      ? result.keyTimingStats
      : (Array.isArray(result.characterStats) ? result.characterStats : [])
    for (var statIndex = 0; statIndex < stats.length; statIndex++) {
      var stat = stats[statIndex] || {}
      var character = String(stat.character || "")
      if (language === "en") character = character.toLowerCase()
      if (!character || /\s/.test(character)) continue
      if (!table[character]) table[character] = {
        opportunities: 0, firstAttemptErrors: 0, totalErrors: 0,
        timedAttempts: 0, totalIntervalMs: 0
      }
      table[character].opportunities += Math.max(0, Number(stat.opportunities) || 0)
      table[character].firstAttemptErrors += Math.max(0, Number(stat.firstAttemptErrors) || 0)
      table[character].totalErrors += Math.max(0, Number(stat.totalErrors) || 0)
      table[character].timedAttempts += Math.max(0, Number(stat.timedAttempts) || 0)
      table[character].totalIntervalMs += Math.max(0, Number(stat.totalIntervalMs) || 0)
    }
  }

  var rows = layout(language)
  var flat = []
  var slowest = 0
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    for (var keyIndex = 0; keyIndex < rows[rowIndex].length; keyIndex++) {
      var definition = rows[rowIndex][keyIndex]
      var totals = table[definition.character] || {
        opportunities: 0, firstAttemptErrors: 0, totalErrors: 0,
        timedAttempts: 0, totalIntervalMs: 0
      }
      var averageIntervalMs = totals.timedAttempts > 0 ? totals.totalIntervalMs / totals.timedAttempts : 0
      slowest = Math.max(slowest, averageIntervalMs)
      flat.push({
        character: definition.character,
        hand: definition.hand,
        finger: definition.finger,
        row: rowIndex,
        index: keyIndex,
        opportunities: totals.opportunities,
        firstAttemptErrors: totals.firstAttemptErrors,
        totalErrors: totals.totalErrors,
        timedAttempts: totals.timedAttempts,
        totalIntervalMs: totals.totalIntervalMs,
        averageIntervalMs: averageIntervalMs,
        speedCpm: averageIntervalMs > 0 ? 60000 / averageIntervalMs : 0,
        errorRate: totals.opportunities > 0 ? Math.min(1, totals.firstAttemptErrors / totals.opportunities) : 0
      })
    }
  }

  for (var flatIndex = 0; flatIndex < flat.length; flatIndex++) {
    var speedHeat = slowest > 0 ? flat[flatIndex].averageIntervalMs / slowest : 0
    flat[flatIndex].heat = Math.max(0, Math.min(1, flat[flatIndex].errorRate * 0.7 + speedHeat * 0.3))
  }

  var resultRows = []
  for (var outputRow = 0; outputRow < rows.length; outputRow++) {
    resultRows.push(flat.filter(function(item) { return item.row === outputRow }))
  }
  return { rows: resultRows, keys: flat }
}

function rankedTargets(data, predicate, requireEvidence, maximum) {
  var source = data && Array.isArray(data.keys) ? data.keys : []
  var matching = []
  for (var index = 0; index < source.length; index++) {
    if (!predicate(source[index])) continue
    if (requireEvidence && Number(source[index].opportunities || 0) <= 0) continue
    matching.push(source[index])
  }
  matching.sort(function(a, b) {
    if (b.heat !== a.heat) return b.heat - a.heat
    if (b.opportunities !== a.opportunities) return b.opportunities - a.opportunities
    return a.row !== b.row ? a.row - b.row : a.index - b.index
  })
  var limit = Math.max(1, Math.round(Number(maximum) || matching.length || 1))
  return matching.slice(0, limit).map(function(item) { return item.character })
}

function targetsForHand(data, hand) {
  return rankedTargets(data, function(item) { return item.hand === hand }, false, 32)
}

function targetsForKey(data, character) {
  var value = String(character || "")
  var source = data && Array.isArray(data.keys) ? data.keys : []
  for (var index = 0; index < source.length; index++) {
    if (source[index].character === value) return [value]
  }
  return []
}

function targetsForFinger(data, finger) {
  return rankedTargets(data, function(item) { return item.finger === finger }, false, 32)
}

function weakestTargets(data) {
  return rankedTargets(data, function() { return true }, true, 5)
}
