// Spreadsheet-view export: quote delimiters and force potential formulas to text.
// OWASP: https://owasp.org/www-community/attacks/CSV_Injection
// The protective tab is intentionally part of exported data, not stored data.
export function csvCell(value: string): string {
  const unsafePrefix = /^[\s\u0000-\u001f\u007f]*[=+\-@＝＋－＠]/u.test(value)
    || /^[\u0000-\u001f\u007f]/u.test(value);
  const text = unsafePrefix ? `\t${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}
