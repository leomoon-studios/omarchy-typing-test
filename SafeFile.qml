import QtQuick
import Quickshell.Io

QtObject {
  id: root

  property string path: ""
  property string helperPath: Qt.resolvedUrl("scripts/safe-file.py").toString().replace(/^file:\/\//, "")
  property string pendingText: ""
  property string queuedText: ""
  property bool hasQueuedWrite: false
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

  function beginWrite(value) {
    pendingText = String(value || "")
    writer.command = ["python3", helperPath, "write", path]
    writer.stdinEnabled = true
    writer.running = true
  }

  function setText(value) {
    var nextText = String(value || "")
    if (writer.running) {
      queuedText = nextText
      hasQueuedWrite = true
      return
    }
    beginWrite(nextText)
  }

  function continueQueuedWrite() {
    if (!hasQueuedWrite) return
    var nextText = queuedText
    queuedText = ""
    hasQueuedWrite = false
    beginWrite(nextText)
  }

  property Process readerProc: Process {
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

  property Process writerProc: Process {
    id: writer
    stdinEnabled: true
    onStarted: {
      write(root.pendingText)
      // safe-file.py reads until EOF, so close the write channel after the
      // complete payload has been queued.
      stdinEnabled = false
    }
    onExited: function(exitCode) {
      if (exitCode === 0) root.saved()
      else root.saveFailed("The file could not be saved")
      root.continueQueuedWrite()
    }
  }
}
