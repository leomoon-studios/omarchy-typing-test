import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

BorderSurface {
  id: root

  property var messages: []
  property string fontFamily: Style.font.family

  visible: Array.isArray(messages) && messages.length > 0
  implicitHeight: content.implicitHeight + contentTopInset + contentBottomInset
  color: Style.normalFillFor(Color.foreground, Color.accent)
  borderSpec: Border.controlSpec("normal", Color.accent, Color.accent)
  radius: Style.cornerRadius
  padding: Style.spacing.md

  ColumnLayout {
    id: content
    anchors.fill: parent
    anchors.topMargin: root.contentTopInset
    anchors.rightMargin: root.contentRightInset
    anchors.bottomMargin: root.contentBottomInset
    anchors.leftMargin: root.contentLeftInset
    spacing: Style.spacing.sm

    Text {
      text: "COACHING"
      color: Color.accent
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      Layout.fillWidth: true
    }

    Repeater {
      model: root.messages || []

      RowLayout {
        required property var modelData
        Layout.fillWidth: true
        spacing: Style.spacing.sm

        Text {
          text: "•"
          color: modelData.positive === true ? Color.accent : Color.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          Layout.alignment: Qt.AlignTop
        }

        Text {
          text: String(modelData.text || "")
          color: Color.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          wrapMode: Text.WordWrap
          Layout.fillWidth: true
        }
      }
    }
  }
}
