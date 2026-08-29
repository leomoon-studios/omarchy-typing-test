import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/Progress.js" as Progress
import "../js/KeyboardNavigation.js" as KeyboardNavigation

Item {
  id: root

  property var store: null
  property string fontFamily: Style.font.family
  property string language: store ? String(store.settings.defaultLanguage || "en") : "en"
  property string range: store ? String(store.settings.progressRange || "30-tests") : "30-tests"
  property string testTypeFilter: store ? String(store.settings.defaultTestType || "timed") : "timed"
  property string durationFilter: store ? String(store.settings.defaultDurationSeconds || 60) : "60"
  property string wordCountFilter: store ? String(store.settings.defaultWordCount || 25) : "25"
  property string modeFilter: "standard"
  property string categoryFilter: "all"
  property string difficultyFilter: "all"
  property var initialComparison: null
  property bool initialized: false
  property var durationChoices: [{ value: "all", label: "All durations" }, { value: "60", label: "1 min" }]
  property var wordCountChoices: [{ value: "all", label: "All word counts" }, { value: "25", label: "25 words" }]
  property var rows: []
  property var summary: ({ count: 0, currentWpm: null, wpmChange: null, accuracy: null, bestWpm: null })
  property var comparison: ({ label: "", count: 0, bestWpm: null })
  property var speedPoints: []
  property var accuracyPoints: []
  property var consistencyPoints: []
  property var errorPoints: []
  property var characterChoices: []
  property string selectedCharacter: ""
  property var selectedCharacterPoints: []
  readonly property var categoryChoices: language === "fa"
    ? [
        { value: "all", label: "All content" },
        { value: "common", label: "Common" },
        { value: "formal", label: "Formal" },
        { value: "literature", label: "Literature" },
        { value: "punctuation", label: "Numbers & punctuation" },
        { value: "difficult", label: "Difficult-character practice" },
        { value: "custom", label: "Imported" },
        { value: "mixed", label: "Mixed" }
      ]
    : [
        { value: "all", label: "All content" },
        { value: "common", label: "Common" },
        { value: "literature", label: "Literature" },
        { value: "programming", label: "Programming" },
        { value: "punctuation", label: "Numbers & punctuation" },
        { value: "difficult", label: "Difficult-character practice" },
        { value: "custom", label: "Imported" },
        { value: "mixed", label: "Mixed" }
      ]

  signal backRequested()
  signal historyRequested()
  signal resultRequested(var result, var comparison)
  signal comparisonUpdated(var comparison)

  focus: true

  function revealKeyboardTarget(item) {
    if (!item || !progressScroll.contentItem || progressScroll.contentItem.contentY === undefined) return
    var position = item.mapToItem(progressContent, 0, 0)
    var top = position.y
    var bottom = top + item.height
    var flickable = progressScroll.contentItem
    var viewportHeight = progressScroll.availableHeight
    if (top < flickable.contentY)
      flickable.contentY = Math.max(0, top - Style.spacing.sm)
    else if (bottom > flickable.contentY + viewportHeight)
      flickable.contentY = Math.max(0, bottom - viewportHeight + Style.spacing.sm)
  }

  function moveKeyboardFocus(forward) {
    var window = root.Window.window
    var current = window && window.activeFocusItem ? window.activeFocusItem : root
    var target = KeyboardNavigation.focusNext(root, current, forward)
    if (target) Qt.callLater(function() { root.revealKeyboardTarget(target) })
  }

  Keys.priority: Keys.AfterItem
  Keys.onPressed: function(event) {
    if (event.key === Qt.Key_Up) {
      root.moveKeyboardFocus(false)
      event.accepted = true
    } else if (event.key === Qt.Key_Down) {
      root.moveKeyboardFocus(true)
      event.accepted = true
    } else if (event.key === Qt.Key_Left || event.key === Qt.Key_Right) {
      root.moveKeyboardFocus(event.key === Qt.Key_Right)
      event.accepted = true
    }
  }

  function rebuild() {
    if (!store) {
      rows = []
      return
    }
    store.historyRevision
    durationChoices = Progress.durationOptions(store.history, language, store.settings.defaultDurationSeconds)
    wordCountChoices = Progress.wordCountOptions(store.history, language, store.settings.defaultWordCount)
    var filters = {
      testType: testTypeFilter,
      durationSeconds: testTypeFilter === "timed" ? durationFilter : "all",
      targetWordCount: testTypeFilter === "words" ? wordCountFilter : "all",
      mode: modeFilter,
      category: categoryFilter,
      difficulty: difficultyFilter
    }
    var selectedRows = Progress.filterHistory(store.history, language, range, filters)
    rows = selectedRows
    summary = Progress.summary(selectedRows)
    comparison = Progress.comparisonContext(selectedRows, language, range, filters)
    speedPoints = Progress.metricPoints(selectedRows, "netWpm", 120)
    accuracyPoints = Progress.metricPoints(selectedRows, "accuracy", 120)
    consistencyPoints = Progress.metricPoints(selectedRows, "consistency", 120)
    errorPoints = Progress.metricPoints(selectedRows, "errorRate", 120)
    characterChoices = Progress.characters(selectedRows)
    var found = false
    for (var index = 0; index < characterChoices.length; index++) {
      if (characterChoices[index].character === selectedCharacter) found = true
    }
    if (!found) selectedCharacter = characterChoices.length > 0 ? characterChoices[0].character : ""
    selectedCharacterPoints = Progress.characterTrend(selectedRows, selectedCharacter, 120)
    if (initialized) comparisonUpdated(comparison)
  }

  function chooseLanguage(value) {
    language = value === "fa" ? "fa" : "en"
    if ((language === "fa" && categoryFilter === "programming")
        || (language === "en" && categoryFilter === "formal")) categoryFilter = "all"
  }

  function chooseRange(value) {
    range = value
    if (store) store.saveSettings({ progressRange: value })
  }

  function chooseTestType(value) {
    testTypeFilter = String(value || "all")
    if (testTypeFilter === "timed" && durationFilter === "all" && store)
      durationFilter = String(store.settings.defaultDurationSeconds || 60)
    if (testTypeFilter === "words" && wordCountFilter === "all" && store)
      wordCountFilter = String(store.settings.defaultWordCount || 25)
  }

  function chooseCharacter(value) {
    selectedCharacter = String(value || "")
    selectedCharacterPoints = Progress.characterTrend(rows, selectedCharacter, 120)
  }

  function openPoint(point) {
    if (point && point.result) resultRequested(point.result, comparison)
  }

  onStoreChanged: rebuild()
  onLanguageChanged: rebuild()
  onRangeChanged: rebuild()
  onTestTypeFilterChanged: rebuild()
  onDurationFilterChanged: rebuild()
  onWordCountFilterChanged: rebuild()
  onModeFilterChanged: rebuild()
  onCategoryFilterChanged: rebuild()
  onDifficultyFilterChanged: rebuild()
  Connections { target: root.store; function onHistoryRevisionChanged() { root.rebuild() } }
  Component.onCompleted: {
    var restored = initialComparison
    if (restored && restored.label) {
      language = restored.language === "fa" ? "fa" : "en"
      range = String(restored.range || "all")
      testTypeFilter = String(restored.testType || "timed")
      durationFilter = String(restored.durationSeconds === undefined ? "all" : restored.durationSeconds)
      wordCountFilter = String(restored.targetWordCount === undefined ? "all" : restored.targetWordCount)
      modeFilter = String(restored.mode || "all")
      categoryFilter = String(restored.category || "all")
      difficultyFilter = String(restored.difficulty || "all")
    }
    initialized = true
    rebuild()
    Qt.callLater(function() { root.forceActiveFocus() })
  }

  ScrollView {
    id: progressScroll
    anchors.fill: parent
    clip: true
    rightPadding: progressContent.implicitHeight > height + 0.5
      ? progressScroll.ScrollBar.vertical.width + Style.spacing.sm
      : 0
    contentWidth: availableWidth
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    ScrollBar.vertical.policy: ScrollBar.AsNeeded

    ColumnLayout {
      id: progressContent

      width: progressScroll.availableWidth
      spacing: Style.spacing.md

      RowLayout {
        Layout.fillWidth: true

        Text {
          text: "Progress"
          color: Color.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.display
          font.bold: true
          Layout.fillWidth: true
        }

        Button {
          text: "English"
          fontFamily: root.fontFamily
          bordered: true
          focusable: true
          selected: root.language === "en"
          Layout.preferredWidth: Style.space(100)
          onClicked: root.chooseLanguage("en")
        }

        Button {
          text: "پارسی"
          fontFamily: root.fontFamily
          bordered: true
          focusable: true
          selected: root.language === "fa"
          Layout.preferredWidth: Style.space(100)
          onClicked: root.chooseLanguage("fa")
        }
      }

      RowLayout {
        Layout.fillWidth: true

        Text {
          text: "HISTORY RANGE"
          color: Color.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          Layout.fillWidth: true
        }

        Repeater {
          model: [{ value: "7-tests", label: "7 tests" }, { value: "30-tests", label: "30 tests" }, { value: "all", label: "All" }]

          Button {
            required property var modelData
            text: modelData.label
            fontFamily: root.fontFamily
            bordered: true
            focusable: true
            selected: root.range === modelData.value
            onClicked: root.chooseRange(modelData.value)
          }
        }
      }

      Text {
        text: "COMPARISON FILTERS"
        color: Color.muted
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }

      GridLayout {
        columns: width >= Style.space(700) ? 5 : 2
        columnSpacing: Style.spacing.md
        rowSpacing: Style.spacing.sm
        Layout.fillWidth: true

        Dropdown {
          label: "Format"
          fontFamily: root.fontFamily
          value: root.testTypeFilter
          options: [
            { value: "all", label: "All formats" },
            { value: "timed", label: "Timed" },
            { value: "words", label: "Word count" },
            { value: "passage", label: "Passage completion" }
          ]
          Layout.fillWidth: true
          onChanged: function(value) { root.chooseTestType(value) }
        }

        Dropdown {
          visible: root.testTypeFilter === "timed" || root.testTypeFilter === "words"
          label: root.testTypeFilter === "words" ? "Word count" : "Duration"
          fontFamily: root.fontFamily
          value: root.testTypeFilter === "words" ? root.wordCountFilter : root.durationFilter
          options: root.testTypeFilter === "words" ? root.wordCountChoices : root.durationChoices
          Layout.fillWidth: true
          onChanged: function(value) {
            if (root.testTypeFilter === "words") root.wordCountFilter = String(value)
            else root.durationFilter = String(value)
          }
        }

        Dropdown {
          label: "Mode"
          fontFamily: root.fontFamily
          value: root.modeFilter
          options: [
            { value: "all", label: "All modes" },
            { value: "standard", label: "Standard" },
            { value: "adaptive", label: "Adaptive" }
          ]
          Layout.fillWidth: true
          onChanged: function(value) { root.modeFilter = String(value) }
        }

        Dropdown {
          label: "Content"
          fontFamily: root.fontFamily
          value: root.categoryFilter
          options: root.categoryChoices
          Layout.fillWidth: true
          onChanged: function(value) { root.categoryFilter = String(value) }
        }

        Dropdown {
          label: "Difficulty"
          fontFamily: root.fontFamily
          value: root.difficultyFilter
          options: [
            { value: "all", label: "All difficulties" },
            { value: "mixed", label: "Mixed" },
            { value: "1", label: "Easy" },
            { value: "2", label: "Medium" },
            { value: "3", label: "Hard" }
          ]
          Layout.fillWidth: true
          onChanged: function(value) { root.difficultyFilter = String(value) }
        }
      }

      BorderSurface {
        Layout.fillWidth: true
        Layout.preferredHeight: activeComparisonContent.implicitHeight + contentTopInset + contentBottomInset
        color: Style.normalFillFor(Color.foreground, Color.accent)
        borderSpec: Border.controlSpec("normal", Color.accent, Color.accent)
        radius: Style.cornerRadius
        padding: Style.spacing.md

        ColumnLayout {
          id: activeComparisonContent
          anchors.fill: parent
          anchors.topMargin: parent.contentTopInset
          anchors.rightMargin: parent.contentRightInset
          anchors.bottomMargin: parent.contentBottomInset
          anchors.leftMargin: parent.contentLeftInset
          spacing: Style.spacing.xs

          Text {
            text: "ACTIVE COMPARISON"
            color: Color.accent
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            Layout.fillWidth: true
          }

          Text {
            text: root.comparison.label || "No comparison selected"
            color: Color.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
          }
        }
      }

      GridLayout {
        columns: width >= Style.space(760) ? 5 : 2
        columnSpacing: Style.spacing.sm
        rowSpacing: Style.spacing.sm
        Layout.fillWidth: true

        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Rolling speed"; value: root.summary.currentWpm === null ? "—" : Number(root.summary.currentWpm).toFixed(1) + " WPM"; valueColor: Color.accent; Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Speed change"; value: root.summary.wpmChange === null ? "—" : (root.summary.wpmChange >= 0 ? "+" : "") + Number(root.summary.wpmChange).toFixed(1) + " WPM"; Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Rolling accuracy"; value: root.summary.accuracy === null ? "—" : Number(root.summary.accuracy).toFixed(1) + "%"; Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Best speed"; value: root.summary.bestWpm === null ? "—" : Number(root.summary.bestWpm).toFixed(1) + " WPM"; Layout.fillWidth: true }
        MetricCard { compact: true; fontFamily: root.fontFamily; label: "Tests"; value: String(root.summary.count || 0); Layout.fillWidth: true }
      }

      Text {
        visible: root.rows.length < 3
        text: "Complete at least three comparable " + (root.language === "fa" ? "Parsi" : "English")
          + " tests, or broaden the filters, to show progress trends."
        color: Color.muted
        font.family: root.fontFamily
        font.pixelSize: Style.font.heading
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
        Layout.minimumHeight: Style.space(80)
        verticalAlignment: Text.AlignVCenter
      }

      GridLayout {
        visible: root.rows.length >= 3
        columns: width >= Style.space(700) ? 2 : 1
        columnSpacing: Style.spacing.md
        rowSpacing: Style.spacing.md
        Layout.fillWidth: true

        ProgressChart { title: "Net WPM"; contextLabel: root.comparison.label; suffix: " WPM"; fontFamily: root.fontFamily; points: root.speedPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); onPointActivated: function(point) { root.openPoint(point) } }
        ProgressChart { title: "Accuracy"; contextLabel: root.comparison.label; suffix: "%"; fontFamily: root.fontFamily; points: root.accuracyPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); onPointActivated: function(point) { root.openPoint(point) } }
        ProgressChart { title: "Consistency"; contextLabel: root.comparison.label; suffix: "%"; fontFamily: root.fontFamily; points: root.consistencyPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); onPointActivated: function(point) { root.openPoint(point) } }
        ProgressChart { title: "Error rate"; contextLabel: root.comparison.label; suffix: "%"; fontFamily: root.fontFamily; points: root.errorPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); lineColor: Color.urgent; onPointActivated: function(point) { root.openPoint(point) } }
      }

      ColumnLayout {
        visible: root.rows.length >= 3 && root.characterChoices.length > 0
        Layout.fillWidth: true
        spacing: Style.spacing.sm

        Text {
          text: "DIFFICULT CHARACTER TREND"
          color: Color.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
        }

        RowLayout {
          Layout.fillWidth: true
          spacing: Style.spacing.sm

          Repeater {
            model: root.characterChoices.slice(0, 8)

            Button {
              required property var modelData
              text: modelData.character
              fontFamily: root.fontFamily
              bordered: true
              focusable: true
              selected: root.selectedCharacter === modelData.character
              Layout.preferredWidth: Style.space(48)
              onClicked: root.chooseCharacter(modelData.character)
            }
          }

          Item { Layout.fillWidth: true }
        }

        ProgressChart {
          title: root.selectedCharacter ? "Error rate for " + root.selectedCharacter : "Character error rate"
          contextLabel: root.comparison.label
          suffix: "%"
          fontFamily: root.fontFamily
          points: root.selectedCharacterPoints
          lineColor: Color.urgent
          Layout.fillWidth: true
          Layout.preferredHeight: Style.space(152)
          onPointActivated: function(point) { root.openPoint(point) }
        }
      }

      RowLayout {
        Layout.fillWidth: true
        Button { text: "Back"; fontFamily: root.fontFamily; bordered: true; focusable: true; onClicked: root.backRequested() }
        Item { Layout.fillWidth: true }
        Button { text: "History"; fontFamily: root.fontFamily; bordered: true; focusable: true; onClicked: root.historyRequested() }
      }
    }
  }
}
