.pragma library

var MAX_SOURCE_BYTES = 10 * 1024 * 1024
var MAX_SERIALIZED_BYTES = 10 * 1024 * 1024
var MAX_PASSAGES = 1000
var MAX_PASSAGE_CHARACTERS = 10000
var MAX_COLLECTION_CHARACTERS = 80

function utf8ByteLength(value) {
  var text = String(value === undefined || value === null ? "" : value)
  var bytes = 0
  for (var index = 0; index < text.length; index++) {
    var code = text.charCodeAt(index)
    if (code <= 0x7f) bytes += 1
    else if (code <= 0x7ff) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length
        && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4
      index++
    } else bytes += 3
  }
  return bytes
}

function validateCollection(value) {
  var source = String(value === undefined || value === null ? "" : value)
  if (source.length > MAX_COLLECTION_CHARACTERS) {
    return {
      ok: false,
      error: "Collection names must be " + MAX_COLLECTION_CHARACTERS + " characters or fewer."
    }
  }
  var collection = source.trim() || "Imported"
  return { ok: true, value: collection }
}

function prepare(raw, language, collectionValue, previousValue, stampValue) {
  var collectionResult = validateCollection(collectionValue)
  if (!collectionResult.ok) return collectionResult

  var source = String(raw === undefined || raw === null ? "" : raw)
  if (utf8ByteLength(source) > MAX_SOURCE_BYTES) {
    return { ok: false, error: "The selected text file exceeds the 10 MiB import limit." }
  }
  source = source.replace(/\r\n?/g, "\n")

  var previous = String(previousValue === undefined || previousValue === null ? "" : previousValue)
  var serializedBytes = utf8ByteLength(previous)
  if (serializedBytes > MAX_SERIALIZED_BYTES) {
    return { ok: false, error: "The existing imported-passage file already exceeds the safe storage limit." }
  }

  var language = language === "fa" ? "fa" : "en"
  var collection = collectionResult.value
  var stamp = Math.max(0, Math.round(Number(stampValue) || 0))
  // Walk separators incrementally. Splitting the entire source would allocate
  // an attacker-controlled array before the passage-count limit can run.
  var separator = /\n[ \t]*\n(?:[ \t]*\n)*/g
  var cursor = 0
  var passageNumber = 0
  var chunks = []
  var failure = null

  function addParagraph(end) {
    var length = end - cursor
    if (length > MAX_PASSAGE_CHARACTERS) {
      failure = "Each imported passage must be " + MAX_PASSAGE_CHARACTERS + " characters or fewer."
      return
    }

    var text = source.slice(cursor, end).replace(/\s+/g, " ").trim()
    if (!text) return
    passageNumber++
    if (passageNumber > MAX_PASSAGES) {
      failure = "A text file can contain at most " + MAX_PASSAGES + " passages."
      return
    }

    var line = JSON.stringify({
      id: "custom-" + language + "-" + stamp + "-" + passageNumber,
      language: language,
      category: "custom",
      difficulty: 2,
      source: collection,
      license: "user-provided",
      collection: collection,
      text: text
    }) + "\n"
    var lineBytes = utf8ByteLength(line)
    if (serializedBytes + lineBytes > MAX_SERIALIZED_BYTES) {
      failure = "Imported passages would exceed the 10 MiB safe storage limit. Remove existing imports or choose a smaller file."
      return
    }
    serializedBytes += lineBytes
    chunks.push(line)
  }

  var match
  while (!failure && (match = separator.exec(source)) !== null) {
    addParagraph(match.index)
    cursor = separator.lastIndex
  }
  if (!failure) addParagraph(source.length)
  if (failure) return { ok: false, error: failure }
  if (passageNumber === 0) return { ok: false, error: "The selected file did not contain any non-empty paragraphs." }

  return {
    ok: true,
    collection: collection,
    count: passageNumber,
    addition: chunks.join(""),
    serializedBytes: serializedBytes
  }
}
