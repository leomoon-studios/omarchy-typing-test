import QtQuick
import QtQuick.Layouts
import QtQuick.Controls
import qs.Commons
import qs.Ui
import "../js/KeyboardNavigation.js" as KeyboardNavigation

Item {
  id: root
  property var store: null
  property string fontFamily: Style.font.family
  property string filterLanguage: "all"
  property var displayRows: []
  property string pendingDeleteId: ""
  signal backRequested()
  signal progressRequested()
  signal resultRequested(var result)

  focus: true

  function moveKeyboardFocus(forward) {
    var window = root.Window.window
    var current = window && window.activeFocusItem ? window.activeFocusItem : root
    KeyboardNavigation.focusNext(root, current, forward)
  }

  function openCurrentResult() {
    if (historyList.currentIndex < 0 || historyList.currentIndex >= root.displayRows.length) return
    root.resultRequested(root.displayRows[historyList.currentIndex])
  }

  function deleteCurrentResult() {
    if (historyList.currentIndex < 0 || historyList.currentIndex >= root.displayRows.length) return
    root.pendingDeleteId = root.displayRows[historyList.currentIndex].id
    deleteDialog.opened = true
  }

  function rebuild() {
    if (!store) { displayRows = []; return }
    store.historyRevision
    var rows = []
    for (var i = 0; i < store.history.length; i++) {
      if (filterLanguage === "all" || store.history[i].language === filterLanguage) rows.push(store.history[i])
    }
    displayRows = rows
  }

  function durationLabel(seconds) {
    var value = Math.max(0, Math.round(Number(seconds) || 0))
    if (value < 60) return value + " SEC"
    if (value % 60 === 0) return (value / 60) + " MIN"
    return Math.floor(value / 60) + "M " + (value % 60) + "S"
  }

  function optionLabel(value) {
    var text = String(value || "mixed").replace(/[-_]/g, " ")
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  onStoreChanged: rebuild()
  onFilterLanguageChanged: rebuild()
  onDisplayRowsChanged: Qt.callLater(function() {
    historyList.currentIndex = root.displayRows.length > 0
      ? Math.max(0, Math.min(historyList.currentIndex, root.displayRows.length - 1))
      : -1
  })
  Connections { target: root.store; function onHistoryRevisionChanged() { root.rebuild() } }
  Component.onCompleted: {
    rebuild()
    Qt.callLater(function() { root.forceActiveFocus() })
  }

  Keys.priority: Keys.AfterItem
  Keys.onPressed: function(event) {
    if (event.key === Qt.Key_Left || event.key === Qt.Key_Up) {
      root.moveKeyboardFocus(false)
      event.accepted = true
    } else if (event.key === Qt.Key_Right || event.key === Qt.Key_Down) {
      root.moveKeyboardFocus(true)
      event.accepted = true
    }
  }

  ColumnLayout {
    anchors.fill: parent
    spacing: Style.spacing.md

    RowLayout {
      Layout.fillWidth: true
      Text { text: "History"; color: Color.foreground; font.family: root.fontFamily; font.pixelSize: Style.font.display; font.bold: true }
      Item { Layout.fillWidth: true }
      Button {
        text: "All"
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        selected: root.filterLanguage === "all"
        Layout.preferredHeight: Style.spacing.controlHeight
        onClicked: root.filterLanguage = "all"
      }

      Button {
        text: "English"
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        selected: root.filterLanguage === "en"
        Layout.preferredWidth: Style.space(100)
        Layout.preferredHeight: Style.spacing.controlHeight
        onClicked: root.filterLanguage = "en"
      }

      Button {
        text: "پارسی"
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        selected: root.filterLanguage === "fa"
        Layout.preferredWidth: Style.space(100)
        Layout.preferredHeight: Style.spacing.controlHeight
        onClicked: root.filterLanguage = "fa"
      }
    }

    Text {
      text: {
        if (!root.store || root.store.history.length === 0) return ""
        var bestEn = root.store.best("en")
        var bestFa = root.store.best("fa")
        return "Personal best   EN " + (bestEn === null ? "—" : Number(bestEn).toFixed(1) + " WPM")
          + "   ·   PARSI " + (bestFa === null ? "—" : Number(bestFa).toFixed(1) + " WPM")
      }
      visible: text !== ""
      color: Color.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.bodySmall
      Layout.fillWidth: true
    }

    Text {
      visible: root.displayRows.length === 0
      text: "No completed tests yet."
      color: Color.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.heading
      Layout.fillWidth: true
      Layout.fillHeight: true
      horizontalAlignment: Text.AlignHCenter
      verticalAlignment: Text.AlignVCenter
    }

    ListView {
      id: historyList

      readonly property bool overflowing: contentHeight > height + 0.5
      readonly property real scrollGutter: overflowing ? historyVerticalBar.width + Style.spacing.sm : 0

      visible: root.displayRows.length > 0
      Layout.fillWidth: true
      Layout.fillHeight: true
      model: root.displayRows
      spacing: Style.spacing.sm
      clip: true
      boundsBehavior: Flickable.StopAtBounds
      activeFocusOnTab: true
      keyNavigationEnabled: false
      ScrollBar.vertical: ScrollBar {
        id: historyVerticalBar
        policy: ScrollBar.AsNeeded
      }

      Keys.priority: Keys.BeforeItem
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Up) {
          if (currentIndex > 0) {
            currentIndex--
            positionViewAtIndex(currentIndex, ListView.Contain)
          } else {
            root.moveKeyboardFocus(false)
          }
          event.accepted = true
        } else if (event.key === Qt.Key_Down) {
          if (currentIndex < count - 1) {
            currentIndex++
            positionViewAtIndex(currentIndex, ListView.Contain)
          } else {
            root.moveKeyboardFocus(true)
          }
          event.accepted = true
        } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) {
          root.openCurrentResult()
          event.accepted = true
        } else if (event.key === Qt.Key_Delete || event.key === Qt.Key_Backspace) {
          root.deleteCurrentResult()
          event.accepted = true
        }
      }

      delegate: BorderSurface {
        id: resultCard
        required property var modelData
        required property int index
        readonly property bool keyboardSelected: historyList.activeFocus && ListView.isCurrentItem
        readonly property bool hovered: cardHover.hovered || keyboardSelected
        width: Math.max(0, ListView.view.width - ListView.view.scrollGutter)
        height: Style.space(66)
        color: hovered
          ? Style.hoverFillFor(Color.foreground, Color.accent)
          : Style.normalFillFor(Color.foreground, Color.accent)
        borderSpec: Border.controlSpec(hovered ? "hover-cursor" : "normal", Color.foreground, Color.accent)
        radius: Style.cornerRadius

        Behavior on color { ColorAnimation { duration: 80 } }

        HoverHandler { id: cardHover }

        MouseArea {
          anchors.fill: parent
          cursorShape: Qt.PointingHandCursor
          onClicked: {
            historyList.currentIndex = index
            historyList.forceActiveFocus()
            root.resultRequested(modelData)
          }
        }

        RowLayout {
          anchors.fill: parent
          anchors.leftMargin: resultCard.borderLeft + Style.spacing.rowPaddingX
          anchors.rightMargin: resultCard.borderRight + Style.spacing.rowPaddingX
          anchors.topMargin: resultCard.borderTop + Style.spacing.md
          anchors.bottomMargin: resultCard.borderBottom + Style.spacing.md
          spacing: Style.spacing.xl

          BorderSurface {
            Layout.preferredWidth: Style.space(42)
            Layout.preferredHeight: Style.space(30)
            Layout.alignment: Qt.AlignVCenter
            color: Style.selectedFillFor(Color.foreground, Color.accent)
            borderSpec: Border.controlSpec("normal", Color.accent, Color.accent)
            radius: Style.cornerRadius

            Text {
              anchors.centerIn: parent
              text: modelData.language === "fa" ? "PA" : "EN"
              color: Color.accent
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
            }
          }

          ColumnLayout {
            Layout.fillWidth: true
            Layout.alignment: Qt.AlignVCenter
            spacing: Style.spacing.xs

            Text {
              text: new Date(modelData.completedAt).toLocaleString(Qt.locale(), "yyyy-MM-dd  HH:mm")
              color: Color.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
              font.weight: Font.Medium
            }

            Text {
              text: root.durationLabel(modelData.configuredDurationSeconds)
                + "  ·  " + (String(modelData.mode || "standard") === "adaptive" ? "ADAPTIVE" : "STANDARD")
                + "  ·  " + root.optionLabel(modelData.category).toUpperCase()
                + "  ·  " + root.optionLabel(modelData.difficulty).toUpperCase()
              color: Color.muted
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              elide: Text.ElideRight
              Layout.fillWidth: true
            }
          }

          RowLayout {
            Layout.alignment: Qt.AlignVCenter | Qt.AlignRight
            spacing: Style.spacing.xxl

            ColumnLayout {
              Layout.preferredWidth: Style.space(92)
              spacing: Style.spacing.xs

              Text {
                text: "NET WPM"
                color: Color.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
                Layout.alignment: Qt.AlignHCenter
              }

              Text {
                text: Number(modelData.netWpm || 0).toFixed(1)
                color: Color.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.heading
                font.bold: true
                Layout.alignment: Qt.AlignHCenter
              }
            }

            ColumnLayout {
              Layout.preferredWidth: Style.space(92)
              spacing: Style.spacing.xs

              Text {
                text: "ACCURACY"
                color: Color.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
                Layout.alignment: Qt.AlignHCenter
              }

              Text {
                text: Number(modelData.accuracy || 0).toFixed(1) + "%"
                color: Color.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.heading
                font.bold: true
                Layout.alignment: Qt.AlignHCenter
              }
            }

            PanelActionButton {
              iconText: "󰆴"
              fontFamily: root.fontFamily
              hoverColor: Color.urgent
              tooltipText: "Delete result"
              focusable: false
              Layout.alignment: Qt.AlignVCenter
              onClicked: {
                root.pendingDeleteId = modelData.id
                deleteDialog.opened = true
              }
            }
          }
        }
      }
    }

    RowLayout {
      Layout.fillWidth: true
      Button { text: "Back"; fontFamily: root.fontFamily; bordered: true; focusable: true; onClicked: root.backRequested() }
      Button { text: "Progress"; fontFamily: root.fontFamily; bordered: true; focusable: true; onClicked: root.progressRequested() }
      Item { Layout.fillWidth: true }
      Button { visible: root.store && root.store.history.length > 0; text: "Clear history"; fontFamily: root.fontFamily; bordered: true; foreground: Color.urgent; focusable: true; onClicked: clearDialog.opened = true }
    }
  }

  KeyboardConfirmDialog {
    id: deleteDialog
    fontFamily: root.fontFamily
    anchors.fill: parent
    restoreFocusItem: root
    message: "Delete this typing-test result?"
    confirmText: "Delete"
    onCanceled: opened = false
    onConfirmed: { opened = false; if (root.store) root.store.deleteResult(root.pendingDeleteId); root.pendingDeleteId = "" }
  }

  KeyboardConfirmDialog {
    id: clearDialog
    fontFamily: root.fontFamily
    anchors.fill: parent
    restoreFocusItem: root
    message: "Clear all typing-test history? This cannot be undone."
    confirmText: "Clear all"
    onCanceled: opened = false
    onConfirmed: { opened = false; if (root.store) root.store.clearHistory() }
  }
}
