export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailResult =
  | { sent: true }
  | { sent: false; reason: 'unconfigured' | 'no_recipient' }
  | { sent: false; reason: 'failed'; detail?: string };

export async function sendMail(mail: OutboundMail): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, reason: 'unconfigured' };

  const from = process.env.MAIL_FROM?.trim() || 'Frego <noreply@frego.app.br>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text();
      let detail = body.slice(0, 300);
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) detail = parsed.message;
      } catch {
        // Keep the raw response snippet.
      }
      return { sent: false, reason: 'failed', detail };
    }
    return { sent: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'request failed';
    return { sent: false, reason: 'failed', detail };
  }
}
