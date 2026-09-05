import assert from "node:assert/strict";
import test from "node:test";
import type { ImageGateway } from "../src/infrai_images.js";
import { OrderFulfillment } from "../src/order_fulfillment.js";

test("a paid checkout uploads once, hands that image to background removal, and becomes ready", async () => {
  const calls: string[] = [];
  const images: ImageGateway = {
    async upload(_file, filename) {
      calls.push(`upload:${filename}`);
      return "uploaded-image-reference";
    },
    async removeBackground(image) {
      calls.push(`remove:${image}`);
      return "transparent-product-image";
    }
  };

  const fulfillment = new OrderFulfillment(images);
  const result = await fulfillment.checkout({
    orderId: "order-1042",
    customerEmail: "studio@example.com",
    listingTitle: "Blue studio vase",
    paymentStatus: "paid",
    filename: "vase.jpg",
    imageBase64: Buffer.from("photo").toString("base64")
  });

  assert.equal(result.state, "ready");
  assert.equal(result.cutoutImage, "transparent-product-image");
  assert.deepEqual(calls, ["upload:vase.jpg", "remove:uploaded-image-reference"]);
  assert.deepEqual(result.receipt, {
    orderId: "order-1042",
    customerEmail: "studio@example.com",
    item: "Blue studio vase"
  });
});

test("a pending checkout waits without starting image fulfillment", async () => {
  const images: ImageGateway = {
    async upload() { throw new Error("unexpected upload"); },
    async removeBackground() { throw new Error("unexpected removal"); }
  };
  const fulfillment = new OrderFulfillment(images);
  const result = await fulfillment.checkout({
    orderId: "order-1043",
    customerEmail: "studio@example.com",
    listingTitle: "Blue studio vase",
    paymentStatus: "pending",
    filename: "vase.jpg",
    imageBase64: Buffer.from("photo").toString("base64")
  });

  assert.equal(result.state, "awaiting_payment");
  assert.equal(result.cutoutImage, undefined);
});
