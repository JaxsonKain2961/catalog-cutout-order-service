import { z } from "zod";
import type { ImageGateway } from "./infrai_images.js";

export const checkoutSchema = z.object({
  orderId: z.string().min(1).max(80),
  customerEmail: z.string().email(),
  listingTitle: z.string().min(1).max(160),
  paymentStatus: z.enum(["paid", "pending"]),
  filename: z.string().regex(/\.(png|jpe?g|webp)$/i),
  imageBase64: z.string().min(1)
}).strict();

export type Checkout = z.infer<typeof checkoutSchema>;
export type OrderState = "awaiting_payment" | "processing_image" | "ready";

export type OrderRecord = {
  orderId: string;
  state: OrderState;
  customerUpdate: string;
  receipt: { orderId: string; customerEmail: string; item: string };
  cutoutImage?: string;
};

export class OrderFulfillment {
  private readonly orders = new Map<string, OrderRecord>();
  private readonly images: ImageGateway;

  constructor(images: ImageGateway) {
    this.images = images;
  }

  async checkout(input: Checkout): Promise<OrderRecord> {
    const existing = this.orders.get(input.orderId);
    if (existing) return existing;

    const receipt = {
      orderId: input.orderId,
      customerEmail: input.customerEmail,
      item: input.listingTitle
    };

    if (input.paymentStatus === "pending") {
      const order: OrderRecord = {
        orderId: input.orderId,
        state: "awaiting_payment",
        customerUpdate: "Payment is pending; image fulfillment has not started.",
        receipt
      };
      this.orders.set(input.orderId, order);
      return order;
    }

    this.orders.set(input.orderId, {
      orderId: input.orderId,
      state: "processing_image",
      customerUpdate: "Payment received; the listing image is being prepared.",
      receipt
    });

    const bytes = Buffer.from(input.imageBase64, "base64");
    const uploaded = await this.images.upload(new Blob([bytes]), input.filename, input.orderId);
    const cutoutImage = await this.images.removeBackground(uploaded, input.orderId);
    const ready: OrderRecord = {
      orderId: input.orderId,
      state: "ready",
      customerUpdate: "Your transparent product image is ready.",
      receipt,
      cutoutImage
    };
    this.orders.set(input.orderId, ready);
    return ready;
  }

  find(orderId: string): OrderRecord | undefined {
    return this.orders.get(orderId);
  }
}
