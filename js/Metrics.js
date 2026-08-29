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
  if (Math.max(0, typedLength) >= String(expected || "").length) return matches.length
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

function difficultBigrams(expected, events, opportunityPositions, options, includeCorrected, maximumRows) {
  var characters = Normalization.characters(expected)
  var seen = opportunityPositions || {}
  var table = {}

  function keyAt(position) {
    if (position <= 0 || position >= characters.length) return ""
    var first = Normalization.normalizeCharacter(characters[position - 1], options || {})
    var second = Normalization.normalizeCharacter(characters[position], options || {})
    if (!first || !second || /\s/.test(first) || /\s/.test(second)
        || first === "\u200c" || second === "\u200c") return ""
    return first + second
  }

  for (var position = 1; position < characters.length; position++) {
    if (!seen[position]) continue
    var bigram = keyAt(position)
    if (!bigram) continue
    if (!table[bigram]) table[bigram] = { bigram: bigram, opportunities: 0, firstAttemptErrors: 0, totalErrors: 0 }
    table[bigram].opportunities++
  }

  var source = Array.isArray(events) ? events : []
  for (var eventIndex = 0; eventIndex < source.length; eventIndex++) {
    var event = source[eventIndex] || {}
    if (event.corrected && !includeCorrected) continue
    var eventBigram = keyAt(Math.round(Number(event.position) || 0))
    if (!eventBigram) continue
    if (!table[eventBigram]) table[eventBigram] = { bigram: eventBigram, opportunities: 0, firstAttemptErrors: 0, totalErrors: 0 }
    table[eventBigram].totalErrors++
    if (event.firstAttempt !== false) table[eventBigram].firstAttemptErrors++
  }

  var result = []
  for (var name in table) {
    var row = table[name]
    if (row.totalErrors <= 0) continue
    row.errorRate = row.opportunities > 0 ? Math.min(1, row.firstAttemptErrors / row.opportunities) : 0
    result.push(row)
  }
  result.sort(function(a, b) {
    if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate
    if (b.totalErrors !== a.totalErrors) return b.totalErrors - a.totalErrors
    return b.opportunities - a.opportunities
  })
  return result.slice(0, Math.max(1, Math.round(Number(maximumRows) || 24)))
}

