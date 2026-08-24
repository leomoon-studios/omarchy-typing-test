import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

BorderSurface {
  id: root

  property string title: "Progress"
  property string suffix: ""
  property string fontFamily: Style.font.family
  property var points: []
  property int selectedIndex: points && points.length > 0 ? points.length - 1 : -1
  property color lineColor: Color.accent
  signal pointActivated(var point)

  activeFocusOnTab: points && points.length > 0
  implicitHeight: Style.space(152)
  color: Style.normalFillFor(Color.foreground, Color.accent)
  borderSpec: Border.controlSpec(activeFocus ? "focus" : "normal", Color.foreground, Color.accent)
  radius: Style.cornerRadius
  padding: Style.spacing.md

  function selectedPoint() {
    return selectedIndex >= 0 && points && selectedIndex < points.length ? points[selectedIndex] : null
  }

  function selectFromX(position, availableWidth) {
    if (!points || points.length === 0 || availableWidth <= 0) return
    selectedIndex = Math.max(0, Math.min(points.length - 1,
      Math.round(position / availableWidth * Math.max(0, points.length - 1))))
    chart.requestPaint()
  }

  function activateSelection() {
    var point = selectedPoint()
    if (point) pointActivated(point)
  }

  onPointsChanged: {
    selectedIndex = points && points.length > 0 ? points.length - 1 : -1
    chart.requestPaint()
  }
  onSelectedIndexChanged: chart.requestPaint()

  Keys.onLeftPressed: function(event) {
    if (selectedIndex > 0) selectedIndex--
    event.accepted = true
  }
  Keys.onRightPressed: function(event) {
    if (points && selectedIndex < points.length - 1) selectedIndex++
    event.accepted = true
  }
  Keys.onReturnPressed: function(event) { root.activateSelection(); event.accepted = true }
  Keys.onEnterPressed: function(event) { root.activateSelection(); event.accepted = true }
  Keys.onSpacePressed: function(event) { root.activateSelection(); event.accepted = true }

  ColumnLayout {
    anchors.fill: parent
    anchors.topMargin: root.contentTopInset
    anchors.rightMargin: root.contentRightInset
    anchors.bottomMargin: root.contentBottomInset
    anchors.leftMargin: root.contentLeftInset
    spacing: Style.spacing.xs

    RowLayout {
      Layout.fillWidth: true

      Text {
        text: root.title.toUpperCase()
        color: Color.muted
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
        Layout.fillWidth: true
      }

      Text {
        readonly property var point: root.selectedPoint()
        text: point ? Number(point.value || 0).toFixed(1) + root.suffix : "—"
        color: root.lineColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        font.bold: true
      }
    }

    Item {
      id: chartArea
      Layout.fillWidth: true
      Layout.fillHeight: true

      Canvas {
        id: chart
        anchors.fill: parent

        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
        onPaint: {
          var context = getContext("2d")
          context.clearRect(0, 0, width, height)
          context.globalAlpha = 1
          var values = root.points || []
          if (values.length < 2 || width <= 0 || height <= 0) return

          var minimum = Number(values[0].value) || 0
          var maximum = minimum
          for (var index = 1; index < values.length; index++) {
            var value = Number(values[index].value) || 0
            minimum = Math.min(minimum, value)
            maximum = Math.max(maximum, value)
          }
          if (maximum === minimum) { maximum += 1; minimum = Math.max(0, minimum - 1) }

          var top = Style.space(5)
          var bottom = height - Style.space(5)
          var usableHeight = Math.max(1, bottom - top)
          context.strokeStyle = String(Color.muted)
          context.globalAlpha = 0.2
          context.lineWidth = Math.max(1, Style.normalBorderWidth)
          context.beginPath()
          context.moveTo(0, bottom)
          context.lineTo(width, bottom)
          context.stroke()

          context.globalAlpha = 1
          context.strokeStyle = String(root.lineColor)
          context.lineWidth = Math.max(1.5, Style.normalBorderWidth * 2)
          context.beginPath()
          for (var pointIndex = 0; pointIndex < values.length; pointIndex++) {
            var x = pointIndex / Math.max(1, values.length - 1) * width
            var normalized = (Number(values[pointIndex].value) - minimum) / (maximum - minimum)
            var y = bottom - normalized * usableHeight
            if (pointIndex === 0) context.moveTo(x, y)
            else context.lineTo(x, y)
          }
          context.stroke()

          for (var dotIndex = 0; dotIndex < values.length; dotIndex++) {
            var dotX = dotIndex / Math.max(1, values.length - 1) * width
            var dotNormalized = (Number(values[dotIndex].value) - minimum) / (maximum - minimum)
            var dotY = bottom - dotNormalized * usableHeight
            context.beginPath()
            context.arc(dotX, dotY, dotIndex === root.selectedIndex ? Style.space(3) : Style.space(1.5), 0, Math.PI * 2)
            context.fillStyle = dotIndex === root.selectedIndex ? String(Color.foreground) : String(root.lineColor)
            context.fill()
          }
        }
      }

      MouseArea {
        anchors.fill: parent
        cursorShape: root.points && root.points.length > 0 ? Qt.PointingHandCursor : Qt.ArrowCursor
        onClicked: function(mouse) {
          root.forceActiveFocus()
          root.selectFromX(mouse.x, width)
          root.activateSelection()
        }
      }
    }

    Text {
      readonly property var point: root.selectedPoint()
      text: point && point.completedAt
        ? new Date(point.completedAt).toLocaleDateString(Qt.locale(), "yyyy-MM-dd") + "  ·  Enter opens result"
        : root.points && root.points.length === 1 ? "More tests are needed to draw a trend." : "No compatible data."
      color: Color.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      Layout.fillWidth: true
      elide: Text.ElideRight
    }
  }
}
