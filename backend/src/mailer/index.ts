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