function analysisWord(value, options) {
  var word = Normalization.normalizeText(value, options || {}).trim().toLowerCase()
  word = word.replace(/^[.,!?;:()[\]{}'"«»،؛؟]+/, "").replace(/[.,!?;:()[\]{}'"«»،؛؟]+$/, "")
  if (!word || /\s/.test(word) || word.length > 48) return ""
  return word
}

function difficultWords(expected, events, opportunityPositions, options, includeCorrected, maximumRows) {
  var characters = Normalization.characters(expected)
  var seen = opportunityPositions || {}
  var occurrences = []
  var positionToOccurrence = {}
  var start = 0
  while (start < characters.length) {
    while (start < characters.length && /\s/.test(characters[start])) start++
    if (start >= characters.length) break
    var end = start + 1
    while (end < characters.length && !/\s/.test(characters[end])) end++
    var word = analysisWord(characters.slice(start, end).join(""), options)
    if (word) {
      var occurrence = { word: word, start: start, end: end, reached: false, firstError: false, totalErrors: 0 }
      var occurrenceIndex = occurrences.length
      for (var position = start; position < end; position++) {
        positionToOccurrence[position] = occurrenceIndex
        if (seen[position]) occurrence.reached = true
      }
      occurrences.push(occurrence)
    }
    start = end
  }

  var source = Array.isArray(events) ? events : []
  for (var eventIndex = 0; eventIndex < source.length; eventIndex++) {
    var event = source[eventIndex] || {}
    if (event.corrected && !includeCorrected) continue
    var mappedIndex = positionToOccurrence[Math.round(Number(event.position) || 0)]
    if (mappedIndex === undefined) continue
    occurrences[mappedIndex].totalErrors++
    if (event.firstAttempt !== false) occurrences[mappedIndex].firstError = true
  }

  var table = {}
  for (var occurrenceIndex = 0; occurrenceIndex < occurrences.length; occurrenceIndex++) {
    var current = occurrences[occurrenceIndex]
    if (!table[current.word]) table[current.word] = { word: current.word, opportunities: 0, errorOccurrences: 0, totalErrors: 0 }
    if (current.reached) table[current.word].opportunities++
    if (current.firstError) table[current.word].errorOccurrences++
    table[current.word].totalErrors += current.totalErrors
  }

  var result = []
  for (var name in table) {
    var row = table[name]
    if (row.totalErrors <= 0) continue
    row.errorRate = row.opportunities > 0 ? Math.min(1, row.errorOccurrences / row.opportunities) : 0
    result.push(row)
  }
  result.sort(function(a, b) {
    if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate
    if (b.totalErrors !== a.totalErrors) return b.totalErrors - a.totalErrors
    return b.opportunities - a.opportunities
  })
  return result.slice(0, Math.max(1, Math.round(Number(maximumRows) || 24)))
}

function hesitationStats(events, options, maximumRows) {
  var table = {}
  var source = Array.isArray(events) ? events : []
  for (var index = 0; index < source.length; index++) {
    var event = source[index] || {}
    var character = Normalization.normalizeCharacter(event.character, options || {})
    var delay = Math.max(0, Math.min(60000, Number(event.delayMs) || 0))
    if (!character || /\s/.test(character) || character === "\u200c" || delay < 1000) continue
    if (!table[character]) table[character] = { character: character, count: 0, totalDelayMs: 0, maxDelayMs: 0 }
    table[character].count++
    table[character].totalDelayMs += delay
    table[character].maxDelayMs = Math.max(table[character].maxDelayMs, delay)
  }
  var result = []
  for (var name in table) {
    table[name].averageDelayMs = table[name].count > 0 ? table[name].totalDelayMs / table[name].count : 0
    result.push(table[name])
  }
  result.sort(function(a, b) {
    if (b.count !== a.count) return b.count - a.count
    return b.averageDelayMs - a.averageDelayMs
  })
  return result.slice(0, Math.max(1, Math.round(Number(maximumRows) || 24)))
}

function keyTimingStats(timingEvents, errorEvents, opportunities, options) {
  var table = {}

  function ensure(character) {
    var value = Normalization.normalizeCharacter(character, options || {})
    if (!value || /\s/.test(value) || value === "\u200c") return null
    if (!table[value]) table[value] = {
      character: value,
      opportunities: 0,
      firstAttemptErrors: 0,
      totalErrors: 0,
      timedAttempts: 0,
      totalIntervalMs: 0,
      maxIntervalMs: 0
    }
    return table[value]
  }

  var chances = opportunities || {}
  for (var character in chances) {
    var opportunityRow = ensure(character)
    if (opportunityRow) opportunityRow.opportunities += Math.max(0, Math.round(Number(chances[character]) || 0))
  }

  var errors = Array.isArray(errorEvents) ? errorEvents : []
  for (var errorIndex = 0; errorIndex < errors.length; errorIndex++) {
    var errorRow = ensure(errors[errorIndex] && errors[errorIndex].expected)
    if (!errorRow) continue
    errorRow.totalErrors++
    if (errors[errorIndex].firstAttempt !== false) errorRow.firstAttemptErrors++
  }

  var timings = Array.isArray(timingEvents) ? timingEvents : []
  for (var timingIndex = 0; timingIndex < timings.length; timingIndex++) {
    var timingRow = ensure(timings[timingIndex] && timings[timingIndex].character)
    var interval = Math.max(0, Math.min(60000, Number(timings[timingIndex] && timings[timingIndex].intervalMs) || 0))
    if (!timingRow || interval <= 0) continue
    timingRow.timedAttempts++
    timingRow.totalIntervalMs += interval
    timingRow.maxIntervalMs = Math.max(timingRow.maxIntervalMs, interval)
  }

  var result = []
  for (var name in table) {
    var row = table[name]
    row.errorRate = row.opportunities > 0 ? Math.min(1, row.firstAttemptErrors / row.opportunities) : 0
    row.averageIntervalMs = row.timedAttempts > 0 ? row.totalIntervalMs / row.timedAttempts : 0
    row.speedCpm = row.averageIntervalMs > 0 ? 60000 / row.averageIntervalMs : 0
    result.push(row)
  }
  result.sort(function(a, b) { return String(a.character).localeCompare(String(b.character)) })
  return result
}
