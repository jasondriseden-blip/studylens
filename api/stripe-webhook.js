// api/stripe-webhook.js

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    console.log("🔔 Stripe webhook raw body:", req.body);
    const event = req.body || {};
    console.log("🔔 Stripe webhook type:", event.type);

    // Just acknowledge for now so Stripe stops failing
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(500).json({ error: "Webhook handler error" });
  }
};
