import QtQuick
import Quickshell.Io

QtObject {
  id: root

  property string path: ""
  property string helperPath: Qt.resolvedUrl("scripts/safe-file.py").toString().replace(/^file:\/\//, "")
  property string pendingText: ""
  property int activeOperationId: 0
  property string queuedText: ""
  property int queuedOperationId: 0
  property bool hasQueuedWrite: false
  property int nextOperationId: 0
  property string collectedText: ""

  signal loaded(string value)
  signal loadFailed(string reason)
  signal saveFailed(string reason, int operationId)
  signal saveSuperseded(int operationId)
  signal saved(int operationId)

  function reload() {
    if (reader.running || !path) return
    collectedText = ""
    reader.command = ["python3", helperPath, "read", path]
    reader.running = true
  }

  function allocateOperationId() {
    nextOperationId++
    if (nextOperationId <= 0) nextOperationId = 1
    return nextOperationId
  }

  function beginWrite(value, operationId) {
    pendingText = String(value || "")
    activeOperationId = operationId
    writer.command = ["python3", helperPath, "write", path]
    writer.stdinEnabled = true
    writer.running = true
  }

  function setText(value) {
    var nextText = String(value || "")
    var operationId = allocateOperationId()
    if (writer.running) {
      if (hasQueuedWrite) root.saveSuperseded(queuedOperationId)
      queuedText = nextText
      queuedOperationId = operationId
      hasQueuedWrite = true
      return operationId
    }
    beginWrite(nextText, operationId)
    return operationId
  }

  function continueQueuedWrite() {
    if (!hasQueuedWrite) return
    var nextText = queuedText
    var operationId = queuedOperationId
    queuedText = ""
    queuedOperationId = 0
    hasQueuedWrite = false
    beginWrite(nextText, operationId)
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
      var operationId = root.activeOperationId
      if (exitCode === 0) root.saved(operationId)
      else root.saveFailed("The file could not be saved", operationId)
      root.continueQueuedWrite()
    }
  }
}
