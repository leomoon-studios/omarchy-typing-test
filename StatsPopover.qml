import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

Panel {
    id: root

    property var anchorItem: null
    property var hostWidget: null
    readonly property var barIdentity: hostWidget || root
    readonly property color contentForeground: bar ? bar.foreground : Color.foreground
    readonly property string contentFontFamily: bundledFont.name !== ""
        ? bundledFont.name
        : (bar ? bar.fontFamily : Style.font.family)
    readonly property bool popoutSwitchClosing: controller.open ? false : root._switchClosing
    property bool _switchClosing: false
    property bool cursorActive: false
    property int selectedAction: 0
    readonly property var latest: store.latest()
    readonly property string activeLanguage: String(store.settings.defaultLanguage || "en")
    readonly property string comparisonTestType: String(store.settings.defaultTestType || "timed")
    readonly property int comparisonDuration: Number(store.settings.defaultDurationSeconds || 60)
    readonly property int comparisonWordCount: Number(store.settings.defaultWordCount || 25)
    readonly property var comparisonScope: ({
        testType: comparisonTestType,
        durationSeconds: comparisonTestType === "timed" ? comparisonDuration : "all",
        targetWordCount: comparisonTestType === "words" ? comparisonWordCount : "all",
        mode: "standard"
    })
    readonly property var bestWpm: store.best(activeLanguage, comparisonScope)
    readonly property var averageAccuracy: store.averageAccuracy(activeLanguage, comparisonScope)
    FontLoader {
        id: bundledFont
        source: Qt.resolvedUrl("assets/fonts/Vazirmatn-Regular.ttf")
    }

    function open() {
        cursorActive = false;
        selectedAction = 0;
        controller.show();
        store.historyRevision;
        Qt.callLater(function() {
            keyCatcher.forceActiveFocus();
        });
    }

    function close() {
        controller.hide();
    }

    function toggle() {
        opened ? close() : open();
    }

    function refresh() {
        store.refresh();
    }

    function selectAction(index) {
        cursorActive = true;
        selectedAction = Math.max(0, Math.min(3, Number(index)));
    }

    function compactDuration(seconds) {
        var value = Math.max(15, Math.round(Number(seconds) || 60));
        if (value < 60) return value + "s";
        if (value % 60 === 0) return (value / 60) + "m";
        return Math.floor(value / 60) + "m" + (value % 60) + "s";
    }

    function comparisonLabel() {
        var format = comparisonTestType === "words" ? comparisonWordCount + "W"
            : comparisonTestType === "passage" ? "PASSAGE" : compactDuration(comparisonDuration);
        return (activeLanguage === "fa" ? "PA" : "EN") + " · " + format + " STD";
    }

    function moveVertical(direction) {
        cursorActive = true;
        if (selectedAction === 0)
            selectedAction = direction > 0 ? 1 : 3;
        else
            selectedAction = 0;
    }

    function moveHorizontal(direction) {
        cursorActive = true;
        if (selectedAction === 0) {
            selectedAction = direction > 0 ? 1 : 3;
            return;
        }

        var bottomIndex = selectedAction - 1;
        bottomIndex = (bottomIndex + direction + 3) % 3;
        selectedAction = bottomIndex + 1;
    }

    function activateSelected() {
        if (selectedAction === 0) openPanel("setup");
        else if (selectedAction === 1) openPanel("progress");
        else if (selectedAction === 2) openPanel("history");
        else openPanel("settings");
    }

    function handleKey(event) {
        if (event.key === Qt.Key_Escape) {
            close();
        } else if (event.key === Qt.Key_Up) {
            moveVertical(-1);
        } else if (event.key === Qt.Key_Down) {
            moveVertical(1);
        } else if (event.key === Qt.Key_Left || event.key === Qt.Key_Backtab) {
            moveHorizontal(-1);
        } else if (event.key === Qt.Key_Right || event.key === Qt.Key_Tab) {
            moveHorizontal(1);
        } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) {
            cursorActive = true;
            activateSelected();
        } else {
            return false;
        }

        return true;
    }

    function closeForPopoutSwitch() {
        _switchClosing = true;
        close();
        Qt.callLater(function() {
            root._switchClosing = false;
        });
    }

    function openPanel(viewName) {
        close();
        Qt.callLater(function() {
            if (root.bar && root.bar.shell && typeof root.bar.shell.summon === "function")
                root.bar.shell.summon(root.moduleName, JSON.stringify({
                    "view": viewName || "setup"
                }));

        });
    }

    moduleName: "leomoon-studios.omarchy-typing-test"
    manageIpc: false

    Timer {
        interval: 2000
        repeat: true
        running: true
        onTriggered: store.refresh()
    }

    DataStore {
        id: store
    }

    KeyboardPanel {
        id: popover

        anchorItem: root.anchorItem
        owner: root.barIdentity
        bar: root.bar
        open: root.opened
        focusTarget: keyCatcher
        contentWidth: fittedContentWidth(Style.space(310))
        contentHeight: fittedContentHeight(content.implicitHeight)

        Item {
            id: keyCatcher

            anchors.fill: parent
            focus: true
            Keys.priority: Keys.BeforeItem
            Keys.onPressed: function(event) {
                if (root.handleKey(event)) event.accepted = true;
            }

            Flickable {
                anchors.fill: parent
                contentWidth: width
                contentHeight: content.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds

                Column {
                    id: content

                    width: parent.width
                    spacing: Style.space(12)

                    PanelHero {
                        title: "Typing Test"
                        meta: "TOUCH TYPING PRACTICE"
                        detail: store.history.length + (store.history.length === 1 ? " test" : " tests")
                        foreground: root.contentForeground
                        fontFamily: root.contentFontFamily

                        iconComponent: Component {
                            OpticalGlyph {
                                implicitWidth: Style.space(32)
                                implicitHeight: Style.space(32)
                                width: implicitWidth
                                height: implicitHeight
                                text: "⌨"
                                color: root.contentForeground
                                fontFamily: root.contentFontFamily
                                fontSize: Style.font.display
                            }

                        }

                    }

                    Text {
                        visible: store.lastError !== ""
                        width: parent.width
                        text: store.lastError
                        color: Color.urgent
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.caption
                        wrapMode: Text.WordWrap
                    }

                    GridLayout {
                        columns: 2
                        width: parent.width
                        rowSpacing: Style.space(6)
                        columnSpacing: Style.space(12)

                        Text {
                            text: "Latest"
                            color: root.contentForeground
                            opacity: 0.55
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.bodySmall
                            Layout.alignment: Qt.AlignVCenter
                        }

                        Text {
                            text: root.latest ? Number(root.latest.netWpm).toFixed(1) + " WPM" : "—"
                            color: root.contentForeground
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.body
                            font.bold: true
                            horizontalAlignment: Text.AlignLeft
                            Layout.fillWidth: true
                            Layout.alignment: Qt.AlignVCenter
                        }

                        Text {
                            text: "Best (" + root.comparisonLabel() + ")"
                            color: root.contentForeground
                            opacity: 0.55
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.bodySmall
                            Layout.alignment: Qt.AlignVCenter
                        }

                        Text {
                            text: root.bestWpm === null ? "—" : Number(root.bestWpm).toFixed(1) + " WPM"
                            color: root.contentForeground
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.body
                            font.bold: true
                            horizontalAlignment: Text.AlignLeft
                            Layout.fillWidth: true
                            Layout.alignment: Qt.AlignVCenter
                        }

                        Text {
                            text: "Avg accuracy (" + root.comparisonLabel() + ")"
                            color: root.contentForeground
                            opacity: 0.55
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.bodySmall
                            Layout.alignment: Qt.AlignVCenter
                        }

                        Text {
                            text: root.averageAccuracy === null ? "—" : Number(root.averageAccuracy).toFixed(1) + "%"
                            color: root.contentForeground
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.body
                            font.bold: true
                            horizontalAlignment: Text.AlignLeft
                            Layout.fillWidth: true
                            Layout.alignment: Qt.AlignVCenter
                        }

                    }

                    PanelSeparator {
                        foreground: root.contentForeground
                    }

                    Button {
                        width: parent.width
                        text: "Start Typing Test"
                        iconText: "⌨"
                        fontFamily: root.contentFontFamily
                        bordered: true
                        focusable: false
                        hasCursor: root.cursorActive && root.selectedAction === 0
                        foreground: root.contentForeground
                        onHovered: function(isHovered) { if (isHovered) root.selectAction(0) }
                        onClicked: root.openPanel("setup")
                    }

                    Row {
                        width: parent.width
                        spacing: Style.space(6)

                        Button {
                            width: (parent.width - parent.spacing * 2) / 3
                            text: "Progress"
                            fontFamily: root.contentFontFamily
                            bordered: true
                            focusable: false
                            hasCursor: root.cursorActive && root.selectedAction === 1
                            foreground: root.contentForeground
                            onHovered: function(isHovered) { if (isHovered) root.selectAction(1) }
                            onClicked: root.openPanel("progress")
                        }

                        Button {
                            width: (parent.width - parent.spacing * 2) / 3
                            text: "History"
                            fontFamily: root.contentFontFamily
                            bordered: true
                            focusable: false
                            hasCursor: root.cursorActive && root.selectedAction === 2
                            foreground: root.contentForeground
                            onHovered: function(isHovered) { if (isHovered) root.selectAction(2) }
                            onClicked: root.openPanel("history")
                        }

                        Button {
                            width: (parent.width - parent.spacing * 2) / 3
                            text: "Settings"
                            fontFamily: root.contentFontFamily
                            bordered: true
                            focusable: false
                            hasCursor: root.cursorActive && root.selectedAction === 3
                            foreground: root.contentForeground
                            onHovered: function(isHovered) { if (isHovered) root.selectAction(3) }
                            onClicked: root.openPanel("settings")
                        }

                    }

                }

            }

        }

    }

}
