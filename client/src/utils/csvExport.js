/**
 * Trigger a CSV file download in the browser.
 * @param {Blob} blob - The CSV blob from the server
 * @param {string} filename - Suggested file name
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
