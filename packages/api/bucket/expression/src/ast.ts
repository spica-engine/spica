export function getMostLeftSelectIdentifier(node) {
  if (node.left && node.left.kind == "identifier") {
    return node.left.name;
  }
  return getMostLeftSelectIdentifier(node.left);
}

export function isSelectChain(node) {
  if (node.left && node.left.kind != "identifier") {
    return false;
  } else if (!node.left && node.kind == "identifier") {
    return true;
  }
  return isSelectChain(node.left);
}

export function assertListAfterIn(node) {
  if (!Array.isArray(node.right)) {
    throw new TypeError(
      "The right side of 'in' must be a list, for example document.status in ['open', 'done']."
    );
  }
}

export function isIdentifier(node) {
  return node.kind == "identifier";
}
