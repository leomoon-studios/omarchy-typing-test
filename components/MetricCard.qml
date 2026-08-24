import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

BorderSurface {
  id: root
  property string label: ""
  property string value: "—"
  property string fontFamily: Style.font.family
  property color valueColor: Color.foreground
  property bool prominent: false
  property bool compact: false
  color: Style.normalFillFor(Color.foreground, Color.accent)
  borderSpec: Border.controlSpec("normal", Color.foreground, Color.accent)
  radius: Style.cornerRadius
  implicitWidth: Style.space(150)
  implicitHeight: prominent ? Style.space(82) : (compact ? Style.space(52) : Style.space(70))
  padding: Style.spacing.md

  Rectangle {
    visible: root.prominent
    anchors.left: parent.left
    anchors.leftMargin: root.borderLeft + Style.spacing.sm
    anchors.verticalCenter: parent.verticalCenter
    width: Math.max(Style.space(2), Style.normalBorderWidth * 2)
    height: parent.height - root.borderTop - root.borderBottom - Style.spacing.lg * 2
    color: Color.accent
    radius: Style.cornerRadius
  }

  Column {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.leftMargin: root.contentLeftInset + (root.prominent ? Style.spacing.md : 0)
    anchors.rightMargin: root.contentRightInset
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.spacing.xs
    Text {
      width: parent.width
      text: root.label.toUpperCase()
      color: root.prominent ? Color.accent : Color.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      elide: Text.ElideRight
    }
    Text {
      width: parent.width
      text: root.value
      color: root.valueColor
      font.family: root.fontFamily
      font.pixelSize: root.prominent ? Style.font.display : (root.compact ? Style.font.heading : Style.font.title)
      font.bold: true
      elide: Text.ElideRight
    }
  }
}
