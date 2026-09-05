import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, InfraiImages } from "./infrai_images.js";
import { checkoutSchema, OrderFulfillment } from "./order_fulfillment.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const fulfillment = new OrderFulfillment(new InfraiImages(apiKey));
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/orders") {
      const input = checkoutSchema.parse(await readJson(request));
      return send(response, 201, await fulfillment.checkout(input));
    }

    const match = request.url?.match(/^\/orders\/([^/]+)$/);
    if (request.method === "GET" && match) {
      const order = fulfillment.find(decodeURIComponent(match[1]));
      return order ? send(response, 200, order) : send(response, 404, { error: "Order not found" });
    }

    send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError) return send(response, 400, { error: "Invalid checkout", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.code, details: error.details });
    }
    send(response, 502, { error: "Image fulfillment could not be completed" });
  }
}).listen(port, () => console.log(`Order service listening on http://localhost:${port}`));

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
