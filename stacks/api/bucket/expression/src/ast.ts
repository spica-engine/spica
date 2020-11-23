export function getMostLeftSelectIdentifier(node) {
  if (node.lhs && node.lhs.kind == "identifier") {
    return node.lhs.name;
  }
  return getMostLeftSelectIdentifier(node.lhs);
}

export function isSelectChain(node) {
  if (node.lhs && node.lhs.kind != "identifier") {
    return false;
  } else if (!node.lhs && node.kind == "identifier") {
    return true;
  }
  return isSelectChain(node.lhs);
}
