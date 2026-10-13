export const ZORA_MAGENTA = '#d62ca4';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
}

/** Produce an email draft only. The application has no sendMail implementation. */
export function brandedEmail(body: string): string {
  const paragraphs = body.split(/\n\s*\n/).map(p => `<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f5f4f7"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#ffffff;font-family:Arial,sans-serif;color:#181923"><tr><td height="6" style="height:6px;background:${ZORA_MAGENTA};font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:24px 32px 14px"><span style="display:inline-block;color:${ZORA_MAGENTA};font-size:28px;vertical-align:middle">●</span> <strong style="font-size:18px">Zora</strong> <span style="color:#777487;font-size:12px">for Mindmap Digital</span></td></tr><tr><td style="padding:12px 32px 24px;font-size:15px">${paragraphs}<p style="font-size:12px;color:#777487;border-top:1px solid #eee;padding-top:16px">Prepared by Zora · Mindmap Digital</p></td></tr></table></td></tr></table></body></html>`;
}

export function ownsMessage(subject: string, categories: string[] = [], tag = '[ZORA]'): boolean {
  // Never infer ownership from an industry word, an unread flag, or a generic request.
  if (subject.toUpperCase().includes('[JARVIS]') || categories.some(c => c.toLowerCase() === 'jarvis')) return false;
  return subject.toUpperCase().includes(tag.toUpperCase());
}
