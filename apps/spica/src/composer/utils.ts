/**
 * Iterates through the previous or next siblings of a node and performs the test on each element
 * and returns the elements that passed the tests.
 */
export function findSiblings<T extends HTMLElement>(
  sourceElem: T,
  test: (e: T) => boolean,
  direction: number
): T[] {
  const matchedElems = [];
  let elem: T =
    direction == -1
      ? (sourceElem.previousElementSibling as T)
      : (sourceElem.nextElementSibling as T);
  while (elem) {
    if (elem == sourceElem) {
      continue;
    } else if (test(elem)) {
      matchedElems.push(elem);
      elem = direction == -1 ? (elem.previousElementSibling as T) : (elem.nextElementSibling as T);
    } else {
      break;
    }
  }
  return matchedElems;
}

/**
 * Iterates through the parent chain of a node and performs the callback on each parent
 */
export function forEachAncestor<T extends HTMLElement>(elem: T, callback: (e: T) => void) {
  while (elem) {
    callback(elem);
    elem = elem.parentElement as T;
  }
}
