import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get user info from the frontend
    const { userId, email } = req.body || {};
    if (!userId || !email) {
      return res.status(400).json({ error: "Missing userId or email" });
    }

    // Where to send the user after payment
    const origin = req.headers.origin || "https://passinggrade.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      // attach user info so webhook can upgrade the right account
      customer_email: email,
      metadata: {
        user_id: userId,
        user_email: email,
      },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Error creating checkout session", err);
    return res
      .status(500)
      .json({ error: "Failed to create checkout session" });
  }
}
