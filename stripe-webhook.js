// api/stripe-webhook.js
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Simple webhook handler for now: just log events so we can confirm it's working
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const event = req.body; // Vercel parses JSON for us

    console.log("🔔 Stripe webhook received:", event.type);

    // For now, just acknowledge. We'll add Supabase logic after we confirm this works.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(400).json({ error: "Webhook handler error" });
  }
};
