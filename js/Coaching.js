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
    var value = rows[index] && rows[index][field]
    if (value === null || value === undefined || !isFinite(Number(value))) continue
    total += Number(value)
    count++
  }
  return count > 0 ? total / count : null
}

function comparableBaseline(result, history) {
  if (!result) return []
  var preferred = []
  var source = Array.isArray(history) ? history : []
  for (var index = 0; index < source.length; index++) {
    var row = source[index]
    if (!row || row.id === result.id || row.language !== result.language) continue
    var testType = String(result.testType || "timed")
    var sameLength = testType === "timed"
      ? Number(row.configuredDurationSeconds || 0) === Number(result.configuredDurationSeconds || 0)
      : testType === "words"
        ? Number(row.targetWordCount || 0) === Number(result.targetWordCount || 0)
        : true
    if (String(row.testType || "timed") === testType && sameLength
        && String(row.mode || "standard") === String(result.mode || "standard")) preferred.push(row)
  }
  return preferred.slice(0, 5)
}

function displayCharacter(value) {
  var character = String(value === undefined || value === null ? "" : value)
  if (character === " ") return "Space"
  if (character === "") return "a missing character"
  return character
}

function strongestSubstitution(result) {
  var rows = result && Array.isArray(result.substitutions) ? result.substitutions : []
  var best = null
  for (var index = 0; index < rows.length; index++) {
    var row = rows[index]
    if (!row || finiteNumber(row.count, 0) < 2) continue
    if (!best || finiteNumber(row.count, 0) > finiteNumber(best.count, 0)) best = row
  }
  return best
}

function aggregateRisk(result) {
  var words = result && Array.isArray(result.difficultWords) ? result.difficultWords : []
  if (words.length > 0) {
    var word = words[0]
    return {
      kind: "difficult-word",
      text: "The word “" + String(word.word || "") + "” caused errors in "
        + Math.round(finiteNumber(word.errorOccurrences, 0)) + " of "
        + Math.round(finiteNumber(word.opportunities, 0)) + " attempts."
    }
  }
  var bigrams = result && Array.isArray(result.difficultBigrams) ? result.difficultBigrams : []
  if (bigrams.length > 0) {
    var bigram = bigrams[0]
    return {
      kind: "difficult-bigram",
      text: "The character pair “" + String(bigram.bigram || "") + "” was your strongest recurring error pattern ("
        + (finiteNumber(bigram.errorRate, 0) * 100).toFixed(0) + "% first-attempt error rate)."
    }
  }
  var hesitations = result && Array.isArray(result.hesitationStats) ? result.hesitationStats : []
  if (hesitations.length > 0) {
    var hesitation = hesitations[0]
    return {
      kind: "hesitation",
      text: "You paused before “" + displayCharacter(hesitation.character) + "” "
        + Math.round(finiteNumber(hesitation.count, 0)) + " time"
        + (Math.round(finiteNumber(hesitation.count, 0)) === 1 ? "" : "s") + ", averaging "
        + (finiteNumber(hesitation.averageDelayMs, 0) / 1000).toFixed(1) + " seconds."
    }
  }
  return null
}

function adaptiveLabels(analysis) {
  var labels = []
  var sources = [
    analysis && analysis.characters,
    analysis && analysis.bigrams,
    analysis && analysis.words,
    analysis && analysis.hesitationCharacters
  ]
  for (var sourceIndex = 0; sourceIndex < sources.length && labels.length < 3; sourceIndex++) {
    var source = Array.isArray(sources[sourceIndex]) ? sources[sourceIndex] : []
    for (var index = 0; index < source.length && labels.length < 3; index++) {
      var label = String(source[index] || "")
      if (label && labels.indexOf(label) < 0) labels.push(label)
    }
  }
  return labels
}

function paceDrop(result) {
  var samples = result && Array.isArray(result.wpmSamples) ? result.wpmSamples : []
  if (samples.length < 4) return null
  var middle = Math.floor(samples.length / 2)
  var first = average(samples.slice(0, middle), "grossWpm")
  var second = average(samples.slice(middle), "grossWpm")
  if (first === null || second === null || first <= 0) return null
  return second / first <= 0.85 ? (1 - second / first) * 100 : null
}

