import { readFile } from "node:fs/promises";

const filename = process.argv[2];
if (!filename) throw new Error("Run with an image path, for example: npm run demo -- ./product.jpg");

const image = await readFile(filename);
const response = await fetch("http://localhost:3000/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: `listing-${Date.now()}`,
    customerEmail: "maker@example.com",
    listingTitle: "Handmade ceramic cup",
    paymentStatus: "paid",
    filename: filename.split("/").pop(),
    imageBase64: image.toString("base64")
  })
});

const result: unknown = await response.json();
console.log(JSON.stringify(result, null, 2));
