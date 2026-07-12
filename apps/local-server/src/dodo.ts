import DodoPayments from "dodopayments";

export type CheckoutGateway = {
  create(input: { auditId: string }): Promise<{ checkoutUrl: string; paymentId: string }>;
};

export function createDodoCheckoutGateway(env: NodeJS.ProcessEnv = process.env): CheckoutGateway {
  const bearerToken = env.DODO_PAYMENTS_API_KEY;
  const productId = env.DODO_PRODUCT_ID;
  const publicUrl = (env.NATIVAS_PUBLIC_URL ?? "https://nativas.ai").replace(/\/$/, "");
  if (!bearerToken || !productId) {
    return {
      async create() {
        throw new Error("Dodo checkout is not configured.");
      },
    };
  }

  const client = new DodoPayments({
    bearerToken,
    environment: env.DODO_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  });

  return {
    async create({ auditId }) {
      const returnUrl = `${publicUrl}/#/audit/${encodeURIComponent(auditId)}`;
      const session = await client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        return_url: returnUrl,
        cancel_url: returnUrl,
        metadata: { auditId },
      });
      if (!session.checkout_url) throw new Error("Dodo did not return a checkout URL.");
      return { checkoutUrl: session.checkout_url, paymentId: session.payment_id ?? session.session_id };
    },
  };
}
