// All push-notification and SMS texts, in every launch language.
// The server picks the recipient's language from their profile.
import type { Lang } from "./types";

function pick(lang: Lang, en: string, el: string): string {
  return lang === "el" ? el : en;
}

/** Push notifications shown in the OS notification tray. */
export const pushText = {
  matchCreated: (lang: Lang, otherName: string): string =>
    pick(
      lang,
      `It's a match! You and ${otherName} both said yes. Say hello!`,
      `Τα βρήκατε! Εσύ και ο/η ${otherName} είπατε «ναι». Πείτε ένα γεια!`,
    ),
  responseCreated: (lang: Lang, responderName: string, activity: string): string =>
    pick(
      lang,
      `${responderName} would like to join you: ${activity}.`,
      `Ο/Η ${responderName} θέλει να έρθει μαζί σας: ${activity}.`,
    ),
  requestAccepted: (lang: Lang, ownerName: string): string =>
    pick(
      lang,
      `${ownerName} accepted your request! The chat is open.`,
      `Ο/Η ${ownerName} δέχτηκε το αίτημά σας! Η συνομιλία άνοιξε.`,
    ),
  requestDeclined: (lang: Lang): string =>
    pick(
      lang,
      "Your request was seen. Keep an eye out — more people may join.",
      "Το αίτημά σας είδε κάποιος. Μείνετε συντονισμένοι — ίσως σας βρει και άλλος.",
    ),
  planReminder: (lang: Lang, placeName: string, startsAt: string): string =>
    pick(
      lang,
      `Reminder: tomorrow at ${placeName}, ${startsAt}.`,
      `Υπενθύμιση: αύριο στις ${placeName}, ${startsAt}.`,
    ),
  planChanged: (lang: Lang, placeName: string): string =>
    pick(
      lang,
      `The plan at ${placeName} changed. Check the details in the app.`,
      `Το ραντεβού στο «${placeName}» άλλαξε. Δείτε τις λεπτομέρειες στην εφαρμογή.`,
    ),
  checkinAsk: (lang: Lang): string =>
    pick(
      lang,
      `Did you get home well? Please open the app and tap "I'm safe".`,
      `Γυρίσατε καλά σπίτι; Ανοίξτε την εφαρμογή και πατήστε «Είμαι καλά».`,
    ),
  verified: (lang: Lang): string =>
    pick(
      lang,
      `Your profile is now verified. Well done!`,
      `Το προφίλ σας επαληθεύτηκε. Μπράβο!`,
    ),
  volunteerApproved: (lang: Lang): string =>
    pick(
      lang,
      `You are now a Parea volunteer. Thank you for helping!`,
      `Είστε πλέον εθελοντής/εθελόντρια του Parea. Ευχαριστούμε για τη βοήθεια!`,
    ),
  warned: (lang: Lang): string =>
    pick(
      lang,
      `Our team reviewed a report about your account. Please review our safety rules.`,
      `Η ομάδα μας εξέτασε καταγγελία για τον λογαριασμό σας. Παρακαλούμε δείτε τους κανόνες ασφαλείας.`,
    ),
};

/** SMS texts — sent to trusted contacts who may not have the app installed. */
export const smsText = {
  otp: (code: string): string =>
    `Parea: your code is ${code} / Ο κωδικός σας είναι ${code}`,
  planShared: (lang: Lang, userName: string, placeName: string, startsAt: string): string =>
    pick(
      lang,
      `Parea: ${userName} plans to meet someone new: ${placeName}, ${startsAt}. You can ask them about it later.`,
      `Parea: ο/η ${userName} θα συναντήσει νέο γνωστό: ${placeName}, ${startsAt}. Μπορείτε να ρωτήσετε πώς πήγε.`,
    ),
  checkinMissed: (lang: Lang, userName: string, placeName: string, startsAt: string): string =>
    pick(
      lang,
      `Parea ATTENTION: ${userName} did not confirm "I'm safe" after their meeting (${placeName}, ${startsAt}). Please contact them.`,
      `Parea ΠΡΟΣΟΧΗ: ο/η ${userName} δεν επιβεβαίωσε το «Είμαι καλά» μετά τη συνάντηση (${placeName}, ${startsAt}). Παρακαλούμε επικοινωνήστε μαζί του/ης.`,
    ),
  sos: (lang: Lang, userName: string, details: string): string =>
    pick(
      lang,
      `Parea SOS: ${userName} is asking for urgent help. ${details}`,
      `Parea ΣΟΣ: ο/η ${userName} ζητά άμεση βοήθεια. ${details}`,
    ),
  // Like the SOS itself, the stand-down is bilingual — any trusted contact may
  // be on the other end. Sends after the senior taps "I'm OK" post-alarm.
  sosOk: (userName: string): string =>
    `Parea: ${userName} says they are OK now. / Parea: ο/η ${userName} λέει ότι είναι καλά.`,
};
