import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/AdaptivePractice.js" as AdaptivePractice
import "../js/KeyboardNavigation.js" as KeyboardNavigation

Item {
    id: root

    property var store: null
    property var library: null
    property string fontFamily: Style.font.family
    property string mode: "standard"
    property string language: store ? String(store.settings.defaultLanguage || "en") : "en"
    property int durationSeconds: store ? Number(store.settings.defaultDurationSeconds || 60) : 60
    property string category: store ? String(store.settings.defaultCategory || "common") : "common"
    property string difficulty: store ? String(store.settings.defaultDifficulty || "mixed") : "mixed"
    property int customSeconds: Math.max(15, durationSeconds)
    readonly property var adaptiveAnalysis: {
        if (store)
            store.historyRevision;

        return AdaptivePractice.rankTargets(store ? store.history : [], language,
            store ? store.settings : {}, store ? store.settings.adaptiveHistoryWindow : 10);
    }
    readonly property var englishCategories: [{
        "value": "common",
        "label": "Common"
    }, {
        "value": "literature",
        "label": "Literature"
    }, {
        "value": "programming",
        "label": "Programming"
    }, {
        "value": "punctuation",
        "label": "Numbers & punctuation"
    }, {
        "value": "difficult",
        "label": "Difficult-character practice"
    }, {
        "value": "custom",
        "label": "Imported"
    }, {
        "value": "mixed",
        "label": "Mixed"
    }]
    readonly property var persianCategories: [{
        "value": "common",
        "label": "Common"
    }, {
        "value": "formal",
        "label": "Formal"
    }, {
        "value": "literature",
        "label": "Literature"
    }, {
        "value": "punctuation",
        "label": "Numbers & punctuation"
    }, {
        "value": "difficult",
        "label": "Difficult-character practice"
    }, {
        "value": "custom",
        "label": "Imported"
    }, {
        "value": "mixed",
        "label": "Mixed"
    }]

    signal startRequested(var options)
    signal navigateRequested(string view)

    focus: true

    function moveKeyboardFocus(forward) {
        var window = root.Window.window;
        var current = window && window.activeFocusItem ? window.activeFocusItem : root;
        KeyboardNavigation.focusNext(root, current, forward);
    }

    function chooseLanguage(value) {
        language = value;
        if (language === "fa" && category === "programming")
            category = "common";

        if (language === "en" && category === "formal")
            category = "common";

    }

    function start() {
        var selectedDuration = durationSeconds === 0 ? customSeconds : durationSeconds;
        var values = {
            "language": language,
            "durationSeconds": selectedDuration,
            "category": category,
            "difficulty": difficulty,
            "mode": mode,
            "adaptiveTargets": mode === "adaptive" ? adaptiveAnalysis.characters : [],
            "recentPassageIds": mode === "adaptive"
                ? AdaptivePractice.recentPassageIds(store ? store.history : [], language, 3)
                : []
        };
        if (store)
            store.saveSettings({
            "defaultLanguage": language,
            "defaultDurationSeconds": selectedDuration,
            "defaultCategory": category,
            "defaultDifficulty": difficulty
        });

        startRequested(values);
    }

    Keys.priority: Keys.AfterItem
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Left || event.key === Qt.Key_Up) {
            root.moveKeyboardFocus(false);
            event.accepted = true;
        } else if (event.key === Qt.Key_Right || event.key === Qt.Key_Down) {
            root.moveKeyboardFocus(true);
            event.accepted = true;
        }
    }

    Component.onCompleted: Qt.callLater(function() { root.forceActiveFocus() })

    ColumnLayout {
        anchors.fill: parent
        spacing: Style.spacing.lg

        Text {
            text: "Choose your test"
            color: Color.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.display
            font.bold: true
            Layout.fillWidth: true
        }

        Text {
            text: "The timer starts with your first character. Results stay on this computer."
            color: Color.muted
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
        }

        Text {
            text: "PRACTICE MODE"
            color: Color.muted
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
        }

        RowLayout {
            spacing: Style.spacing.sm

            Button {
                text: "Standard"
                fontFamily: root.fontFamily
                selected: root.mode === "standard"
                bordered: true
                focusable: true
                Layout.preferredWidth: Style.space(140)
                onClicked: root.mode = "standard"
            }

            Button {
                text: "Adaptive Practice"
                fontFamily: root.fontFamily
                selected: root.mode === "adaptive"
                bordered: true
                focusable: true
                Layout.preferredWidth: Style.space(180)
                onClicked: root.mode = "adaptive"
            }
        }

        Text {
            text: "LANGUAGE"
            color: Color.muted
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
        }

        RowLayout {
            spacing: Style.spacing.sm

            Button {
                text: "English"
                fontFamily: root.fontFamily
                selected: root.language === "en"
                bordered: true
                focusable: true
                Layout.preferredWidth: Style.space(100)
                Layout.preferredHeight: Style.spacing.controlHeight
                onClicked: root.chooseLanguage("en")
            }

            Button {
                text: "پارسی"
                fontFamily: root.fontFamily
                selected: root.language === "fa"
                bordered: true
                focusable: true
                Layout.preferredWidth: Style.space(100)
                Layout.preferredHeight: Style.spacing.controlHeight
                onClicked: root.chooseLanguage("fa")
            }

        }

        BorderSurface {
            visible: root.mode === "adaptive"
            Layout.fillWidth: true
            Layout.preferredHeight: adaptiveDetails.implicitHeight + contentTopInset + contentBottomInset
            color: Style.normalFillFor(Color.foreground, Color.accent)
            borderSpec: Border.controlSpec(root.adaptiveAnalysis.available ? "normal" : "disabled", Color.foreground, Color.accent)
            radius: Style.cornerRadius
            padding: Style.spacing.md

            ColumnLayout {
                id: adaptiveDetails
                anchors.fill: parent
                anchors.topMargin: parent.contentTopInset
                anchors.rightMargin: parent.contentRightInset
                anchors.bottomMargin: parent.contentBottomInset
                anchors.leftMargin: parent.contentLeftInset
                spacing: Style.spacing.xs

                Text {
                    text: root.adaptiveAnalysis.available ? "ADAPTIVE TARGETS" : "ADAPTIVE PRACTICE"
                    color: root.adaptiveAnalysis.available ? Color.accent : Color.muted
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: true
                    Layout.fillWidth: true
                }

                Text {
                    text: root.adaptiveAnalysis.available
                        ? root.adaptiveAnalysis.characters.join(root.language === "fa" ? "     " : "   ")
                        : root.adaptiveAnalysis.reason
                    color: root.adaptiveAnalysis.available ? Color.foreground : Color.muted
                    font.family: root.fontFamily
                    font.pixelSize: root.adaptiveAnalysis.available ? Style.font.heading : Style.font.bodySmall
                    font.bold: root.adaptiveAnalysis.available
                    wrapMode: Text.WordWrap
                    horizontalAlignment: root.language === "fa" && root.adaptiveAnalysis.available ? Text.AlignRight : Text.AlignLeft
                    Layout.fillWidth: true
                }

                Text {
                    visible: root.adaptiveAnalysis.available
                    text: "Based on " + root.adaptiveAnalysis.analyzedTests + " recent "
                        + (root.language === "fa" ? "Parsi" : "English") + " tests"
                    color: Color.muted
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                    Layout.fillWidth: true
                }
            }
        }

        Text {
            text: "DURATION"
            color: Color.muted
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
        }

        RowLayout {
            spacing: Style.spacing.sm

            Repeater {
                model: [{
                    "label": "1 min",
                    "value": 60
                }, {
                    "label": "3 min",
                    "value": 180
                }, {
                    "label": "5 min",
                    "value": 300
                }, {
                    "label": "10 min",
                    "value": 600
                }]

                Button {
                    required property var modelData

                    text: modelData.label
                    fontFamily: root.fontFamily
                    selected: root.durationSeconds === modelData.value
                    bordered: true
                    focusable: true
                    onClicked: root.durationSeconds = modelData.value
                }

            }

            Button {
                text: "Custom"
                fontFamily: root.fontFamily
                selected: root.durationSeconds === 0
                bordered: true
                focusable: true
                onClicked: root.durationSeconds = 0
            }

            NumberField {
                visible: root.durationSeconds === 0
                label: "Seconds"
                fontFamily: root.fontFamily
                from: 15
                to: 3600
                value: root.customSeconds
                onModified: function(value) {
                    root.customSeconds = value;
                }
            }

        }

        RowLayout {
            visible: root.mode === "standard"
            Layout.fillWidth: true
            spacing: Style.spacing.lg

            Dropdown {
                label: "Content"
                fontFamily: root.fontFamily
                value: root.category
                options: root.language === "fa" ? root.persianCategories : root.englishCategories
                Layout.fillWidth: true
                onChanged: function(value) {
                    root.category = value;
                }
            }

            Dropdown {
                label: "Difficulty"
                fontFamily: root.fontFamily
                value: root.difficulty
                options: [{
                    "value": "mixed",
                    "label": "Mixed"
                }, {
                    "value": "1",
                    "label": "Easy"
                }, {
                    "value": "2",
                    "label": "Medium"
                }, {
                    "value": "3",
                    "label": "Hard"
                }]
                Layout.fillWidth: true
                onChanged: function(value) {
                    root.difficulty = value;
                }
            }

        }

        Item {
            Layout.fillHeight: true
        }

        Text {
            visible: library && !library.ready
            text: library && library.lastError !== "" ? library.lastError : "Loading passage library…"
            color: library && library.lastError !== "" ? Color.urgent : Color.muted
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            Layout.alignment: Qt.AlignHCenter
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
        }

        GridLayout {
            Layout.fillWidth: true
            columns: width >= Style.space(620) ? 4 : 2
            columnSpacing: Style.spacing.sm
            rowSpacing: Style.spacing.sm

            Button {
                text: "History"
                fontFamily: root.fontFamily
                bordered: true
                focusable: true
                Layout.fillWidth: true
                onClicked: root.navigateRequested("history")
            }

            Button {
                text: "Progress"
                fontFamily: root.fontFamily
                bordered: true
                focusable: true
                Layout.fillWidth: true
                onClicked: root.navigateRequested("progress")
            }

            Button {
                text: "Settings"
                fontFamily: root.fontFamily
                bordered: true
                focusable: true
                Layout.fillWidth: true
                onClicked: root.navigateRequested("settings")
            }

            Button {
                text: root.mode === "adaptive" ? "Start Adaptive Test" : "Start Test"
                iconText: "⌨"
                fontFamily: root.fontFamily
                foreground: enabled ? Color.accent : Color.muted
                accent: Color.accent
                selected: enabled
                bordered: true
                focusable: true
                Layout.fillWidth: true
                enabled: library && library.ready && (root.mode !== "adaptive" || root.adaptiveAnalysis.available)
                onClicked: root.start()
            }

        }

    }

}
