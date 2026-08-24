.pragma library

function contains(root, item) {
  var current = item
  while (current) {
    if (current === root) return true
    current = current.parent
  }
  return false
}

function focusNext(root, current, forward) {
  var source = contains(root, current) ? current : root
  var candidate = source.nextItemInFocusChain(forward)
  var attempts = 0

  while (candidate && attempts < 128) {
    if (candidate !== root && contains(root, candidate)) {
      candidate.forceActiveFocus()
      return candidate
    }
    candidate = candidate.nextItemInFocusChain(forward)
    attempts++
    if (candidate === source) break
  }

  return null
}
