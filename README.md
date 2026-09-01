# MetaRoom3D — PayPal Subscriptions Worker

Replaces the old PayHere worker. PayPal owns the recurring charging, retries
and cancellations; this Worker owns the plan definitions and keeps a record of
who is subscribed.

Nothing secret touches the browser. `checkout.html` only knows the Worker URL.

## What the endpoints do

| Endpoint | Called by | Purpose |
| --- | --- | --- |
| `GET /config` | `checkout.html` on load | Returns the public client ID, the environment, and the live plan IDs |
| `POST /admin/sync-plans` | You, once at setup | Creates the catalog products and billing plans inside PayPal |
| `GET /admin/plans` | You, debugging | Shows what's stored in KV |
| `POST /webhook` | PayPal's servers | Signature-verified subscription events — the only thing that marks anyone as paid |
| `GET /subscription?id=I-…` | Anything | Read-only status lookup |

## 1. PayPal account setup

1. You need a **Business** account. Sri Lankan accounts can now receive, but
   only cross-border — link it to a partner bank (Sampath / Commercial /
   HNB) first or incoming payments fail. All plan pricing here is USD, so
   your buyers will be overseas anyway.
2. At https://developer.paypal.com/dashboard, create an app under **Apps &
   Credentials**. Do this twice: once on the Sandbox tab, once on Live.
   Each gives you a **Client ID** and **Secret**.
3. Before you spend time on the live side, confirm **Pay & Get Paid →
   Subscriptions** actually appears in your business dashboard. Some
   subscription tooling is gated per market, and it's better to find that
   out now than after everything is wired.

## 2. Create the KV namespace

```bash
cd paypal-worker
npm install -g wrangler        # if you don't have it
wrangler login

wrangler kv namespace create SUBS
wrangler kv namespace create SUBS --env production
```

Paste the two IDs it prints into `wrangler.toml`, replacing
`PASTE_SANDBOX_KV_ID_HERE` and `PASTE_LIVE_KV_ID_HERE`.

## 3. Secrets and deploy (sandbox first)

```bash
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET
wrangler secret put ADMIN_TOKEN         # any long random string you invent
wrangler secret put WEB3FORMS_KEY       # optional, same key submit.html uses
wrangler deploy
```

Wrangler prints a URL like
`https://metaroom3d-paypal.YOUR-SUBDOMAIN.workers.dev`. Put it in the
`WORKER_URL` constant near the bottom of `checkout.html`.

`PAYPAL_WEBHOOK_ID` comes in the next step — deploy without it for now.

## 4. Create the plans in PayPal

```bash
curl -X POST https://metaroom3d-paypal.YOUR-SUBDOMAIN.workers.dev/admin/sync-plans \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN"
```

This creates two catalog products (Room Layout Editor, Sphere) and ten
billing plans — monthly and annual for each of the five paid tiers — then
stores the IDs in KV. It's idempotent: run it again and it skips anything
that already exists. Personal (free trial) and Enterprise (custom) are
deliberately not in the catalog; those still route to the contact form.

**Changing a price later:** edit `PLAN_CATALOG` in `src/index.js`, bump that
plan's `revision` string, and re-run the sync. PayPal won't let you rewrite
the price of a plan people are already on, so this creates a fresh plan.
Existing subscribers keep paying the old rate until they resubscribe — which
is the behaviour you want, and also the behaviour consumer law in most of
your buyers' countries expects.

## 5. Webhooks

In the developer dashboard, under your app, add a webhook pointing at
`https://metaroom3d-paypal.YOUR-SUBDOMAIN.workers.dev/webhook` and subscribe
to:

- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`

Copy the **Webhook ID** it generates, then:

```bash
wrangler secret put PAYPAL_WEBHOOK_ID
wrangler deploy
```

Without this the Worker rejects every webhook as unverified, which is the
correct failure direction but means nothing gets recorded.

## 6. Test in sandbox

1. Open `checkout.html?plan=professional` against the sandbox Worker. An
   orange "sandbox mode" strip should appear above the plan.
2. Use a sandbox personal account from **Testing Tools → Sandbox Accounts**
   to subscribe.
3. Run `wrangler tail` and watch for `webhook: BILLING.SUBSCRIPTION.ACTIVATED`.
4. Check the record landed:

```bash
wrangler kv key list --binding SUBS
wrangler kv key get "sub:I-XXXXXXXX" --binding SUBS
```

## 7. Go live

```bash
wrangler secret put PAYPAL_CLIENT_ID --env production
wrangler secret put PAYPAL_CLIENT_SECRET --env production
wrangler secret put PAYPAL_WEBHOOK_ID --env production
wrangler secret put ADMIN_TOKEN --env production
wrangler secret put WEB3FORMS_KEY --env production
wrangler deploy --env production
```

Then re-run `/admin/sync-plans` against the production Worker — sandbox plan
IDs are meaningless in live — register a live webhook, and point
`WORKER_URL` in `checkout.html` at the production URL.

## What's stored in KV

- `paypal:token` — cached OAuth token, expires itself
- `catalog:products`, `catalog:plans` — the IDs created by the sync
- `sub:I-XXXX` — one JSON record per subscription: status, plan key, period,
  subscriber email and name, last payment, failure count
- `email:someone@example.com` → subscription ID

That email index exists so the licence side can answer "does this address
have an active subscription?" in one read. Wiring `metaroom3d-license-api`
to issue and revoke keys off `BILLING.SUBSCRIPTION.ACTIVATED` and
`.CANCELLED` is the obvious next step, and this Worker is shaped for it.

## Notes

- Currency is USD only. A plan is single-currency in PayPal, so offering LKR
  would mean a parallel set of plans.
- `checkout.html` shows the success panel as soon as PayPal approves, but the
  webhook is what actually grants the licence. Don't move licence issuance
  into the browser.
- The old PayHere files (`index.js`, the PayHere `wrangler.toml`) can be
  deleted once this is live. If you ever want LKR cards back for local
  buyers, PayHere can return alongside rather than instead — the checkout
  page is structured to allow a second button.
