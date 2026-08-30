import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/KeyboardNavigation.js" as KeyboardNavigation

Item {
    id: root

    property var store: null
    property string fontFamily: Style.font.family
    property string importLanguage: "en"
    property string importCollection: "My passages"
    property string importStatus: ""
    property string pendingClearLanguage: ""
    readonly property real importControlHeight: Style.spacing.controlHeight

    signal backRequested()

    focus: true

    function revealKeyboardTarget(item) {
        if (!item || !settingsScroll.contentItem || settingsScroll.contentItem.contentY === undefined)
            return;
        if (!KeyboardNavigation.contains(settingsContent, item))
            return;

        var position = item.mapToItem(settingsContent, 0, 0);
        var top = position.y;
        var bottom = top + item.height;
        var flickable = settingsScroll.contentItem;
        var viewportHeight = settingsScroll.availableHeight;
        if (top < flickable.contentY)
            flickable.contentY = Math.max(0, top - Style.spacing.sm);
        else if (bottom > flickable.contentY + viewportHeight)
            flickable.contentY = Math.max(0, bottom - viewportHeight + Style.spacing.sm);
    }

    function moveKeyboardFocus(forward) {
        var window = root.Window.window;
        var current = window && window.activeFocusItem ? window.activeFocusItem : root;
        var target = KeyboardNavigation.focusNext(root, current, forward);
        if (target) Qt.callLater(function() { root.revealKeyboardTarget(target) });
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

    Connections {
        function onImportFinished(count, collection) {
            root.importStatus = "Imported " + count + " passages into “" + collection + "”.";
        }

        function onImportFailed(message) {
            root.importStatus = message;
        }

        target: root.store
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: Style.spacing.md

        Text {
            id: settingsHeader
            text: "Settings"
            color: Color.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.display
            font.bold: true
            Layout.fillWidth: true
        }

        ScrollView {
            id: settingsScroll

            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            rightPadding: settingsContent.implicitHeight > height + 0.5
                ? settingsScroll.ScrollBar.vertical.width + Style.spacing.sm
                : 0
            contentWidth: availableWidth
            ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
            ScrollBar.vertical.policy: ScrollBar.AsNeeded

            ColumnLayout {
                id: settingsContent

                width: settingsScroll.availableWidth
                spacing: Style.spacing.md

            Toggle {
                label: "Show live WPM"
                fontFamily: root.fontFamily
                description: "Display gross speed while a test is running."
                checked: root.store ? root.store.settings.showLiveWpm !== false : true
                Layout.fillWidth: true
                onClicked: {
                    if (root.store) {
                        root.store.saveSettings({
                        "showLiveWpm": !checked
                    });
                    }
                }
            }

            Toggle {
                label: "Show live accuracy"
                fontFamily: root.fontFamily
                description: "Display accuracy while a test is running."
                checked: root.store ? root.store.settings.showLiveAccuracy !== false : true
                Layout.fillWidth: true
                onClicked: {
                    if (root.store) {
                        root.store.saveSettings({
                        "showLiveAccuracy": !checked
                    });
                    }
                }
            }

            Toggle {
                label: "Count Zero Width Non-Joiner differences"
                fontFamily: root.fontFamily
                description: "Recommended for precise Parsi spacing practice."
                checked: root.store ? root.store.settings.zwnjCountsAsError !== false : true
                Layout.fillWidth: true
                onClicked: {
                    if (root.store) {
                        root.store.saveSettings({
                        "zwnjCountsAsError": !checked
                    });
                    }
                }
            }

            Toggle {
                label: "Include corrected errors"
                fontFamily: root.fontFamily
                description: "Use corrected mistakes in difficult-character statistics."
                checked: root.store ? root.store.settings.includeCorrectedErrorsInDifficulty !== false : true
                Layout.fillWidth: true
                onClicked: {
                    if (root.store) {
                        root.store.saveSettings({
                        "includeCorrectedErrorsInDifficulty": !checked
                    });
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Style.spacing.lg

                Dropdown {
                    label: "Parsi comparison"
                    fontFamily: root.fontFamily
                    value: root.store ? String(root.store.settings.persianNormalization || "forgiving") : "forgiving"
                    options: [{
                        "value": "forgiving",
                        "label": "Forgiving"
                    }, {
                        "value": "strict",
                        "label": "Strict"
                    }]
                    Layout.fillWidth: true
                    onChanged: function(value) {
                        if (root.store)
                            root.store.saveSettings({
                            "persianNormalization": value
                        });

                    }
                }

                Dropdown {
                    label: "Digit comparison"
                    fontFamily: root.fontFamily
                    value: root.store ? String(root.store.settings.digitNormalization || "exact") : "exact"
                    options: [{
                        "value": "exact",
                        "label": "Exact"
                    }, {
                        "value": "persian-arabic",
                        "label": "Parsi & Arabic"
                    }, {
                        "value": "all",
                        "label": "All digits"
                    }]
                    Layout.fillWidth: true
                    onChanged: function(value) {
                        if (root.store)
                            root.store.saveSettings({
                            "digitNormalization": value
                        });

                    }
                }

            }

            PanelSeparator {
                Layout.fillWidth: true
            }

            Text {
                text: "TRAINING"
                color: Color.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
            }

            Toggle {
                label: "Show coaching summaries"
                fontFamily: root.fontFamily
                description: "Show local, history-based observations after completed tests."
                checked: root.store ? root.store.settings.coachingEnabled !== false : true
                Layout.fillWidth: true
                onClicked: {
                    if (root.store)
                        root.store.saveSettings({ "coachingEnabled": !checked });
                }
            }

            NumberField {
                label: "Adaptive history window"
                fontFamily: root.fontFamily
                from: 5
                to: 50
                value: root.store ? Number(root.store.settings.adaptiveHistoryWindow || 10) : 10
                Layout.fillWidth: true
                onModified: function(value) {
                    if (root.store)
                        root.store.saveSettings({ "adaptiveHistoryWindow": value });
                }
            }

            PanelSeparator {
                Layout.fillWidth: true
            }

            Text {
                text: "IMPORT UTF-8 TEXT"
                color: Color.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
            }

            Text {
                text: "Blank lines separate passages. Imported text stays local in the application data directory."
                color: Color.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Style.spacing.md

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.preferredWidth: 1
                    spacing: Style.spacing.labelGap

                    Text {
                        text: "Language"
                        color: Color.muted
                        font.family: root.fontFamily
                        font.pixelSize: Style.font.caption
                        font.bold: true
                    }

                    Dropdown {
                        showLabel: false
                        fontFamily: root.fontFamily
                        value: root.importLanguage
                        options: [{
                            "value": "en",
                            "label": "English"
                        }, {
                            "value": "fa",
                            "label": "پارسی"
                        }]
                        Layout.fillWidth: true
                        Layout.preferredHeight: root.importControlHeight
                        onChanged: function(value) {
                            root.importLanguage = value;
                        }
                    }

                }

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.preferredWidth: 1
                    spacing: Style.spacing.labelGap

                    Text {
                        text: "Collection"
                        color: Color.muted
                        font.family: root.fontFamily
                        font.pixelSize: Style.font.caption
                        font.bold: true
                    }

                    TextField {
                        id: importCollectionField
                        placeholderText: "Collection name"
                        text: root.importCollection
                        font.family: root.fontFamily
                        verticalPadding: 0
                        verticalAlignment: TextInput.AlignVCenter
                        Layout.fillWidth: true
                        Layout.preferredHeight: root.importControlHeight
                        onTextChanged: root.importCollection = text
                    }

                }

                ColumnLayout {
                    spacing: Style.spacing.labelGap

                    Text {
                        text: "Text file"
                        color: Color.muted
                        font.family: root.fontFamily
                        font.pixelSize: Style.font.caption
                        font.bold: true
                    }

                    Button {
                        text: root.store && root.store.importInProgress ? "Importing..." : "Choose .txt"
                        fontFamily: root.fontFamily
                        bordered: true
                        focusable: true
                        enabled: root.store && !root.store.importInProgress
                        Layout.preferredHeight: root.importControlHeight
                        onClicked: {
                            root.importStatus = "Importing selected text...";
                            if (root.store)
                                root.store.chooseImport(root.importLanguage, root.importCollection);

                        }
                    }

                }

            }

            Text {
                visible: root.importStatus !== ""
                text: root.importStatus
                color: root.importStatus.indexOf("Imported ") === 0 || root.importStatus.indexOf("Importing ") === 0
                    ? Color.accent : Color.urgent
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }

            RowLayout {
                Layout.fillWidth: true
                visible: root.store && (root.store.customEnglishText !== "" || root.store.customPersianText !== "")

                Text {
                    text: "Remove imported passages:"
                    color: Color.muted
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                }

                Button {
                    visible: root.store && root.store.customEnglishText !== ""
                    enabled: root.store && !root.store.importInProgress
                    text: "English"
                    fontFamily: root.fontFamily
                    bordered: true
                    foreground: Color.urgent
                    focusable: true
                    Layout.preferredWidth: Style.space(100)
                    Layout.preferredHeight: Style.spacing.controlHeight
                    onClicked: {
                        root.pendingClearLanguage = "en";
                        clearImportsDialog.message = "Remove all imported English passages?";
                        clearImportsDialog.opened = true;
                    }
                }

                Button {
                    visible: root.store && root.store.customPersianText !== ""
                    enabled: root.store && !root.store.importInProgress
                    text: "پارسی"
                    fontFamily: root.fontFamily
                    bordered: true
                    foreground: Color.urgent
                    focusable: true
                    Layout.preferredWidth: Style.space(100)
                    Layout.preferredHeight: Style.spacing.controlHeight
                    onClicked: {
                        root.pendingClearLanguage = "fa";
                        clearImportsDialog.message = "Remove all imported Parsi passages?";
                        clearImportsDialog.opened = true;
                    }
                }

            }

            }
        }

        RowLayout {
            id: settingsFooter
            Layout.fillWidth: true

            Button {
                text: "Back"
                fontFamily: root.fontFamily
                bordered: true
                focusable: true
                onClicked: root.backRequested()
            }

            Item { Layout.fillWidth: true }
        }
    }

    KeyboardConfirmDialog {
        id: clearImportsDialog

        fontFamily: root.fontFamily
        restoreFocusItem: root

        anchors.fill: parent
        confirmText: "Remove"
        onCanceled: {
            opened = false;
            root.pendingClearLanguage = "";
        }
        onConfirmed: {
            opened = false;
            var removed = root.store && root.store.clearCustom(root.pendingClearLanguage);
            root.importStatus = removed
                ? "Imported passages removed."
                : root.store && root.store.importInProgress
                    ? "Wait for the current text import to finish before removing imported passages."
                    : "Imported passages could not be removed.";
            root.pendingClearLanguage = "";
        }
    }

}
