// Supabase Edge Function: send-contact-message
// Called directly from the browser (contact.html) when a visitor submits the contact form.
// Stores the message in contact_messages, then emails you via Resend with
// reply-to set to the visitor's address so you can just hit Reply to respond.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") || "Alt Express <onboarding@resend.dev>";
const CONTACT_INBOX_EMAIL = Deno.env.get("CONTACT_INBOX_EMAIL") || "tanostd@gmail.com";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Needed because, unlike notify-status-change (server-triggered), this
// function is called directly from the browser.
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

function buildEmailHtml(name: string, email: string, company: string, topic: string, message: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a3a5c;">
      <h2 style="color:#1a3a5c;">New contact form message</h2>
      <p style="font-size:15px; line-height:1.6;">You've received a new message from the Alt Express contact form.</p>
      <div style="background:#f7f5f0; border-radius:10px; padding:20px; margin:24px 0;">
        <div style="font-size:14px; margin-bottom:6px;"><strong>Name:</strong> ${escapeHtml(name)}</div>
        <div style="font-size:14px; margin-bottom:6px;"><strong>Email:</strong> ${escapeHtml(email)}</div>
        ${company ? `<div style="font-size:14px; margin-bottom:6px;"><strong>Company:</strong> ${escapeHtml(company)}</div>` : ""}
        ${topic ? `<div style="font-size:14px; margin-bottom:6px;"><strong>Topic:</strong> ${escapeHtml(topic)}</div>` : ""}
        <div style="margin-top:16px; font-size:14px; white-space:pre-wrap;">${escapeHtml(message)}</div>
      </div>
      <p style="font-size:13px; color:#4a7fa5;">
        Reply directly to this email to respond to ${escapeHtml(name)}.
      </p>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { name, email, company, topic, message } = payload;

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

    // Store the message (best-effort — don't block the email on this)
    const { error: dbError } = await supabaseAdmin
      .from("contact_messages")
      .insert({ name, email, company: company || null, topic: topic || null, message });

    if (dbError) {
      console.error("DB insert error:", dbError);
    }

    const html = buildEmailHtml(name, email, company, topic, message);

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: CONTACT_INBOX_EMAIL,
        reply_to: email,
        subject: `New message from ${name}${topic ? " — " + topic : ""}`,
        html: html
      })
    });

    const emailResult = await emailResp.json();

    if (!emailResp.ok) {
      return new Response(
        JSON.stringify({ error: emailResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, emailResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
