import QtQuick
import QtQuick.Layouts
import QtQuick.Controls
import qs.Commons
import qs.Ui
import "../js/Normalization.js" as Normalization
import "../js/Metrics.js" as Metrics
import "../js/PassageLoader.js" as PassageLoader
import "../js/Pagination.js" as Pagination
import "../js/AdaptivePractice.js" as AdaptivePractice

Item {
  id: root

  property var store: null
  property var library: null
  property string fontFamily: Style.font.family
  property var options: ({})
  property string expectedText: ""
  property string typedText: ""
  property var passageIds: []
  property bool running: false
  property bool hasTyped: typedText.length > 0 || totalEntered > 0
  property double startedMs: 0
  property double elapsedSeconds: 0
  property double remainingSeconds: Number(options.durationSeconds || 60)
  property int totalEntered: 0
  property int correctAttempts: 0
  property int backspaces: 0
  property var errorEvents: []
  property var attemptedPositions: ({})
  property var opportunityPositions: ({})
  property var opportunities: ({})
  property var wpmSamples: []
  property int lastSampleSecond: 0
  property bool suppressInput: false
  property int passagePageStart: 0
  property int passagePageEnd: 0
  property bool passagePageReady: false
  property bool pageLayoutPending: false
  property bool pageResetPending: false
  property string errorMessage: ""
  property var confirmationKeyHandler: null

  readonly property var normalizationOptions: store ? store.settings : ({})
  readonly property var currentEvaluation: Metrics.evaluateFinal(expectedText, typedText, normalizationOptions)
  readonly property var liveMetrics: Metrics.calculate(totalEntered, correctAttempts, currentEvaluation.incorrect, Math.max(elapsedSeconds, 0.001), Metrics.completedWordCount(expectedText, Normalization.characters(typedText).length))

  signal completed(var result)
  signal cancelRequested()
  signal restartRequested()

  function start(testOptions) {
    var nextOptions = {}
    for (var optionKey in (testOptions || {})) nextOptions[optionKey] = testOptions[optionKey]
    nextOptions.mode = nextOptions.mode === "adaptive" ? "adaptive" : "standard"
    if (!Array.isArray(nextOptions.adaptiveTargets)) nextOptions.adaptiveTargets = []
    if (!Array.isArray(nextOptions.recentPassageIds)) nextOptions.recentPassageIds = []
    options = nextOptions
    var target = Math.max(1000, Math.ceil(Number(options.durationSeconds || 60) / 60 * 700))
    var difficult = []
    if (options.category === "difficult" && store) {
      var counts = {}
      for (var historyIndex = 0; historyIndex < store.history.length; historyIndex++) {
        var historical = store.history[historyIndex]
        if (historical.language !== (options.language || "en")) continue
        for (var difficultIndex = 0; difficultIndex < (historical.difficultCharacters || []).length; difficultIndex++) {
          var character = historical.difficultCharacters[difficultIndex].character
          counts[character] = (counts[character] || 0) + Number(historical.difficultCharacters[difficultIndex].totalErrors || 0)
        }
      }
      difficult = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a] })
    }
    var built
    if (options.mode === "adaptive") {
      var adaptiveTargets = options.adaptiveTargets
      if (adaptiveTargets.length === 0 && store) {
        adaptiveTargets = AdaptivePractice.rankTargets(store.history, options.language || "en", store.settings).characters
        options.adaptiveTargets = adaptiveTargets
      }
      if (adaptiveTargets.length > 0) {
        built = AdaptivePractice.buildAdaptiveTest(library ? library.passages : [], options.language || "en",
          adaptiveTargets, target, options.recentPassageIds)
        if (!built.text || Number(built.matchedPassages || 0) <= 0) {
          options.mode = "standard"
          options.adaptiveTargets = []
          built = PassageLoader.buildTest(library ? library.passages : [], options.language || "en",
            "mixed", "mixed", target)
        }
      } else {
        options.mode = "standard"
        built = PassageLoader.buildTest(library ? library.passages : [], options.language || "en",
          "common", "mixed", target)
      }
    } else {
      built = options.category === "difficult"
        ? PassageLoader.buildDifficultTest(library ? library.passages : [], options.language || "en", difficult, target)
        : PassageLoader.buildTest(library ? library.passages : [], options.language || "en", options.category || "common", options.difficulty || "mixed", target)
    }
    expectedText = built.text
    if (store && store.settings.zwnjCountsAsError === false) expectedText = expectedText.replace(/\u200c/g, "")
    passageIds = built.passageIds
    typedText = ""
    running = false
    startedMs = 0
    elapsedSeconds = 0
    remainingSeconds = Number(options.durationSeconds || 60)
    totalEntered = 0
    correctAttempts = 0
    backspaces = 0
    errorEvents = []
    attemptedPositions = ({})
    opportunityPositions = ({})
    opportunities = ({})
    wpmSamples = []
    lastSampleSecond = 0
    errorMessage = expectedText ? "" : "No passages matched these options."
    suppressInput = true
    input.text = ""
    suppressInput = false
    passagePageStart = 0
    passagePageEnd = 0
    passagePageReady = false
    schedulePageLayout(true)
    Qt.callLater(function() { input.forceActiveFocus() })
  }

  function beginTiming() {
    if (running || !expectedText) return
    startedMs = Date.now()
    running = true
  }

  function restoreTypingFocus() {
    input.forceActiveFocus()
  }

  function markRemoved(fromPosition) {
    var changed = false
    var next = errorEvents.slice()
    for (var i = next.length - 1; i >= 0; i--) {
      if (!next[i].corrected && Number(next[i].position) >= fromPosition) {
        var copy = {}
        for (var key in next[i]) copy[key] = next[i][key]
        copy.corrected = true
        next[i] = copy
        changed = true
      }
    }
    if (changed) errorEvents = next
  }

  function syncText(value) {
    if (suppressInput) return
    var oldChars = Normalization.characters(typedText)
    var newChars = Normalization.characters(value)
    var expectedChars = Normalization.characters(expectedText)
    var common = 0
    while (common < oldChars.length && common < newChars.length && oldChars[common] === newChars[common]) common++

    if (newChars.length < oldChars.length || common < oldChars.length) {
      backspaces += Math.max(1, oldChars.length - newChars.length)
      markRemoved(common)
    }

    var newEvents = errorEvents.slice()
    var attempts = {}
    for (var attemptedKey in attemptedPositions) attempts[attemptedKey] = attemptedPositions[attemptedKey]
    var seen = {}
    for (var seenKey in opportunityPositions) seen[seenKey] = opportunityPositions[seenKey]
    var chance = {}
    for (var chanceKey in opportunities) chance[chanceKey] = opportunities[chanceKey]

    for (var i = common; i < newChars.length; i++) {
      if (i >= expectedChars.length) break
      beginTiming()
      totalEntered++
      var expected = expectedChars[i]
      var actual = newChars[i]
      if (!seen[i]) {
        chance[expected] = (chance[expected] || 0) + 1
        seen[i] = true
      }
      var firstAttempt = !attempts[i]
      attempts[i] = true
      if (Normalization.equivalent(expected, actual, normalizationOptions)) {
        correctAttempts++
      } else {
        newEvents.push({
          position: i,
          expected: expected,
          actual: actual,
          corrected: false,
          firstAttempt: firstAttempt,
          elapsedSeconds: running ? (Date.now() - startedMs) / 1000 : 0
        })
      }
    }

    attemptedPositions = attempts
    opportunityPositions = seen
    opportunities = chance
    errorEvents = newEvents
    typedText = newChars.slice(0, expectedChars.length).join("")
    if (passagePageReady) updatePassagePage(false)
    else schedulePageLayout(true)
    if (value !== typedText) {
      suppressInput = true
      input.text = typedText
      input.cursorPosition = input.text.length
      suppressInput = false
    }
    if (newChars.length >= expectedChars.length && expectedChars.length > 0) finish()
  }

  function finish() {
    if (!hasTyped) return
    if (running) {
      elapsedSeconds = Math.min(Number(options.durationSeconds || 60), Math.max(0.001, (Date.now() - startedMs) / 1000))
      running = false
    }
    var finalEvaluation = Metrics.evaluateFinal(expectedText, typedText, normalizationOptions)
    var correctedCount = 0
    for (var i = 0; i < errorEvents.length; i++) if (errorEvents[i].corrected) correctedCount++
    var values = Metrics.calculate(totalEntered, correctAttempts, finalEvaluation.incorrect, elapsedSeconds, Metrics.completedWordCount(expectedText, Normalization.characters(typedText).length))
    var includeCorrected = store ? store.settings.includeCorrectedErrorsInDifficulty !== false : true
    var result = {
      schemaVersion: 2,
      id: String(Date.now()) + "-" + Math.floor(Math.random() * 1000000),
      startedAt: new Date(startedMs || Date.now()).toISOString(),
      completedAt: new Date().toISOString(),
      language: options.language || "en",
      mode: options.mode === "adaptive" ? "adaptive" : "standard",
      durationSeconds: elapsedSeconds,
      configuredDurationSeconds: Number(options.durationSeconds || 60),
      category: options.mode === "adaptive" ? "mixed" : (options.category || "common"),
      difficulty: options.mode === "adaptive" ? "mixed" : (options.difficulty || "mixed"),
      grossWpm: values.grossWpm,
      netWpm: values.netWpm,
      literalWpm: values.literalWpm,
      accuracy: values.accuracy,
      consistency: Metrics.consistency(wpmSamples),
      correctKeystrokes: correctAttempts,
      incorrectKeystrokes: errorEvents.length,
      correctedErrors: correctedCount,
      uncorrectedErrors: finalEvaluation.incorrect,
      backspaces: backspaces,
      passageIds: passageIds,
      adaptiveTargets: options.mode === "adaptive" ? options.adaptiveTargets : [],
      characterStats: Metrics.characterStats(errorEvents, opportunities, normalizationOptions),
      difficultCharacters: Metrics.difficultCharacters(errorEvents, opportunities, includeCorrected, 3),
      substitutions: Metrics.substitutions(errorEvents, includeCorrected),
      wpmSamples: wpmSamples
    }
    completed(result)
  }

  function timeText(seconds) {
    var whole = Math.max(0, Math.ceil(seconds))
    return String(Math.floor(whole / 60)).padStart(2, "0") + ":" + String(whole % 60).padStart(2, "0")
  }

  function htmlEscape(character) {
    if (character === "&") return "&amp;"
    if (character === "<") return "&lt;"
    if (character === ">") return "&gt;"
    if (character === "\n") return "<br>"
    return character
  }

  function htmlEscapeText(value) {
    var characters = Normalization.characters(value)
    var escaped = ""
    for (var i = 0; i < characters.length; i++) escaped += htmlEscape(characters[i])
    return escaped
  }

  function passageHtml() {
    var expected = Normalization.characters(expectedText)
    var typed = Normalization.characters(typedText)
    var current = typed.length
    var start = Math.max(0, Math.min(passagePageStart, expected.length))
    var pageEnd = Math.max(start, Math.min(passagePageEnd, expected.length))
    var direction = options.language === "fa" ? "rtl" : "ltr"
    var html = "<div dir='" + direction + "' style='white-space:pre-wrap'>"
    var index = start
    var typedEnd = Math.min(current, pageEnd)
    while (index < typedEnd) {
      var correct = Normalization.equivalent(expected[index], typed[index], normalizationOptions)
      var end = index + 1
      while (end < typedEnd
             && Normalization.equivalent(expected[end], typed[end], normalizationOptions) === correct) end++
      var style = correct
        ? "color:" + String(Color.foreground)
        : "color:" + String(Color.urgent) + ";text-decoration:underline"
      html += "<span style='" + style + "'>" + htmlEscapeText(expected.slice(index, end).join("")) + "</span>"
      index = end
    }
    if (current >= start && current < pageEnd) {
      html += "<span style='color:" + String(Color.background) + ";background-color:" + String(Color.accent) + "'>" + htmlEscape(expected[current]) + "</span>"
      if (current + 1 < pageEnd)
        html += "<span style='color:" + String(Color.muted) + "'>" + htmlEscapeText(expected.slice(current + 1, pageEnd).join("")) + "</span>"
    } else if (current < start && start < pageEnd) {
      html += "<span style='color:" + String(Color.muted) + "'>" + htmlEscapeText(expected.slice(start, pageEnd).join("")) + "</span>"
    }
    return html + "</div>"
  }

  function passageMeasurementHtml(start, end) {
    var expected = Normalization.characters(expectedText)
    var direction = options.language === "fa" ? "rtl" : "ltr"
    return "<div dir='" + direction + "' style='white-space:pre-wrap'>"
      + htmlEscapeText(expected.slice(start, end).join("")) + "</div>"
  }

  function calculatePageEnd(start) {
    var expected = Normalization.characters(expectedText)
    if (start >= expected.length) return expected.length
    if (passagePage.width <= 0 || passagePage.height <= 0) return expected.length

    var low = start + 1
    var high = expected.length
    var fittingEnd = start + 1
    while (low <= high) {
      var middle = Math.floor((low + high) / 2)
      passageMeasure.text = passageMeasurementHtml(start, middle)
      passageMeasure.forceLayout()
      if (passageMeasure.contentHeight <= passagePage.height + 0.5) {
        fittingEnd = middle
        low = middle + 1
      } else {
        high = middle - 1
      }
    }

    return Pagination.wordBoundaryEnd(expected, start, fittingEnd)
  }

  function updatePassagePage(reset) {
    var expected = Normalization.characters(expectedText)
    if (expected.length === 0) {
      passagePageStart = 0
      passagePageEnd = 0
      passagePageReady = true
      return
    }
    if (passagePage.width <= 0 || passagePage.height <= 0) return

    var current = Math.min(Normalization.characters(typedText).length, expected.length)
    if (!reset && passagePageReady && current >= passagePageStart && current < passagePageEnd) return

    var start = (!reset && passagePageReady && current >= passagePageStart)
      ? passagePageStart
      : 0
    var end = (!reset && passagePageReady && current >= passagePageStart)
      ? passagePageEnd
      : calculatePageEnd(start)

    while (current >= end && end < expected.length) {
      start = end
      end = calculatePageEnd(start)
    }

    passagePageStart = start
    passagePageEnd = Math.min(expected.length, Math.max(start + 1, end))
    passagePageReady = true
  }

  function schedulePageLayout(reset) {
    if (reset) pageResetPending = true
    if (pageLayoutPending) return
    pageLayoutPending = true
    Qt.callLater(function() {
      pageLayoutPending = false
      var shouldReset = pageResetPending
      pageResetPending = false
      updatePassagePage(shouldReset)
    })
  }

  Timer {
    interval: 100
    repeat: true
    running: root.running
    onTriggered: {
      root.elapsedSeconds = (Date.now() - root.startedMs) / 1000
      root.remainingSeconds = Math.max(0, Number(root.options.durationSeconds || 60) - root.elapsedSeconds)
      var sampleSecond = Math.floor(root.elapsedSeconds / 5) * 5
      if (sampleSecond >= 5 && sampleSecond > root.lastSampleSecond) {
        root.lastSampleSecond = sampleSecond
        var samples = root.wpmSamples.slice()
        samples.push({ elapsedSeconds: sampleSecond, grossWpm: root.liveMetrics.grossWpm })
        root.wpmSamples = samples
      }
      if (root.remainingSeconds <= 0) root.finish()
    }
  }

  ColumnLayout {
    anchors.fill: parent
    spacing: Style.spacing.lg

    Item {
      Layout.fillWidth: true
      Layout.preferredHeight: Math.max(statusText.implicitHeight, liveStats.implicitHeight, timerText.implicitHeight)

      Text {
        id: statusText

        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        text: root.running ? "TYPING" : "READY"
        color: root.running ? Color.accent : Color.muted
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
        font.letterSpacing: 1.5
      }

      Row {
        id: liveStats

        readonly property bool showWpm: root.store && root.store.settings.showLiveWpm !== false
        readonly property bool showAccuracy: root.store && root.store.settings.showLiveAccuracy !== false

        visible: showWpm || showAccuracy
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.spacing.xl

        Column {
          visible: liveStats.showWpm
          spacing: 0

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.liveMetrics.grossWpm.toFixed(1)
            color: Color.accent
            font.family: root.fontFamily
            font.pixelSize: Style.font.display
            font.bold: true
          }

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "WPM"
            color: Color.muted
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 1.2
          }
        }

        Rectangle {
          visible: liveStats.showWpm && liveStats.showAccuracy
          anchors.verticalCenter: parent.verticalCenter
          width: Math.max(1, Style.normalBorderWidth)
          height: Style.space(36)
          color: Style.normalBorderFor(Color.foreground, Color.accent)
        }

        Column {
          visible: liveStats.showAccuracy
          spacing: 0

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.liveMetrics.accuracy.toFixed(1) + "%"
            color: Color.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.display
            font.bold: true
          }

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "ACCURACY"
            color: Color.muted
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 1.2
          }
        }
      }

      Text {
        id: timerText

        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        text: root.timeText(root.remainingSeconds)
        color: Color.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.display
        font.bold: true
      }
    }

    Text {
      visible: root.options.mode === "adaptive"
      text: "ADAPTIVE  ·  " + (root.options.adaptiveTargets || []).join("  ")
      color: Color.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      elide: Text.ElideRight
      horizontalAlignment: Text.AlignHCenter
      Layout.fillWidth: true
    }

    BorderSurface {
      Layout.fillWidth: true
      Layout.fillHeight: true
      color: Style.normalFillFor(Color.foreground, Color.accent)
      borderSpec: Border.controlSpec(input.activeFocus ? "focus" : "normal", Color.foreground, Color.accent)
      radius: Style.cornerRadius
      padding: Style.spacing.lg

      Item {
        id: passagePage
        anchors.fill: parent
        anchors.margins: parent.padding
        clip: true
        onWidthChanged: root.schedulePageLayout(true)
        onHeightChanged: root.schedulePageLayout(true)

        Text {
          id: passageText
          width: passagePage.width
          height: implicitHeight
          text: root.errorMessage || (root.passagePageReady ? root.passageHtml() : "")
          textFormat: Text.RichText
          color: root.errorMessage ? Color.urgent : Color.foreground
          font.family: root.fontFamily
          font.pixelSize: Math.max(Style.font.heading, Style.space(22))
          lineHeight: 1.55
          wrapMode: Text.WordWrap
          horizontalAlignment: root.options.language === "fa" ? Text.AlignRight : Text.AlignLeft
          verticalAlignment: Text.AlignTop
        }

        Text {
          id: passageMeasure
          visible: false
          width: passagePage.width
          text: ""
          textFormat: Text.RichText
          font.family: passageText.font.family
          font.pixelSize: passageText.font.pixelSize
          lineHeight: passageText.lineHeight
          wrapMode: Text.WordWrap
          horizontalAlignment: root.options.language === "fa" ? Text.AlignRight : Text.AlignLeft
        }
      }

      TextInput {
        id: input
        font.family: root.fontFamily
        width: 2
        height: 2
        opacity: 0.01
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        focus: true
        maximumLength: root.expectedText.length
        inputMethodHints: Qt.ImhNoPredictiveText
        onTextEdited: root.syncText(text)
        Keys.priority: Keys.BeforeItem
        Keys.onPressed: function(event) {
          if (typeof root.confirmationKeyHandler === "function" && root.confirmationKeyHandler(event)) {
            event.accepted = true
            return
          }
          if (event.key === Qt.Key_Escape) { root.cancelRequested(); event.accepted = true }
          else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) { root.restartRequested(); event.accepted = true }
          else if (event.key === Qt.Key_Left || event.key === Qt.Key_Right || event.key === Qt.Key_Up || event.key === Qt.Key_Down || event.key === Qt.Key_Home || event.key === Qt.Key_End) { event.accepted = true }
        }
      }

      MouseArea {
        anchors.fill: parent
        cursorShape: Qt.IBeamCursor
        onClicked: input.forceActiveFocus()
      }
    }

    Text {
      text: "Start typing · Tab restarts · Esc exits"
      color: Color.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      Layout.alignment: Qt.AlignHCenter
    }
  }
}
