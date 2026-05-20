import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.13";

// Edge functions automatically inject SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  const url = new URL(req.url);
  const secret = Deno.env.get("WEBHOOK_SECRET") || "recruitscout-secret-key-123";

  // ─── 1. RESET QUEUE (GET Request from Email Link) ──────────────────────────
  if (req.method === "GET" && url.searchParams.get("action") === "reset") {
    const token = url.searchParams.get("token");
    if (token !== secret) {
      return new Response("Invalid secure token", { status: 401 });
    }

    const { error } = await supabase
      .from("BulkQueue")
      .update({
        status: "pending",
        assigned_to: null,
        started_at: null,
        completed_at: null,
      })
      .in("status", ["completed", "failed"]);

    if (error) {
      return new Response(`Error resetting queue: ${error.message}`, {
        status: 500,
      });
    }

    const successText = 
"==========================================\n" +
"✅ QUEUE SUCCESSFULLY RESET!\n" +
"==========================================\n\n" +
"All tasks have been moved back to the 'pending' state.\n" +
"Your remote nodes will automatically pick them up on their next polling cycle.\n\n" +
"You can safely close this window.";

    return new Response(successText, {
      status: 200,
      headers: new Headers({
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }),
    });
  }

  // ─── 2. SEND EMAIL (POST Request from Database Trigger) ────────────────────
  if (req.method === "POST") {
    // Validate trigger authorization
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return new Response("Unauthorized trigger call", { status: 401 });
    }

    const myEmail = Deno.env.get("GMAIL_ADDRESS");
    const myPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!myEmail || !myPassword) {
      console.error("Missing Gmail credentials in Edge Function env vars");
      return new Response("Missing config", { status: 500 });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: myEmail,
          pass: myPassword.replace(/\s+/g, ""),
        },
      });

      const resetLink = `https://qyceqgttvvairnaxwicm.supabase.co/functions/v1/queue-webhook?action=reset&token=${secret}`;

      await transporter.sendMail({
        from: myEmail,
        to: myEmail,
        subject: "🚀 RecruitScout: Scraping Queue Completed!",
        text: "Your scraping queue has finished processing.",
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 40px;">🚀</span>
            </div>
            <h2 style="color: #111827; text-align: center; margin-bottom: 10px;">Scraping Swarm Finished</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
              All active tasks in your BulkQueue have successfully moved to completed or failed states. Your remote worker nodes are now idle.
            </p>
            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0;" />
            <div style="text-align: center;">
              <a href="${resetLink}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                ↺ Reset Queue to Pending
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
              RecruitScout Command Center Notification
            </p>
          </div>
        `,
      });

      return new Response("Email alert sent successfully!", { status: 200 });
    } catch (e) {
      console.error("SMTP Error:", e);
      return new Response(`Error sending email: ${(e as Error).message}`, {
        status: 500,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