function sourceCharacterStats(result) {
  if (result && Array.isArray(result.characterStats) && result.characterStats.length > 0) return result.characterStats
  return result && Array.isArray(result.difficultCharacters) ? result.difficultCharacters : []
}

function findCharacterStat(result, character) {
  var stats = sourceCharacterStats(result)
  for (var index = 0; index < stats.length; index++) {
    if (String(stats[index] && stats[index].character || "") === String(character || "")) return stats[index]
  }
  return null
}

function adaptiveTargetChange(result, baseline) {
  var targets = result && Array.isArray(result.adaptiveTargets) ? result.adaptiveTargets : []
  var best = null
  for (var targetIndex = 0; targetIndex < targets.length; targetIndex++) {
    var character = targets[targetIndex]
    var current = findCharacterStat(result, character)
    var currentOpportunities = Math.max(0, finiteNumber(current && current.opportunities, 0))
    var currentErrors = Math.max(0, finiteNumber(current && current.firstAttemptErrors, 0))
    if (currentOpportunities < 3) continue
    var baselineOpportunities = 0
    var baselineErrors = 0
    for (var resultIndex = 0; resultIndex < baseline.length; resultIndex++) {
      var historical = findCharacterStat(baseline[resultIndex], character)
      baselineOpportunities += Math.max(0, finiteNumber(historical && historical.opportunities, 0))
      baselineErrors += Math.max(0, finiteNumber(historical && historical.firstAttemptErrors, finiteNumber(historical && historical.totalErrors, 0)))
    }
    if (baselineOpportunities < 8) continue
    var currentRate = currentErrors / currentOpportunities
    var baselineRate = baselineErrors / baselineOpportunities
    var delta = currentRate - baselineRate
    if (Math.abs(delta) < 0.05) continue
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { character: character, delta: delta }
  }
  if (!best) return null
  return {
    kind: "adaptive-target",
    positive: best.delta < 0,
    text: "Errors on adaptive target " + best.character + " " + (best.delta < 0 ? "improved" : "increased")
      + " by " + Math.abs(best.delta * 100).toFixed(1) + " points against your recent baseline."
  }
}

function recommendation(result, adaptiveAnalysis) {
  var language = result && result.language === "fa" ? "fa" : "en"
  var testType = String(result && result.testType || "timed")
  var duration = Math.max(15, Math.round(finiteNumber(result && result.configuredDurationSeconds, 60)))
  var durationText = duration < 60
    ? duration + "-second"
    : (duration % 60 === 0 ? (duration / 60) + "-minute" : Math.floor(duration / 60) + "-minute")
  if (adaptiveAnalysis && adaptiveAnalysis.available) {
    var adaptiveTestType = testType === "words" ? "words" : "timed"
    var adaptiveWordCount = adaptiveTestType === "words"
      ? Math.max(10, Math.round(finiteNumber(result && result.targetWordCount, 25))) : 0
    var targetLabels = adaptiveLabels(adaptiveAnalysis)
    return {
      mode: "adaptive",
      language: language,
      testType: adaptiveTestType,
      durationSeconds: adaptiveTestType === "timed" ? Math.min(180, duration) : 0,
      targetWordCount: adaptiveWordCount,
      targets: adaptiveAnalysis.characters || [],
      bigrams: adaptiveAnalysis.bigrams || [],
      words: adaptiveAnalysis.words || [],
      hesitationCharacters: adaptiveAnalysis.hesitationCharacters || [],
      text: "Try a " + (adaptiveTestType === "words" ? adaptiveWordCount + "-word"
          : (Math.min(180, duration) < 60 ? Math.min(180, duration) + "-second" : (Math.min(180, duration) / 60) + "-minute")) + " adaptive "
        + (language === "fa" ? "Parsi" : "English") + " test targeting "
        + targetLabels.join(language === "fa" ? "، " : ", ") + "."
    }
  }
  return {
    mode: "standard",
    language: language,
    durationSeconds: duration,
    testType: testType,
    targetWordCount: testType === "words" ? Math.max(10, Math.round(finiteNumber(result && result.targetWordCount, 25))) : 0,
    targets: [],
    text: "Continue with another " + (testType === "words"
        ? Math.max(10, Math.round(finiteNumber(result && result.targetWordCount, 25))) + "-word"
        : testType === "passage" ? "passage-completion" : durationText)
      + " standard " + (language === "fa" ? "Parsi" : "English")
      + " test to build a stronger practice baseline."
  }
}

