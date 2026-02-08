import Stripe from "stripe";
import env from "../config/env.js";

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    if (!env.stripe.secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(env.stripe.secretKey);
  }
  return stripeInstance;
}

export function getStripePublishableKey(): string {
  if (!env.stripe.publishableKey) {
    throw new Error("STRIPE_PUBLISHABLE_KEY is not configured");
  }
  return env.stripe.publishableKey;
}
