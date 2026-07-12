import DodoPayments from "dodopayments";

export type CheckoutGateway = {
  create(input: { auditId: string }): Promise<{ checkoutUrl: string; paymentId: string }>;
  findSucceededPayment(auditId: string): Promise<string | null>;
};

export type DodoPaymentEvent = { type: string; data: { payment_id?: string; metadata?: Record<string, string>; product_cart?: Array<{ product_id: string; quantity: number }> | null; total_amount?: number; currency?: string; status?: string | null } };
export type DodoWebhookVerifier = {
  unwrap(body: string, headers: Record<string, string>): DodoPaymentEvent;
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
      async findSucceededPayment() { return null; },
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
    async findSucceededPayment(auditId) {
      for await (const payment of client.payments.list()) {
        if (payment.status === "succeeded" && payment.metadata?.auditId === auditId) return payment.payment_id;
      }
      return null;
    },
  };
}

export function createDodoWebhookVerifier(env: NodeJS.ProcessEnv = process.env): DodoWebhookVerifier {
  const webhookKey = env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!webhookKey) return { unwrap() { throw new Error("Dodo webhook is not configured."); } };
  const client = new DodoPayments({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    webhookKey,
    environment: env.DODO_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  });
  return { unwrap(body, headers) { return client.webhooks.unwrap(body, { headers }) as DodoPaymentEvent; } };
}

export function assertExpectedDodoPayment(event: DodoPaymentEvent, env: NodeJS.ProcessEnv = process.env) {
  const productId = env.DODO_PRODUCT_ID;
  if (!productId || !event.data.product_cart?.some((item) => item.product_id === productId && item.quantity === 1)) throw new Error("Dodo payment product does not match checkout.");
  if (env.DODO_EXPECTED_CURRENCY && event.data.currency !== env.DODO_EXPECTED_CURRENCY) throw new Error("Dodo payment currency does not match checkout.");
  if (env.DODO_EXPECTED_AMOUNT && event.data.total_amount !== Number(env.DODO_EXPECTED_AMOUNT)) throw new Error("Dodo payment amount does not match checkout.");
  if (event.data.status && event.data.status !== "succeeded") throw new Error("Dodo payment is not succeeded.");
}
