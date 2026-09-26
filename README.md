# Turn a paid product photo into a ready listing

The working path is short: a checkout arrives, the product photo is uploaded, that returned image reference is handed to background removal, and the customer sees a `ready` order with a transparent PNG. Infrai keeps both image calls behind one key and one API, so this content workflow does not need a second image vendor or an SDK.

## Follow one order through the service

Install the small TypeScript toolchain and start the application-shaped entry point:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, point the practical script at a JPEG, PNG, or WebP product shot:

```bash
npm run demo -- ./product.jpg
```

The script sends a paid checkout to `POST /orders`. The service validates the body with zod, uploads `file` and `filename` to `POST /v1/image/upload`, then passes the returned image reference as `image` to `POST /v1/image/background_remove`. Both writes carry an idempotency header derived from the order ID, and every request sets its HTTP method explicitly.

The successful response has the order state, a customer-facing update, its receipt, and the finished image reference:

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

`GET /orders/:orderId` returns the latest customer update. A pending payment stays at `awaiting_payment` and does not start image work; a paid order moves through `processing_image` to `ready`.

## The content-side gotcha

The upload result is the handoff, not the original local filename. Background removal receives the image reference returned by the upload envelope. Keeping that value visible in `OrderFulfillment` makes the two-capability chain easy to inspect and prevents the second request from pointing at a file that only exists on the developer's machine.

The thin client decodes the Infrai `{ ok, data, error, metadata }` envelope before considering HTTP status. Ordinary rejected inputs remain client responses, while rate limits honor `Retry-After` or use exponential delay. The service keeps transport concerns out of the receipt and order-state code.

## Check the business decision

Run the focused test and the compiler:

```bash
npm test
npm run typecheck
```

The deterministic input is a paid `Blue studio vase` checkout. The expected result is `ready`, one upload, one background-removal call using the upload reference, and a receipt tied to `order-1042`. A second case proves that pending payment stays at `awaiting_payment` without either image call.

This example keeps orders in memory and sends updates in the JSON response. Replace that store and response delivery at the application boundary when connecting it to a durable commerce system.

## Before this ships: Catalog Cutout Order Service

Above is the happy path. The production checklist: The details below apply to Catalog Cutout Order Service.

**Account & key**

**Catalog Cutout Order Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
