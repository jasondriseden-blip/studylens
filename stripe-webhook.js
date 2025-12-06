// api/stripe-webhook.js (or pages/api/stripe-webhook.js)

// Reuse your Supabase REST endpoint + anon key
const SUPABASE_URL = "https://rwjijfffirbpmkhcptrb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amlqZmZmaXJicG1raGNwdHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzYxNDgsImV4cCI6MjA4MDYxMjE0OH0.Lfv2HGMbdyyjF_SUA-7rWWN5XpvaLX8I36-upjH8_nQ";

// Helper: call your RPC function set_user_plan(email, plan)
async function setUserPlanProByEmail(email) {
  if (!email) return;

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/set_user_plan`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_email: email,
          p_plan: "pro",
        }),
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error("set_user_plan RPC failed:", resp.status, text);
    } else {
      console.log("set_user_plan RPC succeeded for", email);
    }
  } catch (err) {
    console.error("Error calling set_user_plan RPC:", err);
  }
}

export default async function handler(req, res) {
  // Stripe will send POST requests here
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Stripe (with JSON body) will already be parsed into req.body by Next/Vercel
    const event = req.body || {};

    const type = event.type || "unknown";
    let email = null;

    if (event.data && event.data.object) {
      const obj = event.data.object;

      // These cover Payment Links / Checkout Sessions, etc.
      email =
        obj.customer_email ||
        (obj.customer_details && obj.customer_details.email) ||
        obj.receipt_email ||
        null;
    }

    console.log("Stripe webhook event type:", type);
    console.log("Stripe webhook customer email:", email);

    // 🔹 When a checkout session completes, upgrade that email to Pro
    if (type === "checkout.session.completed" && email) {
      await setUserPlanProByEmail(email);
    }

    // For now we just acknowledge so Stripe is happy
    return res.status(200).json({
      received: true,
      type,
      email,
    });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return res.status(500).json({ error: "Webhook error" });
  }
}
