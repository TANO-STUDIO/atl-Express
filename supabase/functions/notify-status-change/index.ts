import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") || "Alt Express <onboarding@resend.dev>";

const statusMessages: Record<string, { subject: string; headline: string; body: string }> = {
  pending: {
    subject: "We've received your booking",
    headline: "Booking received",
    body: "We've received your shipment booking and it's being processed."
  },
  confirmed: {
    subject: "Your shipment is confirmed",
    headline: "Booking confirmed",
    body: "Your shipment has been confirmed and is being prepared for pickup."
  },
  picked_up: {
    subject: "Your parcel has been picked up",
    headline: "Picked up",
    body: "Your parcel has been picked up and is on its way to our sorting hub."
  },
  in_transit: {
    subject: "Your parcel is in transit",
    headline: "In transit",
    body: "Your parcel is currently in transit to its destination."
  },
  delivered: {
    subject: "Your parcel has been delivered",
    headline: "Delivered",
    body: "Great news — your parcel has been delivered."
  },
  cancelled: {
    subject: "Your booking was cancelled",
    headline: "Booking cancelled",
    body: "Your shipment booking has been cancelled. Contact support if this wasn't expected."
  }
};

function buildEmailHtml(refCode: string, status: string, booking: any) {
  const info = statusMessages[status] || {
    subject: "Shipment status updated",
    headline: status,
    body: "Your shipment status has been updated."
  };

  return {
    subject: info.subject + " — " + refCode,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a3a5c;">
        <h2 style="color:#1a3a5c;">${info.headline}</h2>
        <p style="font-size:15px; line-height:1.6;">${info.body}</p>
        <div style="background:#f7f5f0; border-radius:10px; padding:20px; margin:24px 0;">
          <div style="font-size:12px; color:#4a7fa5; margin-bottom:4px;">Booking reference</div>
          <div style="font-family:monospace; font-size:18px; font-weight:bold;">${refCode}</div>
          <div style="margin-top:16px; font-size:14px;">
            <strong>To:</strong> ${booking.destination_country}<br>
            <strong>Weight:</strong> ${booking.weight} kg<br>
            <strong>Service:</strong> ${booking.service_type}
          </div>
        </div>
        <p style="font-size:13px; color:#4a7fa5;">
          Track this shipment anytime using your booking reference on the Alt Express website.
        </p>
      </div>
    `
  };
}

serve(async (req) => {
  try {
    const payload = await req.json();

    const booking = payload.record;
    const oldBooking = payload.old_record;

    if (!booking || !booking.receiver_email) {
      return new Response(JSON.stringify({ skipped: true, reason: "No receiver email on booking" }), { status: 200 });
    }

    if (oldBooking && oldBooking.status === booking.status) {
      return new Response(JSON.stringify({ skipped: true, reason: "Status unchanged" }), { status: 200 });
    }

    const refCode = booking.id.slice(0, 8).toUpperCase();
    const { subject, html } = buildEmailHtml(refCode, booking.status, booking);

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.receiver_email,
        subject: subject,
        html: html
      })
    });

    const emailResult = await emailResp.json();

    if (!emailResp.ok) {
      return new Response(JSON.stringify({ error: emailResult }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, emailResult }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});