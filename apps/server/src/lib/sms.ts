// SMS via the Twilio REST API, using plain fetch (no SDK dependency).
// Returns false when Twilio is not configured — callers decide whether
// that is an error (production) or acceptable (local dev).

export function smsConfigured(env: Env): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

export async function sendSms(env: Env, to: string, body: string): Promise<boolean> {
  if (!smsConfigured(env)) return false;
  const sid = env.TWILIO_ACCOUNT_SID!;
  const auth = btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER!, Body: body }),
    });
    if (!res.ok) {
      console.error("Twilio send failed", { status: res.status, to: maskPhone(to) });
      return false;
    }
    return true;
  } catch (err) {
    console.error("Twilio request threw", { err: String(err) });
    return false;
  }
}

function maskPhone(phone: string): string {
  return phone.length <= 6 ? "***" : `${phone.slice(0, 4)}****${phone.slice(-4)}`;
}
