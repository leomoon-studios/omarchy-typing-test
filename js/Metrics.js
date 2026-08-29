.pragma library
.import "Normalization.js" as Normalization

function clamp(minimum, maximum, value) {
  return Math.max(minimum, Math.min(maximum, value))
}

function calculate(totalEntered, correctKeystrokes, uncorrectedErrors, elapsedSeconds, completedWords) {
  var minutes = Math.max(0, Number(elapsedSeconds) || 0) / 60
  if (minutes <= 0) {
    return { grossWpm: 0, netWpm: 0, literalWpm: 0, accuracy: totalEntered > 0 ? 0 : 100 }
  }
  var entered = Math.max(0, Number(totalEntered) || 0)
  var correct = Math.max(0, Number(correctKeystrokes) || 0)
  var errors = Math.max(0, Number(uncorrectedErrors) || 0)
  return {
    grossWpm: entered / 5 / minutes,
    netWpm: Math.max(0, (entered - errors) / 5 / minutes),
    literalWpm: Math.max(0, Number(completedWords) || 0) / minutes,
    accuracy: entered > 0 ? correct / entered * 100 : 100
  }
}

function consistency(samples) {
  var values = []
  for (var i = 0; i < (samples || []).length; i++) {
    var value = Number(samples[i].grossWpm !== undefined ? samples[i].grossWpm : samples[i])
    if (isFinite(value) && value >= 0) values.push(value)
  }
  if (values.length < 3) return null
  var sum = 0
  for (var j = 0; j < values.length; j++) sum += values[j]
  var mean = sum / values.length
  if (mean <= 0) return null
  var squared = 0
  for (var k = 0; k < values.length; k++) squared += Math.pow(values[k] - mean, 2)
  var deviation = Math.sqrt(squared / values.length)
  return clamp(0, 100, 100 - deviation / mean * 100)
}

function completedWordCount(expected, typedLength) {
  var prefix = String(expected || "").slice(0, Math.max(0, typedLength))
  var matches = prefix.trim().match(/\S+/g)
  if (!matches) return 0
  if (prefix.length > 0 && !/\s$/.test(prefix)) return Math.max(0, matches.length - 1)
  return matches.length
}

function evaluateFinal(expected, typed, options) {
  var expectedChars = Normalization.normalizedCharacters(expected, options)
  var typedChars = Normalization.normalizedCharacters(typed, options)
  var correct = 0
  var incorrect = 0
  for (var i = 0; i < typedChars.length; i++) {
    if (i < expectedChars.length && expectedChars[i] === typedChars[i]) correct++
    else incorrect++
  }
  return { correct: correct, incorrect: incorrect, entered: typedChars.length }
}

function substitutions(events, includeCorrected) {
  var counts = {}
  var source = events || []
  for (var i = 0; i < source.length; i++) {
    var event = source[i]
    if (event.corrected && !includeCorrected) continue
    var key = String(event.expected || "") + "\u0000" + String(event.actual || "")
    if (!counts[key]) counts[key] = { expected: event.expected, actual: event.actual, count: 0 }
    counts[key].count++
  }
  var result = []
  for (var keyName in counts) result.push(counts[keyName])
  result.sort(function(a, b) { return b.count - a.count })
  return result
}

function difficultCharacters(events, opportunities, includeCorrected, minimumOpportunities) {
  var table = {}
  var chance = opportunities || {}
  for (var character in chance) {
    if (/\s/.test(character)) continue
    table[character] = {
      character: character,
      opportunities: chance[character],
      firstAttemptErrors: 0,
      totalErrors: 0,
      errorRate: 0,
      mostCommonSubstitution: "",
      replacements: {}
    }
  }
  var source = events || []
  for (var i = 0; i < source.length; i++) {
    var event = source[i]
    if (event.corrected && !includeCorrected) continue
    var expected = String(event.expected || "")
    if (!expected || /\s/.test(expected)) continue
    if (!table[expected]) {
      table[expected] = { character: expected, opportunities: chance[expected] || 0, firstAttemptErrors: 0, totalErrors: 0, errorRate: 0, mostCommonSubstitution: "", replacements: {} }
    }
    table[expected].totalErrors++
    if (event.firstAttempt !== false) table[expected].firstAttemptErrors++
    var actual = String(event.actual || "")
    table[expected].replacements[actual] = (table[expected].replacements[actual] || 0) + 1
  }
  var result = []
  var threshold = minimumOpportunities === undefined ? 3 : minimumOpportunities
  for (var name in table) {
    var row = table[name]
    if (row.opportunities < threshold || row.totalErrors <= 0) continue
    row.errorRate = row.opportunities > 0 ? row.firstAttemptErrors / row.opportunities : 0
    var best = ""
    var bestCount = -1
    for (var replacement in row.replacements) {
      if (row.replacements[replacement] > bestCount) {
        best = replacement
        bestCount = row.replacements[replacement]
      }
    }
    row.mostCommonSubstitution = best
    delete row.replacements
    result.push(row)
  }
  result.sort(function(a, b) {
    if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate
    if (b.totalErrors !== a.totalErrors) return b.totalErrors - a.totalErrors
    return b.opportunities - a.opportunities
  })
  return result
}

function characterStats(events, opportunities, options) {
  var table = {}
  var chance = opportunities || {}

  function normalized(character) {
    return Normalization.normalizeCharacter(character, options || {})
  }

  function ensure(character) {
    var value = normalized(character)
    if (!value || /\s/.test(value) || value === "\u200c") return null
    if (!table[value]) {
      table[value] = {
        character: value,
        opportunities: 0,
        firstAttemptErrors: 0,
        totalErrors: 0
      }
    }
    return table[value]
  }

  for (var character in chance) {
    var opportunityRow = ensure(character)
    if (opportunityRow) opportunityRow.opportunities += Math.max(0, Math.round(Number(chance[character]) || 0))
  }

  var source = Array.isArray(events) ? events : []
  for (var index = 0; index < source.length; index++) {
    var event = source[index] || {}
    var errorRow = ensure(event.expected)
    if (!errorRow) continue
    errorRow.totalErrors++
    if (event.firstAttempt !== false) errorRow.firstAttemptErrors++
  }

  var result = []
  for (var name in table) result.push(table[name])
  result.sort(function(a, b) { return String(a.character).localeCompare(String(b.character)) })
  return result
}
