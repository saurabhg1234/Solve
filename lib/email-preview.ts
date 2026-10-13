/** Display a stored plain-text draft without interpreting email content as markup. */
export function emailPreview(text: string) {
  const match = /^To: ([^\r\n]+)\r?\nCc: ([^\r\n]*)\r?\nSubject: ([^\r\n]+)\r?\n\r?\n([\s\S]+)$/.exec(text);
  return match ? { to: match[1], cc: match[2], subject: match[3], body: match[4] } : null;
}
