// MetaRoom3D — PayPal Subscriptions backend (Cloudflare Worker)
//
// Replaces the old PayHere worker. PayPal does the recurring charging;
// this Worker owns the plan definitions and records what PayPal tells it.
//
//   GET  /config          -> client_id, env and the live plan IDs.
//                            checkout.html calls this on page load.
//   POST /admin/sync-plans-> creates/updates the catalog products and
//                            billing plans in PayPal. Run once at setup,
//                            and again whenever you change PLAN_CATALOG.
//                            Protected by the ADMIN_TOKEN secret.
//   GET  /admin/plans     -> what's currently stored in KV (debugging).
//   POST /webhook         -> PayPal calls this. Signature-verified, then
//                            written to KV as the source of truth for
//                            who has an active subscription.
//   GET  /subscription    -> ?id=I-XXXX, read-only status lookup.
//
// Setup:
//   wrangler secret put PAYPAL_CLIENT_ID
//   wrangler secret put PAYPAL_CLIENT_SECRET
//   wrangler secret put PAYPAL_WEBHOOK_ID
//   wrangler secret put ADMIN_TOKEN
//   wrangler secret put WEB3FORMS_KEY     (optional — email per event)
//   wrangler deploy

// ---------------------------------------------------------------------------
// Plan catalog — the single source of truth for what you sell.
//
// Edit prices here, then re-run /admin/sync-plans. PayPal will not let you
// change the price of an existing plan arbitrarily, so a price change means
// a new plan: bump the `revision` string and existing subscribers stay on
// their old plan while new buyers get the new one.
// ---------------------------------------------------------------------------
const PLAN_CATALOG = {
  professional: {
    product: "roomlayout",
    name: "MetaRoom3D Professional",
    description: "Unlimited projects, GLB export, high-quality rendering",
    revision: "v1",
    monthly: 19,
    annual: 190,
  },
  studio: {
    product: "roomlayout",
    name: "MetaRoom3D Studio",
    description: "Path Tracer and BDPT rendering, team seats",
    revision: "v1",
    monthly: 49,
    annual: 490,
  },
  "sphere-personal": {
    product: "sphere",
    name: "MetaRoom3D Sphere Personal",
    description: "Chrome-ball merge, projection and seam correction, 4K export",
    revision: "v1",
    monthly: 9,
    annual: 90,
  },
  "sphere-professional": {
    product: "sphere",
    name: "MetaRoom3D Sphere Professional",
    description: "Full 8K/16K HDRI delivery",
    revision: "v1",
    monthly: 19,
    annual: 190,
  },
  "sphere-studio": {
    product: "sphere",
    name: "MetaRoom3D Sphere Studio",
    description: "Scene-linear EXR, ACES transforms, OCIO configs and look LUTs",
    revision: "v1",
    monthly: 49,
    annual: 490,
  },
};

const PRODUCT_CATALOG = {
  roomlayout: {
    name: "MetaRoom3D Room Layout Editor",
    description: "Desktop software that turns 360 panoramas into 3D room models",
    type: "SERVICE",
    category: "SOFTWARE",
  },
  sphere: {
    name: "MetaRoom3D Sphere",
    description: "Chrome-ball to equirectangular HDRI production software",
    type: "SERVICE",
    category: "SOFTWARE",
  },
};

const CURRENCY = "USD";

