const apiKey = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN;
const fromAddress = process.env.MAILER_ADDRESS ?? `noreply@${domain ?? "localhost"}`;
const region = process.env.MAILGUN_REGION === "us" ? "us" : "eu";
const apiBase =
  region === "us" ? "https://api.mailgun.net" : "https://api.eu.mailgun.net";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

// Table-based layout and inline styles throughout, deliberately: email
// clients (Gmail/Outlook web especially) strip <style> blocks and modern
// CSS, so this is the one layer of the app that has to be built the old
// way to render consistently.
export function emailShell(input: {
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  facilityName?: string;
}): string {
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f7fa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
            <tr>
              <td style="background-color:#0b1b2b;padding:28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:18px;font-weight:700;color:#ffffff;">Lunar</td>
                    <td align="right" style="font-size:11px;letter-spacing:1px;color:rgba(255,255,255,0.55);">${(input.facilityName ?? "HOSPITAL REVENUE PLATFORM").toUpperCase()}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px 32px;">
                <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:1px;color:#0f9d78;text-transform:uppercase;">${input.eyebrow}</p>
                <h1 style="margin:0;font-size:22px;color:#101828;font-weight:700;">${input.heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px 32px;font-size:14px;line-height:1.6;color:#344054;">
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f5f7fa;border-top:1px solid #e4e7ec;">
                <p style="margin:0;font-size:12px;color:#667085;">This is an automated message from Lunar. Please do not reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Email is a courtesy to the patient, never a condition for the billing
// workflow to proceed — a Mailgun outage must not block raising or
// clearing a bill, so failures are logged and swallowed, not thrown.
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!apiKey || !domain) {
    console.warn(
      `Mailgun is not configured; skipped email to ${input.to} ("${input.subject}").`,
    );
    return;
  }

  const body = new URLSearchParams({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  try {
    const response = await fetch(`${apiBase}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `Mailgun send failed (${response.status}) to ${input.to}: ${text}`,
      );
    }
  } catch (error) {
    console.error(`Mailgun send threw for ${input.to}:`, error);
  }
}
