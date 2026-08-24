import QtQuick
import Quickshell
import Quickshell.Io
import "js/Persistence.js" as Persistence

QtObject {
  id: root

  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string configHome: Quickshell.env("XDG_CONFIG_HOME") || (home + "/.config")
  readonly property string dataHome: Quickshell.env("XDG_DATA_HOME") || (home + "/.local/share")
  readonly property string configDir: configHome + "/leomoon-studios.typing-test"
  readonly property string dataDir: dataHome + "/leomoon-studios.typing-test"
  readonly property string customDir: dataDir + "/custom-texts"

  property bool ready: false
  property var settings: defaultSettings()
  property var history: []
  property var historyRejectedLines: []
  property int settingsRevision: 0
  property int historyRevision: 0
  property string customEnglishText: ""
  property string customPersianText: ""
  property string lastError: ""
  property bool settingsWritable: true
  property bool historyWritable: true
  property bool customEnglishWritable: true
  property bool customPersianWritable: true

  property string importLanguage: "en"
  property string importCollection: "Imported"
  property string importPath: ""
  property string pendingPickerOutput: ""
  property bool pickerExited: false

  signal importFinished(int count, string collection)
  signal importFailed(string message)

  function reportError(message) {
    var text = String(message || "Storage operation failed.")
    lastError = text
    console.warn("Typing Test: " + text)
  }

  function clearError() { lastError = "" }

  function fileError(label, error) {
    return label + " (" + FileViewError.toString(error) + ")."
  }

  function defaultSettings() {
    return {
      schemaVersion: 2,
      defaultLanguage: "en",
      defaultDurationSeconds: 60,
      defaultCategory: "common",
      defaultDifficulty: "mixed",
      showLiveWpm: true,
      showLiveAccuracy: true,
      persianNormalization: "forgiving",
      digitNormalization: "exact",
      zwnjCountsAsError: true,
      includeCorrectedErrorsInDifficulty: true,
      adaptiveHistoryWindow: 10,
      progressRange: "30-tests",
      coachingEnabled: true
    }
  }

  function mergeDefaults(value) {
    return Persistence.sanitizeSettings(value, defaultSettings()).value
  }

  function loadSettings(raw) {
    var source = String(raw || "")
    var parsed = Persistence.parseSettings(source, defaultSettings())
    settings = parsed.value
    settingsWritable = true
    if (parsed.issues.length > 0) {
      if (source.trim()) settingsRecoveryFile.setText(source)
      reportError(parsed.invalidJson
        ? "Settings were invalid; defaults were loaded and the original file was preserved as settings-recovery.json."
        : "Some settings were invalid and were safely reset. The original file was preserved as settings-recovery.json.")
    }
    settingsRevision++
  }

  function loadHistory(raw) {
    var source = String(raw || "")
    var parsed = Persistence.parseHistory(source)
    history = parsed.rows
    historyRejectedLines = parsed.rejectedLines
    historyWritable = true
    if (parsed.rejectedLines.length > 0 || parsed.repairedCount > 0) {
      if (source.trim()) historyRecoveryFile.setText(source)
      var details = []
      if (parsed.rejectedLines.length > 0) details.push(parsed.rejectedLines.length + " unreadable record" + (parsed.rejectedLines.length === 1 ? "" : "s"))
      if (parsed.repairedCount > 0) details.push(parsed.repairedCount + " repaired record" + (parsed.repairedCount === 1 ? "" : "s"))
      reportError("History contained " + details.join(" and ") + ". Original data was preserved and safe records were loaded.")
    }
    historyRevision++
  }

  function historyText(rows, rejectedLines) {
    return Persistence.serializeHistory(rows, rejectedLines === undefined ? historyRejectedLines : rejectedLines)
  }

  function backupHistory() {
    var text = historyText(history, historyRejectedLines)
    if (text) historyBackupFile.setText(text)
  }

  function saveSettings(changes) {
    if (!settingsWritable) {
      reportError("Settings were not saved because the existing settings file could not be read safely.")
      return
    }
    var incoming = {}
    for (var existingKey in settings) incoming[existingKey] = settings[existingKey]
    for (var key in (changes || {})) incoming[key] = changes[key]
    var sanitized = Persistence.sanitizeSettings(incoming, defaultSettings())
    var next = sanitized.value
    settings = next
    settingsRevision++
    settingsFile.setText(JSON.stringify(next, null, 2) + "\n")
  }

  function appendResult(result) {
    if (!historyWritable) {
      reportError("This result was not saved because the existing history file could not be read safely.")
      return
    }
    var sanitized = Persistence.sanitizeResult(result)
    if (!sanitized.value) {
      reportError("This result was not saved because it was incomplete or invalid.")
      return
    }
    var rows = history.slice()
    rows.unshift(sanitized.value)
    history = rows
    historyRevision++
    historyFile.setText(historyText(rows, historyRejectedLines))
  }

  function deleteResult(id) {
    if (!historyWritable) {
      reportError("History could not be changed because the existing file could not be read safely.")
      return
    }
    backupHistory()
    var rows = []
    for (var i = 0; i < history.length; i++) if (history[i].id !== id) rows.push(history[i])
    history = rows
    historyRevision++
    historyFile.setText(historyText(rows, historyRejectedLines))
  }

  function clearHistory() {
    if (!historyWritable) {
      reportError("History could not be cleared because the existing file could not be read safely.")
      return
    }
    backupHistory()
    history = []
    historyRejectedLines = []
    historyRevision++
    historyFile.setText("")
  }

  function latest() { return history.length > 0 ? history[0] : null }

  function best(language) {
    var value = null
    for (var i = 0; i < history.length; i++) {
      var row = history[i]
      if (language && row.language !== language) continue
      var wpm = Number(row.netWpm) || 0
      if (value === null || wpm > value) value = wpm
    }
    return value
  }

  function averageAccuracy(language) {
    var total = 0
    var count = 0
    for (var i = 0; i < history.length; i++) {
      if (language && history[i].language !== language) continue
      total += Number(history[i].accuracy) || 0
      count++
    }
    return count > 0 ? total / count : null
  }

  function refresh() {
    settingsFile.reload()
    historyFile.reload()
    customEnFile.reload()
    customFaFile.reload()
  }

  function chooseImport(language, collection) {
    if (picker.running) return
    importLanguage = language === "fa" ? "fa" : "en"
    importCollection = String(collection || "Imported").trim() || "Imported"
    pendingPickerOutput = ""
    pickerExited = false
    picker.running = true
  }

  function maybeVerifyImport() {
    if (!pickerExited || !pendingPickerOutput) return
    importPath = pendingPickerOutput
    Qt.callLater(function() { importFile.reload() })
  }

  function finishImport(raw) {
    if ((importLanguage === "fa" && !customPersianWritable) || (importLanguage !== "fa" && !customEnglishWritable)) {
      importFailed("Imported passages were not changed because the existing custom-text file could not be read safely.")
      return
    }
    var paragraphs = String(raw || "").replace(/\r/g, "").split(/\n\s*\n+/)
    var records = []
    var stamp = Date.now()
    for (var i = 0; i < paragraphs.length; i++) {
      var text = paragraphs[i].replace(/\s+/g, " ").trim()
      if (!text) continue
      records.push({
        id: "custom-" + importLanguage + "-" + stamp + "-" + (i + 1),
        language: importLanguage,
        category: "custom",
        difficulty: 2,
        source: importCollection,
        license: "user-provided",
        collection: importCollection,
        text: text
      })
    }
    if (records.length === 0) {
      importFailed("The selected file did not contain any non-empty paragraphs.")
      return
    }
    var previous = importLanguage === "fa" ? customPersianText : customEnglishText
    var addition = ""
    for (var j = 0; j < records.length; j++) addition += JSON.stringify(records[j]) + "\n"
    if (importLanguage === "fa") customFaFile.setText(previous + addition)
    else customEnFile.setText(previous + addition)
    importFinished(records.length, importCollection)
  }

  function clearCustom(language) {
    if (language === "fa") {
      if (!customPersianWritable) { reportError("Parsi imports could not be removed because their file could not be read safely."); return }
      customPersianText = ""
      customFaFile.setText("")
    } else {
      if (!customEnglishWritable) { reportError("English imports could not be removed because their file could not be read safely."); return }
      customEnglishText = ""
      customEnFile.setText("")
    }
  }

  property Process ensureDirsProcess: Process {
    id: ensureDirs
    command: ["mkdir", "-p", root.configDir, root.dataDir, root.customDir]
    running: true
    onExited: function(exitCode) {
      root.ready = exitCode === 0
      if (exitCode !== 0) root.reportError("Could not create the typing-test data directories.")
      settingsFile.reload()
      historyFile.reload()
      customEnFile.reload()
      customFaFile.reload()
    }
  }

  property SafeFile settingsFileView: SafeFile {
    id: settingsFile
    path: root.configDir + "/settings.json"
    onLoaded: function(value) { root.loadSettings(value) }
    onLoadFailed: function(error) {
      if (error === "File not found") {
        root.settingsWritable = true
        root.loadSettings("{}")
      } else {
        root.settingsWritable = false
        root.reportError("The settings file could not be read safely.")
      }
    }
    onSaveFailed: root.reportError("Settings could not be saved safely.")
  }

  property SafeFile historyFileView: SafeFile {
    id: historyFile
    path: root.dataDir + "/history.jsonl"
    onLoaded: function(value) { root.loadHistory(value) }
    onLoadFailed: function(error) {
      if (error === "File not found") {
        root.historyWritable = true
        root.loadHistory("")
      } else {
        root.historyWritable = false
        root.reportError("The history file could not be read safely.")
      }
    }
    onSaveFailed: root.reportError("History could not be saved safely.")
  }

  property SafeFile customEnFileView: SafeFile {
    id: customEnFile
    path: root.customDir + "/custom-en.jsonl"
    onLoaded: function(value) { root.customEnglishWritable = true; root.customEnglishText = value }
    onLoadFailed: function(error) {
      if (error === "File not found") {
        root.customEnglishWritable = true
        root.customEnglishText = ""
      } else {
        root.customEnglishWritable = false
        root.reportError("English imported passages could not be read safely.")
      }
    }
    onSaveFailed: root.reportError("English imported passages could not be saved safely.")
  }

  property SafeFile customFaFileView: SafeFile {
    id: customFaFile
    path: root.customDir + "/custom-fa.jsonl"
    onLoaded: function(value) { root.customPersianWritable = true; root.customPersianText = value }
    onLoadFailed: function(error) {
      if (error === "File not found") {
        root.customPersianWritable = true
        root.customPersianText = ""
      } else {
        root.customPersianWritable = false
        root.reportError("Parsi imported passages could not be read safely.")
      }
    }
    onSaveFailed: root.reportError("Parsi imported passages could not be saved safely.")
  }

  property SafeFile historyBackupFileView: SafeFile {
    id: historyBackupFile
    path: root.dataDir + "/history-backup.jsonl"
    onSaveFailed: root.reportError("The history backup could not be saved safely.")
  }

  property SafeFile historyRecoveryFileView: SafeFile {
    id: historyRecoveryFile
    path: root.dataDir + "/history-recovery.jsonl"
    onSaveFailed: root.reportError("The history recovery snapshot could not be saved safely.")
  }

  property SafeFile settingsRecoveryFileView: SafeFile {
    id: settingsRecoveryFile
    path: root.configDir + "/settings-recovery.json"
    onSaveFailed: root.reportError("The settings recovery snapshot could not be saved safely.")
  }

  property Process pickerProcess: Process {
    id: picker
    command: ["omarchy", "file", "select", "--title", "Import typing text", "--extensions", "txt"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.pendingPickerOutput = String(text || "").trim()
        root.maybeVerifyImport()
      }
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) return
      root.pickerExited = true
      root.maybeVerifyImport()
    }
  }

  property SafeFile importFileView: SafeFile {
    id: importFile
    path: root.importPath
    onLoaded: function(value) { root.finishImport(value) }
    onLoadFailed: function(error) { root.importFailed("The selected file could not be read safely as UTF-8 text.") }
  }
}
