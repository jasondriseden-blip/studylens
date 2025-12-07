// api/create-checkout-session.js
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let userId;
    let email;

    // Handle both parsed JSON and raw string body
    if (req.body) {
      if (typeof req.body === "string") {
        try {
          const parsed = JSON.parse(req.body);
          userId = parsed.userId;
          email = parsed.email;
        } catch (e) {
          console.warn("Could not parse JSON body for checkout:", e);
        }
      } else if (typeof req.body === "object") {
        userId = req.body.userId;
        email = req.body.email;
      }
    }

    // Where to send the user after payment
    const origin =
      req.headers.origin || process.env.SITE_URL || "https://passinggrade.app";

    if (!process.env.STRIPE_PRICE_ID) {
      console.error("Missing STRIPE_PRICE_ID env var");
      return res
        .status(500)
        .json({ error: "Missing STRIPE_PRICE_ID configuration" });
    }

    const sessionConfig = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {},
    };

    if (email) {
      sessionConfig.customer_email = email;
      sessionConfig.metadata.user_email = email;
    }

    if (userId) {
      sessionConfig.metadata.user_id = userId;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Error creating checkout session", err);
    return res
      .status(500)
      .json({ error: "Failed to create checkout session" });
  }
};
