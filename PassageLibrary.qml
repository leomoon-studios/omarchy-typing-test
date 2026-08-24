import QtQuick
import Quickshell.Io
import "js/PassageLoader.js" as PassageLoader

QtObject {
  id: root

  property string pluginDir: ""
  property string customEnglishText: ""
  property string customPersianText: ""
  property var passages: []
  property int revision: 0
  property int settledCount: 0
  property int failedCount: 0
  property string lastError: ""
  readonly property bool settled: settledCount >= 8
  readonly property bool ready: settled && failedCount === 0

  property var raw: ({
    enCommon: "", enLiterature: "", enProgramming: "", enPunctuation: "",
    faCommon: "", faFormal: "", faLiterature: "", faPunctuation: ""
  })
  property var states: ({
    enCommon: "pending", enLiterature: "pending", enProgramming: "pending", enPunctuation: "pending",
    faCommon: "pending", faFormal: "pending", faLiterature: "pending", faPunctuation: "pending"
  })

  function labelFor(key) {
    var labels = {
      enCommon: "English common", enLiterature: "English literature", enProgramming: "English programming", enPunctuation: "English punctuation",
      faCommon: "Parsi common", faFormal: "Parsi formal", faLiterature: "Parsi literature", faPunctuation: "Parsi punctuation"
    }
    return labels[key] || key
  }

  function updateStatus() {
    var settledTotal = 0
    var failures = []
    for (var key in states) {
      if (states[key] !== "pending") settledTotal++
      if (states[key] === "failed") failures.push(labelFor(key))
    }
    settledCount = settledTotal
    failedCount = failures.length
    lastError = failures.length > 0
      ? "Could not load bundled passage collections: " + failures.join(", ") + "."
      : ""
  }

  function setRaw(key, value, loadSucceeded) {
    var source = String(value || "")
    var records = loadSucceeded ? PassageLoader.parseJsonLines(source) : []
    var valid = loadSucceeded && records.length > 0
    var nextRaw = {}
    var nextStates = {}
    for (var name in raw) nextRaw[name] = raw[name]
    for (var stateName in states) nextStates[stateName] = states[stateName]
    nextRaw[key] = valid ? source : ""
    nextStates[key] = valid ? "loaded" : "failed"
    raw = nextRaw
    states = nextStates
    updateStatus()
    rebuild()
  }

  function rebuild() {
    var result = []
    for (var key in raw) result = result.concat(PassageLoader.parseJsonLines(raw[key]))
    result = result.concat(PassageLoader.parseJsonLines(customEnglishText))
    result = result.concat(PassageLoader.parseJsonLines(customPersianText))
    passages = result
    revision++
  }

  onCustomEnglishTextChanged: rebuild()
  onCustomPersianTextChanged: rebuild()

  function filePath(relative) { return pluginDir ? pluginDir + "/" + relative : "" }

  property FileView enCommonFile: FileView { path: root.filePath("texts/en/common.jsonl"); printErrors: false; onLoaded: root.setRaw("enCommon", text(), true); onLoadFailed: function(error) { root.setRaw("enCommon", "", false) } }
  property FileView enLiteratureFile: FileView { path: root.filePath("texts/en/literature.jsonl"); printErrors: false; onLoaded: root.setRaw("enLiterature", text(), true); onLoadFailed: function(error) { root.setRaw("enLiterature", "", false) } }
  property FileView enProgrammingFile: FileView { path: root.filePath("texts/en/programming.jsonl"); printErrors: false; onLoaded: root.setRaw("enProgramming", text(), true); onLoadFailed: function(error) { root.setRaw("enProgramming", "", false) } }
  property FileView enPunctuationFile: FileView { path: root.filePath("texts/en/punctuation.jsonl"); printErrors: false; onLoaded: root.setRaw("enPunctuation", text(), true); onLoadFailed: function(error) { root.setRaw("enPunctuation", "", false) } }
  property FileView faCommonFile: FileView { path: root.filePath("texts/fa/common.jsonl"); printErrors: false; onLoaded: root.setRaw("faCommon", text(), true); onLoadFailed: function(error) { root.setRaw("faCommon", "", false) } }
  property FileView faFormalFile: FileView { path: root.filePath("texts/fa/formal.jsonl"); printErrors: false; onLoaded: root.setRaw("faFormal", text(), true); onLoadFailed: function(error) { root.setRaw("faFormal", "", false) } }
  property FileView faLiteratureFile: FileView { path: root.filePath("texts/fa/literature.jsonl"); printErrors: false; onLoaded: root.setRaw("faLiterature", text(), true); onLoadFailed: function(error) { root.setRaw("faLiterature", "", false) } }
  property FileView faPunctuationFile: FileView { path: root.filePath("texts/fa/punctuation.jsonl"); printErrors: false; onLoaded: root.setRaw("faPunctuation", text(), true); onLoadFailed: function(error) { root.setRaw("faPunctuation", "", false) } }
}