const ALLOWED_ORIGINS = [
  "https://metaroom3d.com",
  "https://www.metaroom3d.com",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function apiBase(env) {
  return env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    Vary: "Origin",
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

// PayPal tokens last ~9 hours. Cache in KV so we're not doing an OAuth
// round-trip on every single request.
async function getAccessToken(env) {
  const cached = await env.SUBS.get("paypal:token");
  if (cached) return cached;

  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${apiBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  // Expire our copy a minute early so we never hand out a token mid-death.
  await env.SUBS.put("paypal:token", data.access_token, {
    expirationTtl: Math.max(60, (data.expires_in || 32400) - 60),
  });
  return data.access_token;
}

async function paypal(env, path, { method = "GET", body, requestId } = {}) {
  const token = await getAccessToken(env);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // PayPal-Request-Id makes creates idempotent — a retried sync won't
  // silently produce a second copy of the same plan.
  if (requestId) headers["PayPal-Request-Id"] = requestId;

  const res = await fetch(`${apiBase(env)}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`PayPal ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.detail = parsed;
    throw err;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// /config — everything checkout.html needs to render buttons
// ---------------------------------------------------------------------------
async function handleConfig(request, env) {
  const stored = await env.SUBS.get("catalog:plans", { type: "json" });
  return json(request, {
    env: env.PAYPAL_ENV === "live" ? "live" : "sandbox",
    client_id: env.PAYPAL_CLIENT_ID,
    currency: CURRENCY,
    plans: stored || {},
  });
}

// ---------------------------------------------------------------------------
// /admin/sync-plans — create products and billing plans in PayPal
// ---------------------------------------------------------------------------
function billingPlanBody(productId, planKey, cfg, period) {
  const isAnnual = period === "annual";
  const price = isAnnual ? cfg.annual : cfg.monthly;

  return {
    product_id: productId,
    name: `${cfg.name} — ${isAnnual ? "Annual" : "Monthly"}`,
    description: cfg.description,
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: {
          interval_unit: isAnnual ? "YEAR" : "MONTH",
          interval_count: 1,
        },
        tenure_type: "REGULAR",
        sequence: 1,
        // 0 = bill forever until the subscriber cancels.
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: price.toFixed(2), currency_code: CURRENCY },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: "0.00", currency_code: CURRENCY },
      setup_fee_failure_action: "CONTINUE",
      // PayPal retries a failed payment 3 times before suspending.
      payment_failure_threshold: 3,
    },
  };
}

async function handleSyncPlans(request, env) {
  if (request.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
    return json(request, { error: "unauthorized" }, 401);
  }

  const mode = env.PAYPAL_ENV === "live" ? "live" : "sandbox";
  const products = (await env.SUBS.get("catalog:products", { type: "json" })) || {};
  const plans = (await env.SUBS.get("catalog:plans", { type: "json" })) || {};
  const log = [];

  // 1. Products
  for (const [key, p] of Object.entries(PRODUCT_CATALOG)) {
    if (products[key]) {
      log.push(`product ${key}: already ${products[key]}`);
      continue;
    }
    const created = await paypal(env, "/v1/catalogs/products", {
      method: "POST",
      requestId: `${mode}-product-${key}`,
      body: {
        name: p.name,
        description: p.description,
        type: p.type,
        category: p.category,
        home_url: "https://metaroom3d.com",
      },
    });
    products[key] = created.id;
    log.push(`product ${key}: created ${created.id}`);
  }
  await env.SUBS.put("catalog:products", JSON.stringify(products));

  // 2. Plans
  for (const [planKey, cfg] of Object.entries(PLAN_CATALOG)) {
    plans[planKey] = plans[planKey] || {};
    for (const period of ["monthly", "annual"]) {
      const stamp = `${cfg.revision}-${period}`;
      if (plans[planKey][period] && plans[planKey][`${period}_revision`] === stamp) {
        log.push(`plan ${planKey}/${period}: already ${plans[planKey][period]}`);
        continue;
      }
      const created = await paypal(env, "/v1/billing/plans", {
        method: "POST",
        requestId: `${mode}-plan-${planKey}-${stamp}`,
        body: billingPlanBody(products[cfg.product], planKey, cfg, period),
      });
      plans[planKey][period] = created.id;
      plans[planKey][`${period}_revision`] = stamp;
      plans[planKey][`${period}_price`] = (period === "annual" ? cfg.annual : cfg.monthly).toFixed(2);
      log.push(`plan ${planKey}/${period}: created ${created.id}`);
    }
  }
  await env.SUBS.put("catalog:plans", JSON.stringify(plans));

  return json(request, { env: mode, products, plans, log });
}

// ---------------------------------------------------------------------------
// /webhook — the only thing that should ever mark someone as paid
// ---------------------------------------------------------------------------
async function verifyWebhook(env, request, rawBody) {
  const body = {
    auth_algo: request.headers.get("paypal-auth-algo"),
    cert_url: request.headers.get("paypal-cert-url"),
    transmission_id: request.headers.get("paypal-transmission-id"),
    transmission_sig: request.headers.get("paypal-transmission-sig"),
    transmission_time: request.headers.get("paypal-transmission-time"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: JSON.parse(rawBody),
  };

  const result = await paypal(env, "/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body,
  });
  return result.verification_status === "SUCCESS";
}

async function notifyByEmail(env, subject, lines) {
  if (!env.WEB3FORMS_KEY) return;
  try {
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: env.WEB3FORMS_KEY,
        subject,
        from_name: "MetaRoom3D Billing",
        message: lines.join("\n"),
      }),
    });
  } catch (e) {
    console.log("email notify failed:", e.message);
  }
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();

  let verified = false;
  try {
    verified = await verifyWebhook(env, request, rawBody);
  } catch (e) {
    console.log("verify call failed:", e.message);
  }
  if (!verified) {
    // Unverified means it did not come from PayPal. Never act on it.
    console.log("REJECTED unverified webhook");
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const type = event.event_type;
  const r = event.resource || {};
  const subId = r.id || r.billing_agreement_id || null;

  console.log("webhook:", type, subId);

  if (subId && subId.startsWith("I-")) {
    const key = `sub:${subId}`;
    const existing = (await env.SUBS.get(key, { type: "json" })) || {};

    // custom_id is set by checkout.html as "<planKey>:<period>".
    const custom = r.custom_id || existing.custom_id || "";
    const [planKey, period] = custom.split(":");

    const record = {
      ...existing,
      subscription_id: subId,
      plan_id: r.plan_id || existing.plan_id || null,
      custom_id: custom || null,
      plan_key: planKey || existing.plan_key || null,
      period: period || existing.period || null,
      email:
        (r.subscriber && r.subscriber.email_address) || existing.email || null,
      name:
        (r.subscriber &&
          r.subscriber.name &&
          [r.subscriber.name.given_name, r.subscriber.name.surname]
            .filter(Boolean)
            .join(" ")) ||
        existing.name ||
        null,
      status: r.status || existing.status || null,
      last_event: type,
      updated_at: new Date().toISOString(),
    };

    switch (type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        record.status = "ACTIVE";
        record.activated_at = record.activated_at || record.updated_at;
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
        record.status = "CANCELLED";
        record.cancelled_at = record.updated_at;
        break;
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        record.status = "SUSPENDED";
        break;
      case "BILLING.SUBSCRIPTION.EXPIRED":
        record.status = "EXPIRED";
        break;
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        record.payment_failures = (existing.payment_failures || 0) + 1;
        break;
      default:
        break;
    }

    await env.SUBS.put(key, JSON.stringify(record));

    // Second index so you can answer "does this customer have a licence?"
    // by email — which is what the licence API will want to ask.
    if (record.email) {
      await env.SUBS.put(`email:${record.email.toLowerCase()}`, subId);
    }

    if (type === "BILLING.SUBSCRIPTION.ACTIVATED") {
      await notifyByEmail(env, `New subscription: ${record.plan_key || "unknown plan"}`, [
        `Plan: ${record.plan_key} (${record.period})`,
        `Subscriber: ${record.name || "—"} <${record.email || "—"}>`,
        `Subscription ID: ${subId}`,
      ]);
    }
    if (type === "BILLING.SUBSCRIPTION.CANCELLED") {
      await notifyByEmail(env, `Cancelled: ${record.plan_key || "unknown plan"}`, [
        `Subscriber: ${record.email || "—"}`,
        `Subscription ID: ${subId}`,
      ]);
    }
  }

  // Payment events carry the money, not the subscription state.
  if (type === "PAYMENT.SALE.COMPLETED" && r.billing_agreement_id) {
    const key = `sub:${r.billing_agreement_id}`;
    const existing = (await env.SUBS.get(key, { type: "json" })) || {};
    existing.last_payment = {
      id: r.id,
      amount: r.amount && r.amount.total,
      currency: r.amount && r.amount.currency,
      at: new Date().toISOString(),
    };
    existing.payment_failures = 0;
    await env.SUBS.put(key, JSON.stringify(existing));
  }

  return new Response("OK", { status: 200 });
}

