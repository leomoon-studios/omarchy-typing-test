import Quickshell
import QtQuick
import "components"

ShellRoot {
  id: suite

  property var completedResult: null
  property int passedChecks: 0

  QtObject {
    id: fakeStore
    property var history: []
    property var settings: ({
      showLiveWpm: true,
      showLiveAccuracy: true,
      persianNormalization: "forgiving",
      digitNormalization: "exact",
      zwnjCountsAsError: true,
      includeCorrectedErrorsInDifficulty: true,
      adaptiveHistoryWindow: 10
    })
  }

  QtObject {
    id: fakeLibrary
    property var passages: [
      { id: "session-en-common", language: "en", category: "common", difficulty: 1,
        text: "one two three four five six seven eight nine ten" },
      { id: "session-en-literature", language: "en", category: "literature", difficulty: 2,
        text: "The quiet queen quickly questioned the patient crowd." },
      { id: "session-fa-common", language: "fa", category: "common", difficulty: 1,
        text: "یک دو سه چهار پنج شش هفت هشت نه ده" },
      { id: "session-fa-literature", language: "fa", category: "literature", difficulty: 2,
        text: "باران آرام بر کوچه‌های روشن شهر می‌بارید." }
    ]
  }

  TestView {
    id: testView
    width: 960
    height: 640
    store: fakeStore
    library: fakeLibrary
    fontFamily: "sans-serif"
    onCompleted: function(result) { suite.completedResult = result }
  }

  function check(condition, message) {
    if (!condition) throw new Error(message)
    passedChecks++
  }

  function options(language, testType) {
    return {
      language: language,
      testType: testType,
      durationSeconds: testType === "timed" ? 60 : 0,
      targetWordCount: testType === "words" ? 10 : 0,
      category: "common",
      difficulty: "1",
      mode: "standard",
      adaptiveTargets: [], adaptiveBigrams: [], adaptiveWords: [],
      adaptiveHesitationCharacters: [], recentPassageIds: [],
      retryRequested: false, retryPassageIds: []
    }
  }

  function completeCurrent() {
    completedResult = null
    testView.syncText(testView.expectedText)
    check(completedResult !== null, "completion signal was not emitted")
    return completedResult
  }

  function runEnglishWordSession() {
    testView.start(options("en", "words"))
    check(testView.expectedText.split(/\s+/).length === 10, "English word session did not build 10 words")
    check(testView.remainingSeconds === 0, "word session must not use a countdown")
    var result = completeCurrent()
    check(result.schemaVersion === 5 && result.language === "en", "English result identity is incorrect")
    check(result.testType === "words" && result.targetWordCount === 10, "English word format metadata is incorrect")
    check(result.configuredDurationSeconds === 0 && result.accuracy === 100, "English completion metrics are incorrect")
  }

  function runParsiPassageSession() {
    var sessionOptions = options("fa", "passage")
    sessionOptions.mode = "adaptive"
    testView.start(sessionOptions)
    check(testView.expectedText === "یک دو سه چهار پنج شش هفت هشت نه ده", "Parsi passage text is incorrect")
    check(testView.options.mode === "standard", "passage mode must reject adaptive mode")
    check(testView.remainingSeconds === 0, "passage session must not use a countdown")
    var result = completeCurrent()
    check(result.language === "fa" && result.testType === "passage", "Parsi result identity is incorrect")
    check(result.targetWordCount === 0 && result.configuredDurationSeconds === 0, "Parsi passage metadata is incorrect")
    check(result.accuracy === 100, "Parsi completion accuracy is incorrect")
  }

  function runEnglishExactRetrySession() {
    var sessionOptions = options("en", "passage")
    sessionOptions.category = "literature"
    sessionOptions.difficulty = "2"
    sessionOptions.retryRequested = true
    sessionOptions.retryPassageIds = ["session-en-literature"]
    testView.start(sessionOptions)
    check(testView.expectedText === "The quiet queen quickly questioned the patient crowd.", "English exact retry changed text")
    check(testView.passageIds[0] === "session-en-literature", "English exact retry changed passage ID")
    check(testView.sourceNotice === "", "successful exact retry displayed a fallback notice")
  }

  function runParsiFallbackSession() {
    var sessionOptions = options("fa", "passage")
    sessionOptions.category = "custom"
    sessionOptions.retryRequested = true
    sessionOptions.retryPassageIds = ["removed-fa-import"]
    testView.start(sessionOptions)
    check(testView.sourceNotice.indexOf("no longer available") >= 0, "missing Parsi retry did not explain fallback")
    check(testView.options.category === "common", "missing Parsi retry did not use safe fallback settings")
    check(testView.expectedText === "یک دو سه چهار پنج شش هفت هشت نه ده", "missing Parsi retry did not select fallback text")
    check(testView.passageIds[0] === "session-fa-common", "missing Parsi retry kept a removed passage ID")
  }

  Component.onCompleted: Qt.callLater(function() {
    try {
      runEnglishWordSession()
      runParsiPassageSession()
      runEnglishExactRetrySession()
      runParsiFallbackSession()
      console.log("HIGH_PRIORITY_SESSIONS_PASS checks=" + passedChecks)
      Qt.quit()
    } catch (error) {
      console.error("HIGH_PRIORITY_SESSIONS_FAIL " + error)
      Qt.quit()
    }
  })
}
