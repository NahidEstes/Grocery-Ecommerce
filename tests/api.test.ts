import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { app } from "../server/app";

test("Express API returns catalog data, validates input and rejects invalid orders", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(
    `${base}/api/products?category=produce&sort=price-asc&limit=4`,
  );
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.equal(catalog.total, 8);
  assert.equal(catalog.products[0].id, "cucumber");
  assert.equal((await fetch(`${base}/api/products?sort=invalid`)).status, 400);
  assert.equal((await fetch(`${base}/api/products/not-a-product`)).status, 404);
  const product = await (await fetch(`${base}/api/products/apple-fuji`)).json();
  assert.equal(product.product.price, 225);
  const post = (data: unknown) =>
    fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  assert.equal((await post({ customer: {}, items: [] })).status, 400);
  const customer = {
    name: "Test Shopper",
    phone: "01712345678",
    address: "Test address, Road 1, Dhaka",
    area: "Dhanmondi",
  };
  assert.equal(
    (
      await post({
        customer,
        items: [
          { productId: "banana", quantity: 30 },
          { productId: "banana", quantity: 1 },
        ],
      })
    ).status,
    409,
  );
  assert.equal(
    (await post({ customer, items: [{ productId: "missing", quantity: 1 }] }))
      .status,
    409,
  );
  assert.equal(
    (
      await post({
        customer,
        items: [{ productId: "banana", quantity: 1 }],
        promo: "INVALID",
      })
    ).status,
    400,
  );
  const submitted = await post({
    customer,
    items: ["banana", "apple", "milk", "bread"].map((productId) => ({
      productId,
      quantity: 1,
    })),
    promo: "FRESH10",
    total: 1,
  });
  assert.equal(submitted.status, 201);
  const order = await submitted.json();
  assert.equal(order.total, 454);
  assert.equal(order.mode, "demo");
  assert.match(order.reference, /^FC-[A-F0-9]{8}$/);
  const orderPath = join(
    process.cwd(),
    ".data",
    "orders",
    `${order.reference}.json`,
  );
  t.after(() => unlink(orderPath));
  const saved = JSON.parse(await readFile(orderPath, "utf8"));
  assert.equal(saved.total, 454);
  assert.equal(saved.items.length, 4);
  assert.equal(saved.status, "placed");
});