// ---------------------------------------------------------------------------
// /subscription?id=I-XXXX
// ---------------------------------------------------------------------------
async function handleSubscriptionLookup(request, env) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id.startsWith("I-")) return json(request, { error: "bad id" }, 400);

  const stored = await env.SUBS.get(`sub:${id}`, { type: "json" });
  if (stored) {
    return json(request, {
      subscription_id: id,
      status: stored.status,
      plan_key: stored.plan_key,
      period: stored.period,
    });
  }

  // Not in KV yet — the webhook may still be in flight. Ask PayPal directly.
  try {
    const live = await paypal(env, `/v1/billing/subscriptions/${id}`);
    return json(request, {
      subscription_id: id,
      status: live.status,
      plan_key: (live.custom_id || "").split(":")[0] || null,
      period: (live.custom_id || "").split(":")[1] || null,
      source: "paypal",
    });
  } catch (e) {
    return json(request, { error: "not found" }, 404);
  }
}

// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    try {
      if (url.pathname === "/config" && request.method === "GET") {
        return handleConfig(request, env);
      }
      if (url.pathname === "/admin/sync-plans" && request.method === "POST") {
        return handleSyncPlans(request, env);
      }
      if (url.pathname === "/admin/plans" && request.method === "GET") {
        if (request.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
          return json(request, { error: "unauthorized" }, 401);
        }
        return json(request, {
          products: await env.SUBS.get("catalog:products", { type: "json" }),
          plans: await env.SUBS.get("catalog:plans", { type: "json" }),
        });
      }
      if (url.pathname === "/webhook" && request.method === "POST") {
        return handleWebhook(request, env);
      }
      if (url.pathname === "/subscription" && request.method === "GET") {
        return handleSubscriptionLookup(request, env);
      }
    } catch (e) {
      console.log("error:", e.message, JSON.stringify(e.detail || null));
      return json(request, { error: e.message, detail: e.detail || null }, 500);
    }

    return new Response("Not found", { status: 404 });
  },
};
