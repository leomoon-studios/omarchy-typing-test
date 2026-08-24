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
  property var rows: []
  property var summary: ({ count: 0, currentWpm: null, wpmChange: null, accuracy: null, bestWpm: null })
  property var speedPoints: []
  property var accuracyPoints: []
  property var consistencyPoints: []
  property var errorPoints: []
  property var characterChoices: []
  property string selectedCharacter: ""
  property var selectedCharacterPoints: []

  signal backRequested()
  signal historyRequested()
  signal resultRequested(var result)

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
    var selectedRows = Progress.filterHistory(store.history, language, range)
    rows = selectedRows
    summary = Progress.summary(selectedRows)
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
  }

  function chooseLanguage(value) {
    language = value === "fa" ? "fa" : "en"
    rebuild()
  }

  function chooseRange(value) {
    range = value
    if (store) store.saveSettings({ progressRange: value })
    rebuild()
  }

  function chooseCharacter(value) {
    selectedCharacter = String(value || "")
    selectedCharacterPoints = Progress.characterTrend(rows, selectedCharacter, 120)
  }

  function openPoint(point) {
    if (point && point.result) resultRequested(point.result)
  }

  onStoreChanged: rebuild()
  onLanguageChanged: rebuild()
  Connections { target: root.store; function onHistoryRevisionChanged() { root.rebuild() } }
  Component.onCompleted: {
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
        text: "Complete at least three " + (root.language === "fa" ? "Parsi" : "English") + " tests to show progress trends."
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

        ProgressChart { title: "Net WPM"; suffix: " WPM"; fontFamily: root.fontFamily; points: root.speedPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); onPointActivated: function(point) { root.openPoint(point) } }
        ProgressChart { title: "Accuracy"; suffix: "%"; fontFamily: root.fontFamily; points: root.accuracyPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); onPointActivated: function(point) { root.openPoint(point) } }
        ProgressChart { title: "Consistency"; suffix: "%"; fontFamily: root.fontFamily; points: root.consistencyPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); onPointActivated: function(point) { root.openPoint(point) } }
        ProgressChart { title: "Error rate"; suffix: "%"; fontFamily: root.fontFamily; points: root.errorPoints; Layout.fillWidth: true; Layout.preferredHeight: Style.space(152); lineColor: Color.urgent; onPointActivated: function(point) { root.openPoint(point) } }
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
