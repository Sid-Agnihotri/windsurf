import { Resend } from "resend";

type Mail = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Sends via Resend when RESEND_API_KEY is set; otherwise logs to console (local/mock).
 */
export async function sendEmail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Windsurf <onboarding@resend.dev>";

  if (!key) {
    console.log("[email:mock]", {
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html.slice(0, 200) + (mail.html.length > 200 ? "…" : ""),
    });
    return { id: "mock", mocked: true as const };
  }

  const resend = new Resend(key);
  const result = await resend.emails.send({
    from,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
  });
  return { ...result, mocked: false as const };
}

function manageLinkHtml(url: string) {
  return `<p>Need to change or cancel? <a href="${escapeHtml(url)}">Manage your booking</a>.</p>`;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBookingConfirmation(opts: {
  guestEmail: string;
  guestName: string;
  hostEmail: string;
  hostName: string;
  eventTitle: string;
  whenLabel: string;
  /** Plain-text payment line, e.g. what's still due in person */
  paymentNote?: string;
  /** Guest-only link to cancel or reschedule */
  manageUrl?: string;
}) {
  const guestName = escapeHtml(opts.guestName);
  const guestEmail = escapeHtml(opts.guestEmail);
  const hostName = escapeHtml(opts.hostName);
  const eventTitle = escapeHtml(opts.eventTitle);
  const whenLabel = escapeHtml(opts.whenLabel);
  const note = opts.paymentNote ? `<p>${escapeHtml(opts.paymentNote)}</p>` : "";
  const subjectTitle = opts.eventTitle.replace(/[\r\n]+/g, " ");
  const manage = opts.manageUrl ? manageLinkHtml(opts.manageUrl) : "";

  const guestHtml = `<p>Hi ${guestName},</p><p>Your <strong>${eventTitle}</strong> with ${hostName} is confirmed for <strong>${whenLabel}</strong>.</p>${note}${manage}<p>— Windsurf</p>`;
  const hostHtml = `<p>Hi ${hostName},</p><p>${guestName} (${guestEmail}) booked <strong>${eventTitle}</strong> for <strong>${whenLabel}</strong>.</p>${note}<p>— Windsurf</p>`;

  await Promise.all([
    sendEmail({
      to: opts.guestEmail,
      subject: `Confirmed: ${subjectTitle}`,
      html: guestHtml,
    }),
    sendEmail({
      to: opts.hostEmail,
      subject: `New booking: ${subjectTitle}`,
      html: hostHtml,
    }),
  ]);
}

type Parties = {
  guestEmail: string;
  guestName: string;
  hostEmail: string;
  hostName: string;
  eventTitle: string;
};

/** Tells both sides a booking was cancelled, and by whom. */
export async function sendBookingCancelled(
  opts: Parties & {
    whenLabel: string;
    cancelledBy: "guest" | "host";
    /** Plain-text extra line for the guest, e.g. how refunds work */
    guestNote?: string;
    /** Plain-text extra line for the host, e.g. money to refund */
    hostNote?: string;
  }
) {
  const guestName = escapeHtml(opts.guestName);
  const guestEmail = escapeHtml(opts.guestEmail);
  const hostName = escapeHtml(opts.hostName);
  const eventTitle = escapeHtml(opts.eventTitle);
  const whenLabel = escapeHtml(opts.whenLabel);
  const guestNote = opts.guestNote ? `<p>${escapeHtml(opts.guestNote)}</p>` : "";
  const hostNote = opts.hostNote ? `<p>${escapeHtml(opts.hostNote)}</p>` : "";

  const byGuest = opts.cancelledBy === "guest";
  const guestHtml = `<p>Hi ${guestName},</p><p>${
    byGuest
      ? `Your booking for <strong>${eventTitle}</strong> with ${hostName} on <strong>${whenLabel}</strong> has been cancelled.`
      : `${hostName} cancelled your booking for <strong>${eventTitle}</strong> on <strong>${whenLabel}</strong>.`
  }</p>${guestNote}<p>— Windsurf</p>`;
  const hostHtml = `<p>Hi ${hostName},</p><p>${
    byGuest
      ? `${guestName} (${guestEmail}) cancelled <strong>${eventTitle}</strong> on <strong>${whenLabel}</strong>.`
      : `You cancelled <strong>${eventTitle}</strong> with ${guestName} (${guestEmail}) on <strong>${whenLabel}</strong>.`
  }</p>${hostNote}<p>— Windsurf</p>`;

  await Promise.all([
    sendEmail({
      to: opts.guestEmail,
      subject: `Cancelled: ${oneLine(opts.eventTitle)}`,
      html: guestHtml,
    }),
    sendEmail({
      to: opts.hostEmail,
      subject: `Booking cancelled: ${oneLine(opts.eventTitle)}`,
      html: hostHtml,
    }),
  ]);
}

/** Tells both sides a booking moved to a new time. */
export async function sendBookingRescheduled(
  opts: Parties & {
    oldWhenLabel: string;
    whenLabel: string;
    movedBy: "guest" | "host";
    /** Guest-only link to cancel or reschedule again */
    manageUrl?: string;
  }
) {
  const guestName = escapeHtml(opts.guestName);
  const guestEmail = escapeHtml(opts.guestEmail);
  const hostName = escapeHtml(opts.hostName);
  const eventTitle = escapeHtml(opts.eventTitle);
  const oldWhen = escapeHtml(opts.oldWhenLabel);
  const newWhen = escapeHtml(opts.whenLabel);
  const manage = opts.manageUrl ? manageLinkHtml(opts.manageUrl) : "";

  const byHost = opts.movedBy === "host";
  const guestHtml = `<p>Hi ${guestName},</p><p>${
    byHost
      ? `${hostName} moved your <strong>${eventTitle}</strong> from ${oldWhen} to <strong>${newWhen}</strong>.`
      : `Your <strong>${eventTitle}</strong> with ${hostName} moved from ${oldWhen} to <strong>${newWhen}</strong>.`
  }</p>${manage}<p>— Windsurf</p>`;
  const hostHtml = `<p>Hi ${hostName},</p><p>${
    byHost
      ? `You moved <strong>${eventTitle}</strong> with ${guestName} (${guestEmail}) from ${oldWhen} to <strong>${newWhen}</strong>.`
      : `${guestName} (${guestEmail}) moved <strong>${eventTitle}</strong> from ${oldWhen} to <strong>${newWhen}</strong>.`
  }</p><p>— Windsurf</p>`;

  await Promise.all([
    sendEmail({
      to: opts.guestEmail,
      subject: `Rescheduled: ${oneLine(opts.eventTitle)}`,
      html: guestHtml,
    }),
    sendEmail({
      to: opts.hostEmail,
      subject: `Booking rescheduled: ${oneLine(opts.eventTitle)}`,
      html: hostHtml,
    }),
  ]);
}
