import assert from "node:assert/strict";
import test from "node:test";
import { assertExpectedDodoPayment } from "../../apps/local-server/src/dodo.ts";

const event = { type: "payment.succeeded", data: { payment_id: "pay_1", metadata: { auditId: "free_1" }, product_cart: [{ product_id: "prod_1", quantity: 1 }], total_amount: 500, currency: "USD", status: "succeeded" } };

test("PPAY-01 product, quantity, currency, amount, and status must match the configured checkout", () => {
  assert.doesNotThrow(() => assertExpectedDodoPayment(event, { DODO_PRODUCT_ID: "prod_1", DODO_EXPECTED_CURRENCY: "USD", DODO_EXPECTED_AMOUNT: "500" }));
  for (const altered of [
    { ...event, data: { ...event.data, product_cart: [{ product_id: "other", quantity: 1 }] } },
    { ...event, data: { ...event.data, product_cart: [{ product_id: "prod_1", quantity: 2 }] } },
    { ...event, data: { ...event.data, currency: "KRW" } },
    { ...event, data: { ...event.data, total_amount: 1 } },
    { ...event, data: { ...event.data, status: "failed" } },
  ]) assert.throws(() => assertExpectedDodoPayment(altered, { DODO_PRODUCT_ID: "prod_1", DODO_EXPECTED_CURRENCY: "USD", DODO_EXPECTED_AMOUNT: "500" }), /Dodo payment/);
});
