import { sql } from "@vercel/postgres";

const setupPromise = (async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS inventory (
      part_number text PRIMARY KEY,
      description text NOT NULL,
      current_qty integer NOT NULL DEFAULT 0,
      min_qty integer NOT NULL DEFAULT 0,
      max_qty integer NOT NULL DEFAULT 0
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS order_queue (
      id serial PRIMARY KEY,
      part_number text NOT NULL REFERENCES inventory(part_number) ON DELETE CASCADE,
      description text NOT NULL,
      note text,
      status text NOT NULL CHECK (status IN ('open', 'sent', 'completed')) DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;

  await Promise.all([
    sql`
      INSERT INTO inventory (part_number, description, current_qty, min_qty, max_qty)
      VALUES ('WIDGET-100', 'Widget Frame', 18, 10, 40)
      ON CONFLICT (part_number) DO NOTHING;
    `,
    sql`
      INSERT INTO inventory (part_number, description, current_qty, min_qty, max_qty)
      VALUES ('BOLT-425', 'High-torque bolt', 6, 8, 25)
      ON CONFLICT (part_number) DO NOTHING;
    `,
  ]);
})();

function normalizeItem(body) {
  const part_number = String(body.part_number || "").trim();
  const description = String(body.description || "").trim();
  const current_qty = Number(body.current_qty);
  const min_qty = Number(body.min_qty);
  const max_qty = Number(body.max_qty);

  if (
    !part_number ||
    !description ||
    Number.isNaN(current_qty) ||
    Number.isNaN(min_qty) ||
    Number.isNaN(max_qty)
  ) {
    return {
      error: "part_number, description, current_qty, min_qty, and max_qty are required",
    };
  }

  return { part_number, description, current_qty, min_qty, max_qty };
}

async function fetchInventory() {
  const { rows } = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    ORDER BY part_number;
  `;
  return rows;
}

async function fetchOrderQueue() {
  const { rows } = await sql`
    SELECT id, part_number, description, note, status, created_at
    FROM order_queue
    WHERE status != 'completed'
    ORDER BY created_at ASC;
  `;
  return rows;
}

async function upsertItem(item) {
  await sql`
    INSERT INTO inventory (part_number, description, current_qty, min_qty, max_qty)
    VALUES (${item.part_number}, ${item.description}, ${item.current_qty}, ${item.min_qty}, ${item.max_qty})
    ON CONFLICT (part_number) DO UPDATE SET
      description = EXCLUDED.description,
      current_qty = EXCLUDED.current_qty,
      min_qty = EXCLUDED.min_qty,
      max_qty = EXCLUDED.max_qty;
  `;

  const { rows } = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    WHERE part_number = ${item.part_number}
    LIMIT 1;
  `;

  return rows[0];
}

async function consumeInventory(body) {
  const part_number = String(body.part_number || "").trim();
  const qty = Number(body.qty);
  if (!part_number || Number.isNaN(qty) || qty <= 0) {
    return { status: 400, error: "Valid part_number and qty are required" };
  }

  const tfiTicket = String(body.tfiTicket || "").trim();
  if (!tfiTicket) {
    return { status: 400, error: "TFI Ticket # is required to consume inventory." };
  }

  const note =
    String(body.note || "").trim() ||
    `Hit minimum after consuming ${qty} (Ticket #${tfiTicket}).`;

  const { rows } = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    WHERE part_number = ${part_number}
    LIMIT 1;
  `;

  const item = rows[0];
  if (!item) {
    return { status: 404, error: "Item not found" };
  }

  const newQty = Math.max(0, Number(item.current_qty) - qty);
  await sql`
    UPDATE inventory
    SET current_qty = ${newQty}
    WHERE part_number = ${part_number};
  `;

  let createdOrder = null;
  if (newQty <= Number(item.min_qty)) {
    const existing = await sql`
      SELECT id FROM order_queue
      WHERE part_number = ${part_number} AND status != 'completed'
      LIMIT 1;
    `;

    if (existing.rowCount === 0) {
      const inserted = await sql`
        INSERT INTO order_queue (part_number, description, note, status)
        VALUES (${part_number}, ${item.description}, ${note}, 'open')
        RETURNING id, part_number, description, note, status, created_at;
      `;
      createdOrder = inserted.rows[0];
    }
  }

  return {
    item: { ...item, current_qty: newQty },
    createdOrder,
  };
}

async function receiveInventory(body) {
  const part_number = String(body.part_number || "").trim();
  const qty = Number(body.qty);
  if (!part_number || Number.isNaN(qty) || qty <= 0) {
    return { status: 400, error: "Valid part_number and qty are required" };
  }

  const { rows } = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    WHERE part_number = ${part_number}
    LIMIT 1;
  `;

  const item = rows[0];
  if (!item) {
    return { status: 404, error: "Item not found" };
  }

  const sentOrders = await sql`
    SELECT id FROM order_queue
    WHERE part_number = ${part_number} AND status = 'sent'
    LIMIT 1;
  `;

  if (sentOrders.rowCount === 0) {
    return {
      status: 400,
      error: "Shipping clerk must send an order before receiving this item.",
    };
  }

  const newQty = Number(item.current_qty) + qty;

  const updatedItemResult = await sql`
    UPDATE inventory
    SET current_qty = ${newQty}
    WHERE part_number = ${part_number}
    RETURNING part_number, description, current_qty, min_qty, max_qty;
  `;

  await sql`
    UPDATE order_queue
    SET status = 'completed'
    WHERE part_number = ${part_number} AND status = 'sent';
  `;

  return {
    item: updatedItemResult.rows[0],
  };
}

async function sendOrder(part_number) {
  const trimmed = String(part_number || "").trim();
  if (!trimmed) {
    return { status: 400, error: "part_number is required" };
  }

  const { rows } = await sql`
    UPDATE order_queue
    SET status = 'sent'
    WHERE part_number = ${trimmed} AND status = 'open'
    RETURNING id, part_number, description, note, status, created_at;
  `;

  if (rows.length === 0) {
    return { status: 404, error: "No open order found for this part" };
  }

  return { order: rows[0] };
}

async function reorderToMax(part_number) {
  const trimmed = String(part_number || "").trim();
  if (!trimmed) {
    return { status: 400, error: "part_number is required" };
  }

  const { rows } = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    WHERE part_number = ${trimmed}
    LIMIT 1;
  `;

  const item = rows[0];
  if (!item) {
    return { status: 404, error: "Item not found" };
  }

  const updated = await sql`
    UPDATE inventory
    SET current_qty = max_qty
    WHERE part_number = ${trimmed}
    RETURNING part_number, description, current_qty, min_qty, max_qty;
  `;

  return { item: updated.rows[0] };
}

export default async function handler(req, res) {
  await setupPromise;
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const [inventory, orderQueue] = await Promise.all([
        fetchInventory(),
        fetchOrderQueue(),
      ]);
      return res.status(200).json({ inventory, orderQueue });
    }

    if (req.method === "POST") {
      const action = req.body?.action;

      if (action === "consume") {
        const result = await consumeInventory(req.body || {});
        if (result.error) {
          return res.status(result.status || 400).json({ error: result.error });
        }
        const orderQueue = await fetchOrderQueue();
        return res.status(200).json({ success: true, item: result.item, orderQueue });
      }

      if (action === "receive") {
        const result = await receiveInventory(req.body || {});
        if (result.error) {
          return res.status(result.status || 400).json({ error: result.error });
        }
        const orderQueue = await fetchOrderQueue();
        return res.status(200).json({ success: true, item: result.item, orderQueue });
      }

      if (action === "send_order") {
        const result = await sendOrder(req.body?.part_number);
        if (result.error) {
          return res.status(result.status || 400).json({ error: result.error });
        }
        const orderQueue = await fetchOrderQueue();
        return res.status(200).json({ success: true, order: result.order, orderQueue });
      }

      const parsed = normalizeItem(req.body || {});
      if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
      }

      const item = await upsertItem(parsed);
      const orderQueue = await fetchOrderQueue();
      return res.status(200).json({ success: true, item, orderQueue });
    }

    if (req.method === "PATCH") {
      const { part_number } = req.body || {};
      const result = await reorderToMax(part_number);
      if (result.error) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      return res.status(200).json({ success: true, item: result.item });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
