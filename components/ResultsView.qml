import QtQuick
import QtQuick.Layouts
import QtQuick.Controls
import qs.Commons
import qs.Ui
import "../js/AdaptivePractice.js" as AdaptivePractice
import "../js/Coaching.js" as Coaching

Item {
  id: root
  property var result: null
  property var store: null
  property string fontFamily: Style.font.family
  readonly property var adaptiveAnalysis: {
    if (store) store.historyRevision
    return AdaptivePractice.rankTargets(store ? store.history : [], root.value("language", "en"), store ? store.settings : {})
  }
  readonly property var coachingSummary: store && store.settings.coachingEnabled === false
    ? ({ messages: [], baselineCount: 0, recommendation: null })
    : Coaching.summarize(result, store ? store.history : [], adaptiveAnalysis)
  signal repeatRequested()
  signal newTestRequested()
  signal historyRequested()
  signal progressRequested()
  signal practiceRequested()

  function value(name, fallback) { return result && result[name] !== undefined && result[name] !== null ? result[name] : fallback }

  function durationLabel(seconds) {
    var value = Math.max(0, Math.round(Number(seconds) || 0))
    if (value < 60) return value + " SEC"
    if (value % 60 === 0) return (value / 60) + " MIN"
    return Math.floor(value / 60) + "M " + (value % 60) + "S"
  }

  function optionLabel(value) {
    var option = String(value || "mixed")
    if (option === "1") return "EASY"
    if (option === "2") return "MEDIUM"
    if (option === "3") return "HARD"
    return option.replace(/[-_]/g, " ").toUpperCase()
  }

  function displayCharacter(value) {
    var character = value === undefined || value === null ? "" : String(value)
    if (character === "") return "∅"
    if (character === " ") return "Space"
    if (character === "\t") return "Tab"
    if (character === "\n") return "Enter"
    return character
  }

  function sourceCharacterStats(value) {
    if (value && Array.isArray(value.characterStats) && value.characterStats.length > 0) return value.characterStats
    return value && Array.isArray(value.difficultCharacters) ? value.difficultCharacters : []
  }

  function findCharacterStat(value, character) {
    var rows = sourceCharacterStats(value)
    for (var index = 0; index < rows.length; index++) {
      if (String(rows[index].character || "") === String(character || "")) return rows[index]
    }
    return null
  }

  function adaptivePerformance() {
    var targets = value("adaptiveTargets", [])
    var output = []
    for (var targetIndex = 0; targetIndex < targets.length; targetIndex++) {
      var character = targets[targetIndex]
      var current = findCharacterStat(result, character)
      var opportunities = Number(current && current.opportunities || 0)
      var errors = Number(current && current.firstAttemptErrors || 0)
      var baselineOpportunities = 0
      var baselineErrors = 0
      var baselineTests = 0
      var history = store && Array.isArray(store.history) ? store.history : []
      for (var historyIndex = 0; historyIndex < history.length && baselineTests < 5; historyIndex++) {
        var historical = history[historyIndex]
        if (!historical || historical.id === value("id", "") || historical.language !== value("language", "en")) continue
        baselineTests++
        var stat = findCharacterStat(historical, character)
        baselineOpportunities += Number(stat && stat.opportunities || 0)
        baselineErrors += Number(stat && (stat.firstAttemptErrors !== undefined ? stat.firstAttemptErrors : stat.totalErrors) || 0)
      }
      var status = "building baseline"
      if (opportunities <= 0) status = "not reached"
      else if (opportunities >= 3 && baselineOpportunities >= 8) {
        var delta = errors / opportunities - baselineErrors / baselineOpportunities
        status = delta <= -0.05 ? "improved" : delta >= 0.05 ? "needs work" : "steady"
      }
      output.push({
        character: character,
        opportunities: opportunities,
        errors: errors,
        status: status
      })
    }
    return output
  }

  ScrollView {
    id: resultsScroll
    anchors.fill: parent
    clip: true
    contentWidth: availableWidth
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

    ColumnLayout {
      width: resultsScroll.availableWidth
      spacing: Style.spacing.md

      ColumnLayout {
        Layout.fillWidth: true
        spacing: Style.spacing.xs

        Text {
          text: "Test complete"
          color: Color.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.display
          font.bold: true
          Layout.fillWidth: true
        }

        Text {
          text: (root.value("language", "en") === "fa" ? "PARSI" : "ENGLISH")
            + "  ·  " + root.durationLabel(root.value("configuredDurationSeconds", root.value("durationSeconds", 0)))
            + "  ·  " + (root.value("mode", "standard") === "adaptive" ? "ADAPTIVE" : "STANDARD")
            + "  ·  " + root.optionLabel(root.value("category", "common"))
            + "  ·  " + root.optionLabel(root.value("difficulty", "mixed"))
          color: Color.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          Layout.fillWidth: true
        }
      }

      GridLayout {
        columns: width >= Style.space(700) ? 3 : 1
        columnSpacing: Style.spacing.md
        rowSpacing: Style.spacing.sm
        Layout.fillWidth: true

        MetricCard { prominent: true; fontFamily: root.fontFamily; label: "Net speed"; value: Number(root.value("netWpm", 0)).toFixed(1) + " WPM"; valueColor: Color.accent; Layout.fillWidth: true }
        MetricCard { prominent: true; fontFamily: root.fontFamily; label: "Accuracy"; value: Number(root.value("accuracy", 0)).toFixed(1) + "%"; Layout.fillWidth: true }
        MetricCard { prominent: true; fontFamily: root.fontFamily; label: "Consistency"; value: root.value("consistency", null) === null ? "—" : Number(root.value("consistency", 0)).toFixed(1) + "%"; Layout.fillWidth: true }
      }

      BorderSurface {
        visible: root.value("mode", "standard") === "adaptive"
        Layout.fillWidth: true
        Layout.preferredHeight: adaptiveTargetContent.implicitHeight + contentTopInset + contentBottomInset
        color: Style.normalFillFor(Color.foreground, Color.accent)
        borderSpec: Border.controlSpec("normal", Color.accent, Color.accent)
        radius: Style.cornerRadius
        padding: Style.spacing.md

        ColumnLayout {
          id: adaptiveTargetContent
          anchors.fill: parent
          anchors.topMargin: parent.contentTopInset
          anchors.rightMargin: parent.contentRightInset
          anchors.bottomMargin: parent.contentBottomInset
          anchors.leftMargin: parent.contentLeftInset
          spacing: Style.spacing.xs

          Text { text: "ADAPTIVE TARGETS"; color: Color.accent; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true; Layout.fillWidth: true }
          Repeater {
            model: root.adaptivePerformance()

            RowLayout {
              required property var modelData
              Layout.fillWidth: true

              Text {
                text: modelData.character
                color: Color.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.heading
                font.bold: true
                Layout.preferredWidth: Style.space(42)
              }

              Text {
                text: modelData.errors + " errors / " + modelData.opportunities + " opportunities"
                color: Color.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
                Layout.fillWidth: true
              }

              Text {
                text: String(modelData.status).toUpperCase()
                color: modelData.status === "improved" ? Color.accent
                  : modelData.status === "needs work" ? Color.urgent : Color.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
              }
            }
          }
        }
      }

      Text { text: "TEST DETAILS"; color: Color.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true }

      GridLayout {
        columns: width >= Style.space(700) ? 4 : 2
        columnSpacing: Style.spacing.md
        rowSpacing: Style.spacing.sm
        Layout.fillWidth: true

        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Gross speed"; value: Number(root.value("grossWpm", 0)).toFixed(1) + " WPM"; Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Real words"; value: Number(root.value("literalWpm", 0)).toFixed(1) + " WPM"; Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Correct keys"; value: String(root.value("correctKeystrokes", 0)); Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Errors"; value: String(root.value("incorrectKeystrokes", 0)); valueColor: Number(root.value("incorrectKeystrokes", 0)) > 0 ? Color.urgent : Color.foreground; Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Corrected"; value: String(root.value("correctedErrors", 0)); Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Uncorrected"; value: String(root.value("uncorrectedErrors", 0)); Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Backspaces"; value: String(root.value("backspaces", 0)); Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Duration"; value: root.durationLabel(root.value("durationSeconds", 0)); Layout.fillWidth: true }
      }

      CoachingSummary {
        Layout.fillWidth: true
        messages: root.coachingSummary.messages || []
        fontFamily: root.fontFamily
      }

      GridLayout {
        id: errorDetailsGrid

        columns: width >= Style.space(700) ? 2 : 1
        columnSpacing: Style.spacing.md
        rowSpacing: Style.spacing.sm
        Layout.fillWidth: true

        readonly property real sharedCardHeight: Math.max(
          Style.space(72),
          difficultContent.implicitHeight + difficultCard.contentTopInset + difficultCard.contentBottomInset,
          substitutionsContent.implicitHeight + substitutionsCard.contentTopInset + substitutionsCard.contentBottomInset
        )

        BorderSurface {
          id: difficultCard

          Layout.fillWidth: true
          Layout.fillHeight: true
          Layout.minimumHeight: errorDetailsGrid.sharedCardHeight
          Layout.preferredHeight: errorDetailsGrid.sharedCardHeight
          color: Style.normalFillFor(Color.foreground, Color.accent)
          borderSpec: Border.controlSpec("normal", Color.foreground, Color.accent)
          radius: Style.cornerRadius
          padding: Style.spacing.md

          ColumnLayout {
            id: difficultContent

            anchors.fill: parent
            anchors.topMargin: parent.contentTopInset
            anchors.rightMargin: parent.contentRightInset
            anchors.bottomMargin: parent.contentBottomInset
            anchors.leftMargin: parent.contentLeftInset
            spacing: Style.spacing.xs

            Text { text: "DIFFICULT CHARACTERS"; color: Color.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true }
            Text {
              Layout.fillWidth: true
              text: {
                var rows = root.value("difficultCharacters", [])
                if (!rows.length) return "No recurring difficult characters in this test."
                var values = []
                for (var i = 0; i < Math.min(8, rows.length); i++) values.push(rows[i].character + "  " + (rows[i].errorRate * 100).toFixed(0) + "%")
                return values.join("     ")
              }
              color: Color.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
              wrapMode: Text.WordWrap
            }
          }
        }

        BorderSurface {
          id: substitutionsCard

          Layout.fillWidth: true
          Layout.fillHeight: true
          Layout.minimumHeight: errorDetailsGrid.sharedCardHeight
          Layout.preferredHeight: errorDetailsGrid.sharedCardHeight
          color: Style.normalFillFor(Color.foreground, Color.accent)
          borderSpec: Border.controlSpec("normal", Color.foreground, Color.accent)
          radius: Style.cornerRadius
          padding: Style.spacing.md

          ColumnLayout {
            id: substitutionsContent

            anchors.fill: parent
            anchors.topMargin: parent.contentTopInset
            anchors.rightMargin: parent.contentRightInset
            anchors.bottomMargin: parent.contentBottomInset
            anchors.leftMargin: parent.contentLeftInset
            spacing: Style.spacing.xs

            Text { text: "COMMON SUBSTITUTIONS"; color: Color.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true }
            Text {
              Layout.fillWidth: true
              text: {
                var rows = root.value("substitutions", [])
                if (!rows.length) return "No substitutions recorded."
                var values = []
                for (var i = 0; i < Math.min(8, rows.length); i++) {
                  values.push(root.displayCharacter(rows[i].expected) + " → "
                    + root.displayCharacter(rows[i].actual) + "  ×" + rows[i].count)
                }
                return values.join("     ")
              }
              color: Color.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
              wrapMode: Text.WordWrap
            }
          }
        }
      }

      Text { visible: root.value("wpmSamples", []).length >= 3; text: "PACE OVER TIME"; color: Color.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true }

      BorderSurface {
        visible: root.value("wpmSamples", []).length >= 3
        Layout.fillWidth: true
        Layout.preferredHeight: Style.space(80)
        color: Style.normalFillFor(Color.foreground, Color.accent)
        borderSpec: Border.controlSpec("normal", Color.foreground, Color.accent)
        radius: Style.cornerRadius
        padding: Style.spacing.md

        Canvas {
          id: paceChart
          anchors.fill: parent
          anchors.topMargin: parent.contentTopInset
          anchors.rightMargin: parent.contentRightInset
          anchors.bottomMargin: parent.contentBottomInset
          anchors.leftMargin: parent.contentLeftInset
          property var samples: root.value("wpmSamples", [])
          onSamplesChanged: requestPaint()
          onWidthChanged: requestPaint()
          onHeightChanged: requestPaint()
          onPaint: {
            var context = getContext("2d")
            context.clearRect(0, 0, width, height)
            if (samples.length < 2) return
            var maximum = 1
            for (var i = 0; i < samples.length; i++) maximum = Math.max(maximum, Number(samples[i].grossWpm) || 0)
            context.strokeStyle = String(Color.accent)
            context.lineWidth = Math.max(1, Style.normalBorderWidth * 2)
            context.beginPath()
            for (var j = 0; j < samples.length; j++) {
              var x = j / Math.max(1, samples.length - 1) * width
              var y = height - (Number(samples[j].grossWpm) || 0) / maximum * (height - Style.space(8)) - Style.space(4)
              if (j === 0) context.moveTo(x, y)
              else context.lineTo(x, y)
            }
            context.stroke()
          }
        }
      }

      Item { Layout.minimumHeight: Style.spacing.xs }
      GridLayout {
        Layout.fillWidth: true
        columns: width >= Style.space(700) ? (root.adaptiveAnalysis.available ? 5 : 4) : 2
        columnSpacing: Style.spacing.sm
        rowSpacing: Style.spacing.sm
        Button { text: "History"; fontFamily: root.fontFamily; bordered: true; focusable: true; Layout.fillWidth: true; onClicked: root.historyRequested() }
        Button { text: "Progress"; fontFamily: root.fontFamily; bordered: true; focusable: true; Layout.fillWidth: true; onClicked: root.progressRequested() }
        Button { visible: root.adaptiveAnalysis.available; text: "Adaptive practice"; fontFamily: root.fontFamily; bordered: true; focusable: true; Layout.fillWidth: true; onClicked: root.practiceRequested() }
        Button { text: "New test"; fontFamily: root.fontFamily; bordered: true; focusable: true; Layout.fillWidth: true; onClicked: root.newTestRequested() }
        Button { text: "Repeat"; fontFamily: root.fontFamily; bordered: true; focusable: true; Layout.fillWidth: true; onClicked: root.repeatRequested() }
      }
    }
  }
}