function summarize(result, history, adaptiveAnalysis) {
  if (!result) return { messages: [], baselineCount: 0, recommendation: null }
  var baseline = comparableBaseline(result, history)
  var risks = []
  var changes = []
  var baselineReady = baseline.length >= 3

  var substitution = strongestSubstitution(result)
  var patternRisk = aggregateRisk(result)
  if (patternRisk) risks.push(patternRisk)
  if (substitution) {
    risks.push({
      kind: "substitution",
      text: "Your most repeated substitution was " + displayCharacter(substitution.expected)
        + " → " + displayCharacter(substitution.actual) + " (" + Math.round(finiteNumber(substitution.count, 0)) + " times)."
    })
  }

  var evaluated = Math.max(1, finiteNumber(result.correctKeystrokes, 0) + finiteNumber(result.incorrectKeystrokes, 0))
  var backspaceRatio = finiteNumber(result.backspaces, 0) / evaluated
  if (backspaceRatio >= 0.15) {
    risks.push({
      kind: "backspaces",
      text: "Backspace use was high; slow down slightly and aim for clean first attempts."
    })
  }

  var drop = paceDrop(result)
  if (drop !== null) {
    risks.push({
      kind: "pace",
      text: "Your pace fell about " + Math.round(drop) + "% in the second half; try a steadier rhythm."
    })
  }

  if (baselineReady) {
    var targetChange = adaptiveTargetChange(result, baseline)
    if (targetChange) changes.push(targetChange)

    var accuracyBaseline = average(baseline, "accuracy")
    var accuracyDelta = finiteNumber(result.accuracy, 0) - finiteNumber(accuracyBaseline, finiteNumber(result.accuracy, 0))
    if (Math.abs(accuracyDelta) >= 2) {
      changes.push({
        kind: "accuracy",
        positive: accuracyDelta > 0,
        text: "Accuracy " + (accuracyDelta > 0 ? "improved" : "fell") + " by "
          + Math.abs(accuracyDelta).toFixed(1) + " points compared with your recent average."
      })
    }

    var speedBaseline = average(baseline, "netWpm")
    var currentSpeed = finiteNumber(result.netWpm, 0)
    var speedPercent = speedBaseline && speedBaseline > 0 ? (currentSpeed - speedBaseline) / speedBaseline * 100 : 0
    if (Math.abs(speedPercent) >= 5) {
      changes.push({
        kind: "speed",
        positive: speedPercent > 0,
        text: "Net speed was " + Math.abs(speedPercent).toFixed(0) + "% "
          + (speedPercent > 0 ? "above" : "below") + " your recent average."
      })
    }

    if (result.consistency !== null && result.consistency !== undefined) {
      var consistencyBaseline = average(baseline, "consistency")
      if (consistencyBaseline !== null) {
        var consistencyDelta = finiteNumber(result.consistency, 0) - consistencyBaseline
        if (Math.abs(consistencyDelta) >= 5) {
          changes.push({
            kind: "consistency",
            positive: consistencyDelta > 0,
            text: "Consistency " + (consistencyDelta > 0 ? "improved" : "fell") + " by "
              + Math.abs(consistencyDelta).toFixed(1) + " points."
          })
        }
      }
    }
  }

  var next = recommendation(result, adaptiveAnalysis)
  var messages = []
  if (risks.length > 0) messages.push(risks[0])
  if (changes.length > 0) messages.push(changes[0])
  if (messages.length < 3 && next) messages.push({ kind: "recommendation", text: next.text })

  return {
    messages: messages.slice(0, 3),
    baselineCount: baseline.length,
    baselineReady: baselineReady,
    recommendation: next
  }
}
