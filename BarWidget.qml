import QtQuick
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "leomoon-studios.omarchy-typing-test"

  readonly property string contentFontFamily: bundledFont.name !== ""
    ? bundledFont.name
    : (bar ? bar.fontFamily : Style.font.family)

  FontLoader {
    id: bundledFont
    source: Qt.resolvedUrl("assets/fonts/Vazirmatn-Regular.ttf")
  }

  readonly property bool opened: popoverLoader.item ? popoverLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: popoverLoader.item ? popoverLoader.item.popoutSwitchClosing === true : false
  readonly property real openPanelIndicatorWidth: badge.width
  readonly property real openPanelIndicatorHeight: Math.max(Style.space(10), Math.round(Style.bar.iconSlot * 0.55))

  function open() { if (popoverLoader.item) popoverLoader.item.open() }
  function close() { if (popoverLoader.item) popoverLoader.item.close() }
  function toggle() { if (popoverLoader.item) popoverLoader.item.toggle() }
  function refresh() { if (popoverLoader.item) popoverLoader.item.refresh() }
  function closeForPopoutSwitch() { if (popoverLoader.item) popoverLoader.item.closeForPopoutSwitch() }

  function injectPopover() {
    var target = popoverLoader.item
    if (!target) return
    target.bar = root.bar
    target.anchorItem = button
    target.hostWidget = root
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight
  onBarChanged: injectPopover()

  Loader {
    id: popoverLoader
    active: true
    source: Qt.resolvedUrl("StatsPopover.qml")
    visible: false
    onLoaded: {
      root.injectPopover()
      Qt.callLater(root.injectPopover)
    }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    fontFamily: root.contentFontFamily
    text: " "
    labelVisible: false
    tooltipText: "Typing Test"
    // Keep the badge inside the same fixed horizontal slot as ordinary bar
    // icons. The content-width fallback made text badges sit closer together
    // than OpticalGlyph-based widgets.
    fixedWidth: button.vertical ? -1 : Math.max(
      Style.bar.iconSlot, badge.width + Style.space(4))

    Rectangle {
      id: badge
      anchors.centerIn: parent
      width: badgeText.implicitWidth + Style.space(4)
      height: Math.max(Style.space(12), badgeText.font.pixelSize + Style.space(3))
      color: "transparent"
      border.width: Math.max(1, Style.normalBorderWidth)
      border.color: button.active && button.useActiveColor ? button.activeColor : button.foreground
      radius: Style.cornerRadius

      Text {
        id: badgeText
        anchors.centerIn: parent
        anchors.verticalCenterOffset: Style.space(1)
        text: "WPM"
        color: button.active && button.useActiveColor ? button.activeColor : button.foreground
        font.family: root.contentFontFamily
        font.pixelSize: Math.max(Style.space(6), Math.round(Style.font.caption * 0.62))
        renderType: Text.NativeRendering
      }
    }

    onPressed: function(mouseButton) {
      if (mouseButton === Qt.RightButton && popoverLoader.item)
        popoverLoader.item.openPanel("setup")
      else
        root.toggle()
    }
  }
}
