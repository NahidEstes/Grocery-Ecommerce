import mongoose from "mongoose";
const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: String,
    unit: String,
    price: { type: Number, min: 0, required: true },
    originalPrice: Number,
    atlas: Number,
    stock: { type: Number, min: 0 },
    description: String,
    organic: Boolean,
    rating: Number,
  },
  { timestamps: true },
);
const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    customer: { name: String, phone: String, address: String, area: String },
    items: [
      { productId: String, name: String, quantity: Number, price: Number },
    ],
    subtotal: Number,
    discount: Number,
    delivery: Number,
    total: Number,
    payment: { type: String, default: "cash-on-delivery" },
    status: { type: String, default: "placed" },
  },
  { timestamps: true },
);
export const ProductModel =
  mongoose.models.Product || mongoose.model("Product", productSchema);
export const OrderModel =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
