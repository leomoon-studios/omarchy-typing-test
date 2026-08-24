.pragma library

function wordBoundaryEnd(characters, start, fittingEnd) {
  var values = characters || []
  var begin = Math.max(0, Math.min(Number(start || 0), values.length))
  var end = Math.max(begin + 1, Math.min(Number(fittingEnd || 0), values.length))
  if (end >= values.length) return values.length

  for (var index = end - 1; index >= begin; index--) {
    if (/\s/.test(values[index])) return Math.max(begin + 1, index + 1)
  }
  return end
}
