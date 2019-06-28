export function bufferToBase64(buf) {
  const binstr = Array.prototype.map
    .call(buf, function(ch) {
      return String.fromCharCode(ch);
    })
    .join("");
  return btoa(binstr);
}
