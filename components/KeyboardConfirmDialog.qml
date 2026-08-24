import QtQuick
import qs.Ui

ConfirmDialog {
  id: root

  property var restoreFocusItem: null
  property int defaultSelectedIndex: 0

  focus: opened

  function activateSelection() {
    if (selectedIndex === 0) canceled()
    else confirmed()
  }

  function handleDialogKey(event) {
    if (!opened) return false

    if (event.key === Qt.Key_Left || event.key === Qt.Key_Up) {
      selectedIndex = 0
    } else if (event.key === Qt.Key_Right || event.key === Qt.Key_Down) {
      selectedIndex = 1
    } else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
      selectedIndex = selectedIndex === 0 ? 1 : 0
    } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) {
      activateSelection()
    } else if (event.key === Qt.Key_Escape) {
      canceled()
    } else {
      return true
    }

    return true
  }

  onOpenedChanged: {
    if (opened) {
      selectedIndex = defaultSelectedIndex === 1 ? 1 : 0
      Qt.callLater(function() { root.forceActiveFocus() })
    } else if (restoreFocusItem) {
      Qt.callLater(function() {
        if (!root.restoreFocusItem) return
        if (typeof root.restoreFocusItem.restoreTypingFocus === "function")
          root.restoreFocusItem.restoreTypingFocus()
        else
          root.restoreFocusItem.forceActiveFocus()
      })
    }
  }

  Keys.priority: Keys.BeforeItem
  Keys.onPressed: function(event) {
    if (root.handleDialogKey(event)) event.accepted = true
  }
}
