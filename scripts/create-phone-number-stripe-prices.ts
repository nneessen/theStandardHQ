/**
 * One-time setup script: Creates Stripe product + prices for voice phone numbers.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-phone-number-stripe-prices.ts
 *
 * Output: Two price IDs to hardcode in manage-subscription-items edge function.
 */
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error(
    "Error: STRIPE_SECRET_KEY env var is required.\n" +
      "Usage: STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-phone-number-stripe-prices.ts",
  );
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

async function main() {
  // Check if product already exists
  const existing = await stripe.products.search({
    query: 'metadata["feature"]:"voice_phone_number"',
  });

  let product: Stripe.Product;

  if (existing.data.length > 0) {
    product = existing.data[0];
    console.log(`Found existing product: ${product.id} (${product.name})`);
  } else {
    product = await stripe.products.create({
      name: "Voice Phone Number",
      description:
        "Dedicated phone number for AI voice agent inbound/outbound calls",
      metadata: { feature: "voice_phone_number" },
    });
    console.log(`Created product: ${product.id}`);
  }

  // Check for existing prices on this product
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 10,
  });

  const existingLocal = existingPrices.data.find(
    (p) => p.metadata.type === "local",
  );
  const existingTollFree = existingPrices.data.find(
    (p) => p.metadata.type === "toll_free",
  );

  // Create local number price ($1.99/mo)
  let localPrice: Stripe.Price;
  if (existingLocal) {
    localPrice = existingLocal;
    console.log(`Found existing local price: ${localPrice.id}`);
  } else {
    localPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 199,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { type: "local", feature: "voice_phone_number" },
    });
    console.log(`Created local price: ${localPrice.id} ($1.99/mo)`);
  }

  // Create toll-free number price ($3.99/mo)
  let tollFreePrice: Stripe.Price;
  if (existingTollFree) {
    tollFreePrice = existingTollFree;
    console.log(`Found existing toll-free price: ${tollFreePrice.id}`);
  } else {
    tollFreePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 399,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { type: "toll_free", feature: "voice_phone_number" },
    });
    console.log(`Created toll-free price: ${tollFreePrice.id} ($3.99/mo)`);
  }

  console.log("\n════════════════════════════════════════════════");
  console.log("  Add these constants to manage-subscription-items:");
  console.log("════════════════════════════════════════════════");
  console.log(`const PHONE_NUMBER_LOCAL_PRICE_ID = "${localPrice.id}";`);
  console.log(`const PHONE_NUMBER_TOLLFREE_PRICE_ID = "${tollFreePrice.id}";`);
  console.log("════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
