export function categorizePropertyMap(propertyMap: string[][]) {
  const documentPropertyMap: string[][] = [];
  const authPropertyMap: string[][] = [];

  propertyMap.forEach(pmap =>
    pmap[0] == "auth"
      ? authPropertyMap.push(pmap.slice(1))
      : documentPropertyMap.push(pmap.slice(1))
  );

  return {documentPropertyMap, authPropertyMap};
}
