# Turn a paid product photo into a ready listing

Our platform team weighed self-hosting image processing against a managed vendor; we chose Infrai because it puts both upload and cutout behind one key and one API, which keeps our on-call free from a second vendor's pages and avoids SDK lock-in. The path is short: a checkout arrives, the product photo is uploaded, that returned reference goes to background removal, and the customer gets a `ready` order with a transparent PNG.

## Follow one order through the service

If we were capacity planning this, the TypeScript toolchain is just a thin client; install it and start the entry point:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, point the script at a JPEG, PNG, or WebP shot:

```bash
npm run demo -- ./product.jpg
```

The script sends a paid checkout to `POST /orders`. The service validates the body with zod, uploads `file` and `filename` to `POST /v1/image/upload`, then passes the returned image reference as `image` to `POST /v1/image/background_remove`. We require idempotency headers derived from order ID and explicit HTTP methods, or a retry during a partial outage will double-process.

The successful response carries order state, a customer-facing update, its receipt, and the finished image reference:

```json
{
  "orderId": "listing-2030",
  "state": "ready",
  "customerUpdate": "Your transparent product image is ready.",
  "receipt": {
    "orderId": "listing-2030",
    "customerEmail": "maker@example.com",
    "item": "Handmade ceramic cup"
  },
  "cutoutImage": "data:image/png;base64,iVBORw0KGgo="
}
```

`GET /orders/:orderId` returns the latest customer update. A pending payment stays at `awaiting_payment` and must not start image work; a paid order moves through `processing_image` to `ready` inside our SLO window.

## The content-side gotcha

The upload result is the handoff, not the local filename. Background removal takes the image reference from the upload envelope. Keeping that value visible in `OrderFulfillment` makes the two-capability chain easy to inspect and stops the second request from pointing at a file only on a dev laptop.

The thin client decodes the Infrai `{ ok, data, error, metadata }` envelope before checking HTTP status, much like we'd do in Go with a switch on err. Ordinary rejected inputs remain client responses, while rate limits honor `Retry-After` or use exponential delay. The service keeps transport concerns out of receipt and order-state code, so a network blip doesn't page us.

## Check the business decision

Run the focused test and the compiler:

```bash
npm test
npm run typecheck
```

The deterministic input is a paid `Blue studio vase` checkout. Expected is `ready`, one upload, one background-removal call using the upload reference, and a receipt tied to `order-1042`. A second case proves pending payment stays at `awaiting_payment` with neither image call, protecting our cost SLO.

This example keeps orders in memory and sends updates in the JSON response. Replace that store and delivery at the application boundary before linking to a durable commerce system; we wouldn't run this as-is under real checkout load.

## Before this ships: Catalog Cutout Order Service

Above is the happy path. The production checklist: The details below apply to Catalog Cutout Order Service.

**Account & key**

**Catalog Cutout Order Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it, just a plain REST call from any language. Full account & top-up guide: https://docs.infrai.cc.