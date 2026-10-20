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
    parentId: String,
    brand: String,
    dietary: [String],
    measure: Number,
    measureUnit: String,
    origin: String,
    nutrition: String,
    allergens: String,
    storage: String,
    imageUrl: String,
    seasonal: Boolean,
    active: Boolean,
    version: Number,
  },
  { timestamps: true },
);
const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    customer: { name: String, phone: String, address: String, area: String },
    items: [
      {
        productId: String,
        name: String,
        unit: String,
        atlas: Number,
        quantity: Number,
        price: Number,
      },
    ],
    subtotal: Number,
    discount: Number,
    delivery: Number,
    total: Number,
    payment: { type: String, default: "cash-on-delivery" },
    status: { type: String, default: "placed" },
    mode: String,
    deliverySelection: { date: String, slot: String },
    instructions: String,
    accessTokenHash: String,
    fingerprint: String,
  },
  { timestamps: true },
);
export const ProductModel =
  mongoose.models.Product || mongoose.model("Product", productSchema);
export const OrderModel =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
