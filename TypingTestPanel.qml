import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "components"
import "js/AdaptivePractice.js" as AdaptivePractice
import "js/Progress.js" as Progress

Item {
  id: root

  property var shell: null
  property var manifest: null
  property bool opened: false
  property string currentView: "setup"
  property var activeOptions: ({})
  property var currentResult: null
  property var resultComparison: null
  property var progressComparison: null
  property string confirmationAction: ""

  readonly property string pluginId: "leomoon-studios.omarchy-typing-test"
  readonly property string contentFontFamily: bundledFont.name !== ""
    ? bundledFont.name
    : Style.font.family
  readonly property string pluginDir: manifest && manifest.__sourceDir
    ? String(manifest.__sourceDir)
    : String(Qt.resolvedUrl(".")).replace(/^file:\/\//, "").replace(/\/$/, "")

  FontLoader {
    id: bundledFont
    source: Qt.resolvedUrl("assets/fonts/Vazirmatn-Regular.ttf")
  }

  function open(payloadJson) {
    var payload = {}
    try { payload = JSON.parse(payloadJson || "{}") || {} } catch (error) {}
    var requested = String(payload.view || "setup")
    currentView = ["setup", "progress", "history", "settings"].indexOf(requested) >= 0 ? requested : "setup"
    opened = true
    Qt.callLater(function() {
      if (viewLoader.item && typeof viewLoader.item.forceActiveFocus === "function") viewLoader.item.forceActiveFocus()
    })
  }

  function close() {
    opened = false
    confirmationAction = ""
  }

  function dismiss() {
    if (shell && typeof shell.hide === "function") shell.hide((manifest && manifest.id) || pluginId)
    else close()
  }

  function requestDismiss() {
    if (currentView === "test" && viewLoader.item && viewLoader.item.hasTyped) {
      confirmationAction = "dismiss"
      confirmDialog.message = "Discard the active typing test?"
      confirmDialog.confirmText = "Discard"
      confirmDialog.defaultSelectedIndex = 0
      confirmDialog.opened = true
    } else {
      dismiss()
    }
  }

  function requestRestart() {
    if (currentView !== "test") return
    if (viewLoader.item && viewLoader.item.hasTyped) {
      confirmationAction = "restart"
      confirmDialog.message = "Restart this typing test?"
      confirmDialog.confirmText = "Restart"
      confirmDialog.defaultSelectedIndex = 1
      confirmDialog.opened = true
    } else if (viewLoader.item) {
      viewLoader.item.start(activeOptions)
    }
  }

  function handleConfirmationKey(event) {
    return confirmDialog.opened && confirmDialog.handleDialogKey(event)
  }

  function confirmAction() {
    confirmDialog.opened = false
    if (confirmationAction === "dismiss") dismiss()
    else if (confirmationAction === "restart" && viewLoader.item) viewLoader.item.start(activeOptions)
    confirmationAction = ""
  }

  function startTest(options) {
    activeOptions = options
    currentView = "test"
  }

  function copyOptions(options) {
    var copy = {}
    for (var key in (options || {})) copy[key] = options[key]
    return copy
  }

  function retrySamePassage() {
    var options = copyOptions(activeOptions)
    options.retryRequested = true
    options.retryPassageIds = currentResult && Array.isArray(currentResult.passageIds)
      ? currentResult.passageIds.slice() : []
    startTest(options)
  }

  function newPassageSameSettings() {
    var options = copyOptions(activeOptions)
    options.retryRequested = false
    options.retryPassageIds = []
    startTest(options)
  }

  function startAdaptive(language, durationSeconds, testType, targetWordCount) {
    var selectedLanguage = language === "fa" ? "fa" : "en"
    var selectedTestType = testType === "words" ? "words" : "timed"
    var analysis = AdaptivePractice.rankTargets(dataStore.history, selectedLanguage, dataStore.settings)
    if (!analysis.available) {
      currentView = "setup"
      return
    }
    startTest({
      language: selectedLanguage,
      testType: selectedTestType,
      durationSeconds: selectedTestType === "timed" ? Math.max(15, Number(durationSeconds || 60)) : 0,
      targetWordCount: selectedTestType === "words" ? Math.max(10, Number(targetWordCount || 25)) : 0,
      category: "mixed",
      difficulty: "mixed",
      mode: "adaptive",
      adaptiveTargets: analysis.characters,
      adaptiveBigrams: analysis.bigrams,
      adaptiveWords: analysis.words,
      adaptiveHesitationCharacters: analysis.hesitationCharacters,
      recentPassageIds: AdaptivePractice.recentPassageIds(dataStore.history, selectedLanguage, 3)
    })
  }

  function finishTest(result) {
    currentResult = result
    var completedOptions = copyOptions(activeOptions)
    completedOptions.language = result.language || completedOptions.language || "en"
    completedOptions.testType = result.testType || completedOptions.testType || "timed"
    completedOptions.durationSeconds = completedOptions.testType === "timed" ? Number(result.configuredDurationSeconds || 60) : 0
    completedOptions.targetWordCount = completedOptions.testType === "words" ? Number(result.targetWordCount || 25) : 0
    completedOptions.category = result.category || "common"
    completedOptions.difficulty = result.difficulty || "mixed"
    completedOptions.mode = result.mode || "standard"
    completedOptions.adaptiveTargets = result.adaptiveTargets || []
    completedOptions.adaptiveBigrams = result.adaptiveBigrams || []
    completedOptions.adaptiveWords = result.adaptiveWords || []
    completedOptions.adaptiveHesitationCharacters = result.adaptiveHesitationCharacters || []
    completedOptions.retryRequested = false
    completedOptions.retryPassageIds = []
    activeOptions = completedOptions
    dataStore.appendResult(result)
    resultComparison = comparisonForResult(result)
    progressComparison = resultComparison
    currentView = "results"
  }

  function comparisonForResult(result) {
    if (!result) return null
    var language = result.language === "fa" ? "fa" : "en"
    var filters = {
      testType: String(result.testType || "timed"),
      durationSeconds: String(result.testType || "timed") === "timed" ? String(result.configuredDurationSeconds || 60) : "all",
      targetWordCount: String(result.testType || "timed") === "words" ? String(result.targetWordCount || 25) : "all",
      mode: String(result.mode || "standard"),
      category: String(result.category || "common"),
      difficulty: String(result.difficulty || "mixed")
    }
    var rows = Progress.filterHistory(dataStore.history, language, "all", filters)
    return Progress.comparisonContext(rows, language, "all", filters)
  }

  function showHistoricalResult(result, comparison) {
    currentResult = result
    resultComparison = comparison && comparison.label ? comparison : comparisonForResult(result)
    progressComparison = resultComparison
    activeOptions = {
      language: result.language || "en",
      testType: result.testType || "timed",
      durationSeconds: String(result.testType || "timed") === "timed" ? Number(result.configuredDurationSeconds || 60) : 0,
      targetWordCount: String(result.testType || "timed") === "words" ? Number(result.targetWordCount || 25) : 0,
      category: result.category || "common",
      difficulty: result.difficulty || "mixed",
      mode: result.mode || "standard",
      adaptiveTargets: result.adaptiveTargets || [],
      adaptiveBigrams: result.adaptiveBigrams || [],
      adaptiveWords: result.adaptiveWords || [],
      adaptiveHesitationCharacters: result.adaptiveHesitationCharacters || [],
      recentPassageIds: AdaptivePractice.recentPassageIds(dataStore.history, result.language || "en", 3)
    }
    currentView = "results"
  }

  DataStore { id: dataStore }
  PassageLibrary {
    id: passageLibrary
    pluginDir: root.pluginDir
    customEnglishText: dataStore.customEnglishText
    customPersianText: dataStore.customPersianText
  }

  Component {
    id: setupComponent
    SetupView {
      store: dataStore
      library: passageLibrary
      fontFamily: root.contentFontFamily
      onStartRequested: function(options) { root.startTest(options) }
      onNavigateRequested: function(view) { root.currentView = view }
    }
  }

  Component {
    id: testComponent
    TestView {
      store: dataStore
      library: passageLibrary
      fontFamily: root.contentFontFamily
      confirmationKeyHandler: function(event) { return root.handleConfirmationKey(event) }
      onCompleted: function(result) { root.finishTest(result) }
      onCancelRequested: root.requestDismiss()
      onRestartRequested: root.requestRestart()
    }
  }

  Component {
    id: resultsComponent
    ResultsView {
      result: root.currentResult
      comparisonContext: root.resultComparison
      store: dataStore
      fontFamily: root.contentFontFamily
      onRetryRequested: root.retrySamePassage()
      onNewPassageRequested: root.newPassageSameSettings()
      onNewTestRequested: root.currentView = "setup"
      onHistoryRequested: root.currentView = "history"
      onProgressRequested: root.currentView = "progress"
      onPracticeRequested: root.startAdaptive(root.currentResult ? root.currentResult.language : "en",
        Math.min(180, root.currentResult ? Number(root.currentResult.configuredDurationSeconds || 60) : 60),
        root.currentResult ? root.currentResult.testType : "timed",
        root.currentResult ? root.currentResult.targetWordCount : 0)
    }
  }

  Component {
    id: progressComponent
    ProgressView {
      store: dataStore
      fontFamily: root.contentFontFamily
      initialComparison: root.progressComparison
      onBackRequested: root.currentView = "setup"
      onHistoryRequested: root.currentView = "history"
      onComparisonUpdated: function(comparison) { root.progressComparison = comparison }
      onResultRequested: function(result, comparison) { root.showHistoricalResult(result, comparison) }
    }
  }

  Component {
    id: historyComponent
    HistoryView {
      store: dataStore
      fontFamily: root.contentFontFamily
      onBackRequested: root.currentView = "setup"
      onProgressRequested: root.currentView = "progress"
      onResultRequested: function(result) { root.showHistoricalResult(result) }
    }
  }

  Component {
    id: settingsComponent
    SettingsView {
      store: dataStore
      fontFamily: root.contentFontFamily
      onBackRequested: root.currentView = "setup"
    }
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    exclusionMode: ExclusionMode.Ignore
    WlrLayershell.namespace: "leomoon-studios-typing-test"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: root.opened ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None

    Rectangle {
      anchors.fill: parent
      color: Color.menu.scrim

      MouseArea {
        anchors.fill: parent
        onClicked: root.requestDismiss()
      }
    }

    BorderSurface {
      id: card
      width: Math.min(Style.space(960), Math.max(Style.space(320), panel.width - Style.space(80)))
      height: Math.min(Style.space(640), Math.max(Style.space(420), panel.height - Style.space(80)))
      anchors.centerIn: parent
      color: Color.menu.background
      borderSpec: Border.surfaceSpec("menu", "border", Color.menu.border, Math.max(1, Style.normalBorderWidth))
      radius: Style.cornerRadius
      padding: Style.spacing.panelPadding

      MouseArea { anchors.fill: parent; onClicked: {} }

      ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.bottomMargin: card.contentBottomInset
        anchors.leftMargin: card.contentLeftInset
        spacing: Style.spacing.md

        RowLayout {
          Layout.fillWidth: true
          visible: root.currentView !== "test"
          Text {
            text: "OMARCHY TYPING TEST"
            color: Color.muted
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 1.5
            Layout.fillWidth: true
          }
          PanelActionButton { iconText: "×"; tooltipText: "Close"; fontFamily: root.contentFontFamily; focusable: true; onClicked: root.requestDismiss() }
        }

        RowLayout {
          Layout.fillWidth: true
          visible: root.currentView !== "test" && dataStore.lastError !== ""
          spacing: Style.spacing.sm

          Text {
            text: dataStore.lastError
            color: Color.urgent
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
          }

          PanelActionButton {
            iconText: "×"
            tooltipText: "Dismiss warning"
            fontFamily: root.contentFontFamily
            focusable: true
            onClicked: dataStore.clearError()
          }
        }

        Loader {
          id: viewLoader
          Layout.fillWidth: true
          Layout.fillHeight: true
          sourceComponent: root.currentView === "test" ? testComponent
            : root.currentView === "results" ? resultsComponent
            : root.currentView === "progress" ? progressComponent
            : root.currentView === "history" ? historyComponent
            : root.currentView === "settings" ? settingsComponent
            : setupComponent
          onLoaded: {
            if (root.currentView === "test" && item) item.start(root.activeOptions)
          }
        }
      }

      KeyboardConfirmDialog {
        id: confirmDialog
        fontFamily: root.contentFontFamily
        anchors.fill: parent
        restoreFocusItem: viewLoader.item
        onCanceled: { opened = false; root.confirmationAction = "" }
        onConfirmed: root.confirmAction()
      }
    }

    Item {
      anchors.fill: parent
      focus: root.opened
      Keys.priority: Keys.AfterItem
      Keys.onEscapePressed: root.requestDismiss()
    }
  }
}
