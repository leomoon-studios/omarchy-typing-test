import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/KeyboardHeatmap.js" as Heatmap

BorderSurface {
  id: root

  property var rows: []
  property string language: "en"
  property string fontFamily: Style.font.family
  property string selectedFinger: "left-index"
  readonly property var heatmapData: Heatmap.aggregate(rows, language)
  readonly property var weakTargets: Heatmap.weakestTargets(heatmapData)
  readonly property real keyWidth: Math.max(Style.space(34), Math.min(Style.space(64),
    (width - contentLeftInset - contentRightInset - Style.spacing.xs * 11) / 12))

  signal drillRequested(var characters, string label)

  function startDrill(characters, label) {
    if (Array.isArray(characters) && characters.length > 0)
      drillRequested(characters, label)
  }

  function keyFill(item, focused, hovered) {
    if (focused || hovered) return Style.hoverFillFor(Color.foreground, Color.accent)
    if (Number(item.opportunities || 0) <= 0) return Style.normalFillFor(Color.foreground, Color.accent)
    return Style.normalFillFor(Color.foreground, item.heat >= 0.45 ? Color.urgent : Color.accent)
  }

  implicitHeight: heatmapContent.implicitHeight + contentTopInset + contentBottomInset
  color: Style.normalFillFor(Color.foreground, Color.accent)
  borderSpec: Border.controlSpec("normal", Color.foreground, Color.accent)
  radius: Style.cornerRadius
  padding: Style.spacing.md

  ColumnLayout {
    id: heatmapContent
    anchors.fill: parent
    anchors.topMargin: root.contentTopInset
    anchors.rightMargin: root.contentRightInset
    anchors.bottomMargin: root.contentBottomInset
    anchors.leftMargin: root.contentLeftInset
    spacing: Style.spacing.sm

    Text {
      text: (root.language === "fa" ? "PARSI" : "ENGLISH") + " KEYBOARD HEATMAP"
      color: Color.accent
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      Layout.fillWidth: true
    }

    Text {
      text: "Each key shows characters per minute, typing opportunities, and first-attempt error rate for the active comparison. Select a key to drill it."
      color: Color.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.bodySmall
      wrapMode: Text.WordWrap
      Layout.fillWidth: true
    }

    Repeater {
      model: root.heatmapData.rows

      RowLayout {
        required property var modelData
        Layout.alignment: Qt.AlignHCenter
        spacing: Style.spacing.xs

        Repeater {
          model: parent.modelData

          BorderSurface {
            id: keySurface
            required property var modelData
            property bool hovered: keyMouse.containsMouse
            activeFocusOnTab: true
            Layout.preferredWidth: root.keyWidth
            Layout.preferredHeight: Style.space(68)
            color: root.keyFill(modelData, activeFocus, hovered)
            borderSpec: Border.controlSpec(activeFocus ? "focus" : (hovered ? "hover-cursor" : "normal"),
              modelData.heat >= 0.45 && modelData.opportunities > 0 ? Color.urgent : Color.foreground,
              Color.accent)
            radius: Style.cornerRadius
            padding: Style.spacing.xs

            Column {
              anchors.centerIn: parent
              width: parent.width - keySurface.contentLeftInset - keySurface.contentRightInset
              spacing: 0

              Text {
                width: parent.width
                text: keySurface.modelData.character
                color: Color.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.heading
                font.bold: true
                horizontalAlignment: Text.AlignHCenter
              }

              Text {
                width: parent.width
                text: keySurface.modelData.timedAttempts > 0
                  ? Math.round(keySurface.modelData.speedCpm) + " CPM" : "— CPM"
                color: keySurface.modelData.heat >= 0.45 && keySurface.modelData.opportunities > 0
                  ? Color.urgent : Color.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                horizontalAlignment: Text.AlignHCenter
                elide: Text.ElideRight
              }

              Text {
                width: parent.width
                text: Math.round(keySurface.modelData.opportunities || 0) + " tries · "
                  + Math.round(Number(keySurface.modelData.errorRate || 0) * 100) + "% err"
                color: Color.muted
                font.family: root.fontFamily
                font.pixelSize: Math.max(Style.space(8), Style.font.caption - 1)
                horizontalAlignment: Text.AlignHCenter
                elide: Text.ElideRight
              }
            }

            Keys.onReturnPressed: function(event) {
              root.startDrill([keySurface.modelData.character], "Key " + keySurface.modelData.character)
              event.accepted = true
            }
            Keys.onEnterPressed: function(event) {
              root.startDrill([keySurface.modelData.character], "Key " + keySurface.modelData.character)
              event.accepted = true
            }
            Keys.onSpacePressed: function(event) {
              root.startDrill([keySurface.modelData.character], "Key " + keySurface.modelData.character)
              event.accepted = true
            }

            MouseArea {
              id: keyMouse
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: {
                keySurface.forceActiveFocus()
                root.startDrill([keySurface.modelData.character], "Key " + keySurface.modelData.character)
              }
            }
          }
        }
      }
    }

    GridLayout {
      columns: width >= Style.space(700) ? 5 : 2
      columnSpacing: Style.spacing.sm
      rowSpacing: Style.spacing.sm
      Layout.fillWidth: true

      Button {
        text: root.weakTargets.length > 0 ? "Drill weak keys" : "No weak-key data"
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        enabled: root.weakTargets.length > 0
        Layout.fillWidth: true
        onClicked: root.startDrill(root.weakTargets, "Weak keys")
      }

      Button {
        text: "Drill left hand"
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        Layout.fillWidth: true
        onClicked: root.startDrill(Heatmap.targetsForHand(root.heatmapData, "left"), "Left hand")
      }

      Button {
        text: "Drill right hand"
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        Layout.fillWidth: true
        onClicked: root.startDrill(Heatmap.targetsForHand(root.heatmapData, "right"), "Right hand")
      }

      Dropdown {
        label: "Finger"
        fontFamily: root.fontFamily
        value: root.selectedFinger
        options: [
          { value: "left-pinky", label: "Left pinky" },
          { value: "left-ring", label: "Left ring" },
          { value: "left-middle", label: "Left middle" },
          { value: "left-index", label: "Left index" },
          { value: "right-index", label: "Right index" },
          { value: "right-middle", label: "Right middle" },
          { value: "right-ring", label: "Right ring" },
          { value: "right-pinky", label: "Right pinky" }
        ]
        Layout.fillWidth: true
        onChanged: function(value) { root.selectedFinger = String(value) }
      }

      Button {
        text: "Drill finger"
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        Layout.fillWidth: true
        onClicked: root.startDrill(Heatmap.targetsForFinger(root.heatmapData, root.selectedFinger),
          root.selectedFinger.replace("-", " "))
      }
    }
  }
}
