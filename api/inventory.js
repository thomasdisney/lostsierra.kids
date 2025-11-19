let inventoryStore = [
  {
    part_number: "WIDGET-100",
    description: "Widget Frame",
    current_qty: 18,
    min_qty: 10,
    max_qty: 40,
  },
  {
    part_number: "BOLT-425",
    description: "High-torque bolt",
    current_qty: 6,
    min_qty: 8,
    max_qty: 25,
  },
];

function normalizeItem(body) {
  const part_number = String(body.part_number || "").trim();
  const description = String(body.description || "").trim();
  const current_qty = Number(body.current_qty);
  const min_qty = Number(body.min_qty);
  const max_qty = Number(body.max_qty);

  if (!part_number || !description || Number.isNaN(current_qty) || Number.isNaN(min_qty) || Number.isNaN(max_qty)) {
    return { error: "part_number, description, current_qty, min_qty, and max_qty are required" };
  }

  return { part_number, description, current_qty, min_qty, max_qty };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    return res.status(200).json(inventoryStore);
  }

  if (req.method === "POST") {
    const parsed = normalizeItem(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const existingIndex = inventoryStore.findIndex((item) => item.part_number === parsed.part_number);
    if (existingIndex >= 0) {
      inventoryStore[existingIndex] = { ...inventoryStore[existingIndex], ...parsed };
    } else {
      inventoryStore.push(parsed);
    }

    return res.status(200).json({ success: true, item: parsed });
  }

  if (req.method === "PATCH") {
    const { part_number } = req.body || {};
    const item = inventoryStore.find((entry) => entry.part_number === part_number);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    item.current_qty = item.max_qty;
    return res.status(200).json({ success: true, item });
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
