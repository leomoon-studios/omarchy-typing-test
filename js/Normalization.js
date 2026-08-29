.pragma library

function characters(text) {
  return Array.from(String(text || ""))
}

function normalizeCharacter(character, options) {
  var value = String(character || "")
  var opts = options || {}

  if (opts.persianNormalization !== "strict") {
    if (value === "ي") value = "ی"
    else if (value === "ك") value = "ک"
  }

  if (opts.digitNormalization === "persian-arabic" || opts.digitNormalization === "all") {
    var arabicIndic = "٠١٢٣٤٥٦٧٨٩"
    var persian = "۰۱۲۳۴۵۶۷۸۹"
    var arabicIndex = arabicIndic.indexOf(value)
    if (arabicIndex >= 0) value = persian.charAt(arabicIndex)
  }

  if (opts.digitNormalization === "all") {
    var localized = "۰۱۲۳۴۵۶۷۸۹"
    var localizedIndex = localized.indexOf(value)
    if (localizedIndex >= 0) value = String(localizedIndex)
  }

  if (opts.zwnjCountsAsError === false && value === "\u200c") return ""
  return value
}

function equivalent(expected, actual, options) {
  return normalizeCharacter(expected, options) === normalizeCharacter(actual, options)
}

function normalizeText(text, options) {
  var chars = characters(text)
  var result = ""
  for (var i = 0; i < chars.length; i++) result += normalizeCharacter(chars[i], options)
  return result
}

function normalizedCharacters(text, options) {
  return characters(normalizeText(text, options))
}
