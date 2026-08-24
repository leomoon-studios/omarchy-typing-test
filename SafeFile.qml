import QtQuick
import Quickshell.Io

QtObject {
  id: root

  property string path: ""
  property string helperPath: Qt.resolvedUrl("scripts/safe-file.py").toString().replace(/^file:\/\//, "")
  property string pendingText: ""
  property string collectedText: ""

  signal loaded(string value)
  signal loadFailed(string reason)
  signal saveFailed(string reason)
  signal saved()

  function reload() {
    if (reader.running || !path) return
    collectedText = ""
    reader.command = ["python3", helperPath, "read", path]
    reader.running = true
  }

  function setText(value) {
    if (writer.running) {
      saveFailed("A previous write is still in progress")
      return
    }
    pendingText = String(value || "")
    writer.command = ["python3", helperPath, "write", path]
    writer.running = true
  }

  Process {
    id: reader
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.collectedText = String(text || "")
    }
    onExited: function(exitCode) {
      if (exitCode === 0) root.loaded(root.collectedText)
      else root.loadFailed(exitCode === 2 ? "File not found" : "File is not a regular file or exceeds the size limit")
    }
  }

  Process {
    id: writer
    stdinEnabled: true
    onStarted: write(root.pendingText)
    onExited: function(exitCode) {
      if (exitCode === 0) root.saved()
      else root.saveFailed("The file could not be saved")
    }
  }
}
