import Stripe from "stripe";
import { fail, json, readJSON } from "./auth.mjs";
import { readLimited } from "./router.mjs";
export async function appleVerifier(env) {
  if (!env.APPLE_ROOT_CERTS_BASE64 || !env.APPLE_BUNDLE_ID)
    throw fail("PAYMENTS_NOT_CONFIGURED", 503);
  const { SignedDataVerifier, Environment } = await import(
    "@apple/app-store-server-library"
  );
  const roots = JSON.parse(env.APPLE_ROOT_CERTS_BASE64).map((value) =>
    Buffer.from(value, "base64"),
  );
  return new SignedDataVerifier(
    roots,
    true,
    env.APPLE_ENVIRONMENT === "Production"
      ? Environment.PRODUCTION
      : Environment.SANDBOX,
    env.APPLE_BUNDLE_ID,
    env.APPLE_APP_ID ? Number(env.APPLE_APP_ID) : undefined,
  );
}
export async function billingWebhook(request, env) {
  const path = new URL(request.url).pathname;
  if (path === "/api/webhooks/stripe") {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
      throw fail("PAYMENTS_NOT_CONFIGURED", 503);
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
    });
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        new TextDecoder().decode(await readLimited(request, 1048576)),
        request.headers.get("stripe-signature"),
        env.STRIPE_WEBHOOK_SECRET,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch {
      throw fail("INVALID_SIGNATURE");
    }
    let owner, paymentID, status;
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const session = await stripe.checkout.sessions.retrieve(
        event.data.object.id,
        { expand: ["line_items"] },
      );
      if (
        session.payment_status === "paid" &&
        session.mode === "payment" &&
        session.line_items?.data.length === 1 &&
        session.line_items.data[0].price?.id === env.STRIPE_PRICE_ID
      ) {
        owner = session.client_reference_id;
        paymentID = session.payment_intent;
        status = "paid";
      }
    } else if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.closed" ||
      (event.type === "charge.refunded" && event.data.object.refunded === true)
    ) {
      const object = event.data.object;
      paymentID = object.payment_intent;
      if (paymentID) {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentID,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session) {
          const details = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["line_items"],
          });
          if (
            details.line_items?.data.length === 1 &&
            details.line_items.data[0].price?.id === env.STRIPE_PRICE_ID
          )
            owner = details.client_reference_id;
        }
      }
      status =
        event.type === "charge.dispute.created"
          ? "disputed"
          : event.type === "charge.dispute.closed" && object.status === "won"
            ? "paid"
            : "revoked";
    }
    if (owner && paymentID && status) {
      const exists = await env.IDENTITY.prepare(
        "SELECT id FROM users WHERE id=?",
      )
        .bind(owner)
        .first();
      if (exists)
        await env.ACCOUNTS.getByName(owner).payment({
          eventID: "stripe:" + event.id,
          paymentID: "stripe:" + paymentID,
          account: owner,
          status,
          provider: "stripe",
          disputeResolved:
            event.type === "charge.dispute.closed" &&
            event.data.object.status === "won",
        });
    }
    return json({ received: true });
  }
  if (path === "/api/webhooks/apple") {
    const body = await readJSON(request);
    const verifier = await appleVerifier(env);
    let notification, tx;
    try {
      notification = await verifier.verifyAndDecodeNotification(
        body.signedPayload,
      );
      if (notification.data?.signedTransactionInfo)
        tx = await verifier.verifyAndDecodeTransaction(
          notification.data.signedTransactionInfo,
        );
    } catch {
      throw fail("INVALID_SIGNATURE");
    }
    const account = tx?.appAccountToken?.toLowerCase();
    if (tx && account && tx.originalTransactionId) {
      const exists = await env.IDENTITY.prepare(
        "SELECT id FROM users WHERE id=?",
      )
        .bind(account)
        .first();
      if (exists) {
        const stub = env.ACCOUNTS.getByName(account);
        if (
          tx.productId ===
          (env.APPLE_PRODUCT_ID || "ch.zhstudio.rankwisp.lifetime")
        )
          await stub.payment({
            eventID: "apple-notification:" + notification.notificationUUID,
            paymentID: "apple:" + tx.originalTransactionId,
            account,
            status: tx.revocationDate ? "revoked" : "paid",
            provider: "apple",
          });
        else if (
          tx.productId ===
          (env.APPLE_TRIAL_PRODUCT_ID || "ch.zhstudio.rankwisp.trial24")
        )
          await stub.trial({
            transactionID: tx.originalTransactionId,
            account,
            purchaseDate: tx.purchaseDate,
            revoked: !!tx.revocationDate,
          });
      }
    }
    return json({ received: true });
  }
  return null;
}
