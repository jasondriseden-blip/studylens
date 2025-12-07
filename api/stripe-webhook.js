// api/stripe-webhook.js
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Supabase service client (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple webhook handler
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const event = req.body; // Vercel parses JSON for us

    console.log("🔔 Stripe webhook received:", event.type);

    // When checkout is completed, upgrade the user to pro
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId =
        (session.metadata && session.metadata.user_id) ||
        session.client_reference_id ||
        null;

      const email =
        (session.metadata && session.metadata.user_email) ||
        (session.customer_details && session.customer_details.email) ||
        null;

      if (!userId) {
        console.warn(
          "checkout.session.completed received without user_id metadata"
        );
      } else {
        const { error } = await supabase
          .from("user_plans")
          .upsert(
            {
              user_id: userId,
              email,
              plan: "pro",
            },
            { onConflict: "user_id" }
          );

        if (error) {
          console.error("Error updating user_plans to pro:", error);
        } else {
          console.log("✅ Upgraded user to pro:", userId);
        }
      }
    }

    // For now, just acknowledge
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(400).json({ error: "Webhook handler error" });
  }
};
