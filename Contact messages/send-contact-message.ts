// supabase/functions/send-contact-message/index.ts
//
// Handles Alt Express contact form submissions:
//   1. Validates the incoming form data
//   2. Stores the message in the contact_messages table
//   3. Emails you via Resend, with reply-to set to the visitor's email
//      so you can just hit "Reply" in Gmail to respond to them directly
//
// Deploy with:
//   supabase functions deploy send-contact-message
//
// Required secrets (set once via Supabase CLI or Dashboard > Edge Functions > Secrets):
//   RESEND_API_KEY        - your Resend API key
//   CONTACT_INBOX_EMAIL   - where you want to receive messages, e.g. tanostd@gmail.com
//   RESEND_FROM_ADDRESS   - a verified sender on your Resend domain,
//                           e.g. "Alt Express Contact <contact@alt-express.yourdomain.com>"
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already available
// automatically inside every Edge Function — no need to set them yourself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CONTACT_INBOX_EMAIL = Deno.env.get("CONTACT_INBOX_EMAIL")!;
const RESEND_FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, company, topic, message } = await req.json();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Name, email, and message are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Store the message in Supabase
    const { error: dbError } = await supabaseAdmin
      .from("contact_messages")
      .insert({
        name,
        email,
        company: company || null,
        topic: topic || null,
        message,
      });

    if (dbError) {
      console.error("DB insert error:", dbError);
      // Don't block the email send just because logging failed
    }

    // 2. Send the email via Resend
    const emailHtml = `
      <div style="font-family:sans-serif; line-height:1.6;">
        <h2>New contact form message — Alt Express</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : ""}
        ${topic ? `<p><strong>Topic:</strong> ${escapeHtml(topic)}</p>` : ""}
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap; background:#f5f5f5; padding:12px; border-radius:6px;">${escapeHtml(message)}</p>
        <p style="color:#888; font-size:12px; margin-top:24px;">Reply to this email to respond directly to ${escapeHtml(name)}.</p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_ADDRESS,
        to: CONTACT_INBOX_EMAIL,
        reply_to: email,
        subject: `New message from ${name}${topic ? " — " + topic : ""}`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend error:", errText);
      return new Response(
        JSON.stringify({ error: "Message saved, but email notification failed to send." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
