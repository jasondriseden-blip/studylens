// api/stripe-webhook.js
const { createClient } = require("@supabase/supabase-js");

// Server-side Supabase client (uses service role key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const event = req.body || {};
    console.log("🔔 Stripe webhook type:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data && event.data.object;
      console.log(
        "➡️ checkout.session.completed session:",
        session && session.id
      );

      if (session) {
        const metadata = session.metadata || {};

        const email =
          metadata.user_email ||
          (session.customer_details && session.customer_details.email) ||
          null;

        const userId = metadata.user_id || null;

        console.log("Webhook metadata:", { email, userId });

        if (!userId) {
          console.warn(
            "No user_id in metadata; cannot update user_plans by user_id."
          );
        } else {
          console.log("Updating user_plans for user_id:", userId);

          try {
            const { error } = await supabase
              .from("user_plans")
              .upsert(
                {
                  user_id: userId,
                  plan: "pro",
                  stripe_customer_id: session.customer || null,
                },
                { onConflict: "user_id" } // 👈 match existing PK/unique
              );

            if (error) {
              console.error("Error updating user_plans to pro:", error);
            } else {
              console.log("✅ Upgraded user to pro (by user_id):", userId);
            }
          } catch (dbErr) {
            console.error("Supabase upsert exception:", dbErr);
          }
        }
      }
    }

    // Always acknowledge so Stripe stays happy
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(500).json({ error: "Webhook handler error" });
  }
};
