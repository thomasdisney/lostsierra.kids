import postgres from "postgres";
import crypto from "crypto";
import jwt from "jsonwebtoken";

ensureDatabaseConfigured();
const sql = postgres(process.env.DATABASE_URL, { ssl: "verify-full" });

function ensureDatabaseConfigured() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Please set it to your Postgres connection string."
    );
  }
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured. Please set it in your environment."
    );
  }
}

const setupPromise = (async () => {
  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      name text NOT NULL,
      role text NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
      created_at timestamptz NOT NULL DEFAULT now(),
      is_active boolean NOT NULL DEFAULT true
    );
  `;

  // Locations table
  await sql`
    CREATE TABLE IF NOT EXISTS locations (
      id serial PRIMARY KEY,
      name text NOT NULL,
      warehouse_code text UNIQUE NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;

  // User-Location junction table (many-to-many)
  await sql`
    CREATE TABLE IF NOT EXISTS user_locations (
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      location_id integer NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, location_id)
    );
  `;

  // Inventory table with location support
  await sql`
    CREATE TABLE IF NOT EXISTS inventory (
      part_number text NOT NULL,
      location_id integer NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      description text NOT NULL,
      current_qty integer NOT NULL DEFAULT 0,
      min_qty integer NOT NULL DEFAULT 0,
      max_qty integer NOT NULL DEFAULT 0,
      PRIMARY KEY (part_number, location_id)
    );
  `;

  // Order queue table with user and location tracking
  await sql`
    CREATE TABLE IF NOT EXISTS order_queue (
      id serial PRIMARY KEY,
      part_number text NOT NULL,
      location_id integer NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      description text NOT NULL,
      note text,
      request_type text NOT NULL CHECK (request_type IN ('restock', 'adjustment')) DEFAULT 'restock',
      requested_qty integer,
      status text NOT NULL CHECK (status IN ('open', 'sent', 'completed', 'pending', 'approved', 'denied')) DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;

  // Seed default admin user if none exists
  const adminCount = await sql`SELECT COUNT(*) as count FROM users WHERE role = 'admin';`;
  if (adminCount[0].count === 0) {
    const adminPassword = hashPassword("admin123");
    await sql`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('admin@wms.local', ${adminPassword}, 'Admin', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `;
  }

  // Seed default location if none exists
  const locationCount = await sql`SELECT COUNT(*) as count FROM locations;`;
  if (locationCount[0].count === 0) {
    await sql`
      INSERT INTO locations (name, warehouse_code)
      VALUES ('Main Warehouse', 'MAIN')
      ON CONFLICT (warehouse_code) DO NOTHING;
    `;
  }

  // Get the main location
  const mainLocation = await sql`SELECT id FROM locations WHERE warehouse_code = 'MAIN' LIMIT 1;`;
  const locationId = mainLocation[0]?.id || 1;

  // Seed sample inventory items at main location
  await Promise.all([
    sql`
      INSERT INTO inventory (part_number, location_id, description, current_qty, min_qty, max_qty)
      VALUES ('WIDGET-100', ${locationId}, 'Widget Frame', 18, 10, 40)
      ON CONFLICT (part_number, location_id) DO NOTHING;
    `,
    sql`
      INSERT INTO inventory (part_number, location_id, description, current_qty, min_qty, max_qty)
      VALUES ('BOLT-425', ${locationId}, 'High-torque bolt', 6, 8, 25)
      ON CONFLICT (part_number, location_id) DO NOTHING;
    `,
  ]);
})();

// Utility functions for authentication
function hashPassword(password) {
  return crypto.pbkdf2Sync(password, process.env.JWT_SECRET || "secret", 10000, 64, "sha256").toString("hex");
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

async function authenticateRequest(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await sql`SELECT id, email, name, role, is_active FROM users WHERE id = ${payload.id} LIMIT 1;`;
  return user[0] || null;
}

// Get user's assigned locations
async function getUserLocations(userId) {
  const locations = await sql`
    SELECT l.id, l.name, l.warehouse_code
    FROM locations l
    INNER JOIN user_locations ul ON l.id = ul.location_id
    WHERE ul.user_id = ${userId}
    ORDER BY l.name;
  `;
  return locations;
}

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
  const rows = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    ORDER BY part_number;
  `;
  return rows;
}

async function fetchOrderQueue() {
  const rows = await sql`
    SELECT id, part_number, description, note, status, request_type, requested_qty, created_at
    FROM order_queue
    WHERE status NOT IN ('completed', 'approved', 'denied')
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

  const rows = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    WHERE part_number = ${item.part_number}
    LIMIT 1;
  `;

  return rows[0];
}

async function renameItem(body) {
  const old_part_number = String(body.old_part_number || "").trim();
  const normalized = normalizeItem(body);

  if (!old_part_number) {
    return { status: 400, error: "old_part_number is required for renaming" };
  }

  if (normalized.error) {
    return { status: 400, error: normalized.error };
  }

  const existing = await sql`
    SELECT part_number FROM inventory WHERE part_number = ${old_part_number} LIMIT 1;
  `;

  if (existing.length === 0) {
    return { status: 404, error: "Original part not found" };
  }

  if (old_part_number !== normalized.part_number) {
    const conflict = await sql`
      SELECT part_number FROM inventory WHERE part_number = ${normalized.part_number} LIMIT 1;
    `;
    if (conflict.length > 0) {
      return { status: 409, error: "Another part already exists with that part number" };
    }
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO inventory (part_number, description, current_qty, min_qty, max_qty)
      VALUES (${normalized.part_number}, ${normalized.description}, ${normalized.current_qty}, ${normalized.min_qty}, ${normalized.max_qty});
    `;

    await tx`
      UPDATE order_queue
      SET part_number = ${normalized.part_number},
          description = ${normalized.description}
      WHERE part_number = ${old_part_number};
    `;

    await tx`
      DELETE FROM inventory
      WHERE part_number = ${old_part_number};
    `;
  });

  const rows = await sql`
    SELECT part_number, description, current_qty, min_qty, max_qty
    FROM inventory
    WHERE part_number = ${normalized.part_number}
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

  const rows = await sql`
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

    if (existing.length === 0) {
      const inserted = await sql`
        INSERT INTO order_queue (part_number, description, note, status, request_type)
        VALUES (${part_number}, ${item.description}, ${note}, 'open', 'restock')
        RETURNING id, part_number, description, note, status, request_type, requested_qty, created_at;
      `;
      createdOrder = inserted[0];
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

  const rows = await sql`
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

  if (sentOrders.length === 0) {
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
    item: updatedItemResult[0],
  };
}

async function requestAdjustment(body) {
  const part_number = String(body.part_number || "").trim();
  const requested_qty = Number(body.requested_qty);
  const reason = String(body.reason || "").trim();
  const request_type = String(body.request_type || "adjustment").trim();
  const normalizedRequestType = request_type === "restock" ? "restock" : "adjustment";

  if (!part_number || Number.isNaN(requested_qty)) {
    return {
      status: 400,
      error: "part_number and requested_qty are required",
    };
  }

  const rows = await sql`
    SELECT part_number, description, current_qty
    FROM inventory
    WHERE part_number = ${part_number}
    LIMIT 1;
  `;

  const item = rows[0];
  if (!item) {
    return { status: 404, error: "Item not found" };
  }

  const noteDetails = [`Requested quantity: ${requested_qty}`];
  if (reason) {
    noteDetails.push(`Reason: ${reason}`);
  }

  const inserted = await sql`
    INSERT INTO order_queue (part_number, description, note, status, request_type, requested_qty)
    VALUES (${part_number}, ${item.description}, ${noteDetails.join(" | ")}, ${
    normalizedRequestType === "restock" ? "open" : "pending"
  }, ${normalizedRequestType}, ${requested_qty})
    RETURNING id, part_number, description, note, status, request_type, requested_qty, created_at;
  `;

  return { order: inserted[0] };
}

async function sendOrder(part_number) {
  const trimmed = String(part_number || "").trim();
  if (!trimmed) {
    return { status: 400, error: "part_number is required" };
  }

  const rows = await sql`
    UPDATE order_queue
    SET status = 'sent'
    WHERE part_number = ${trimmed} AND status = 'open' AND request_type = 'restock'
    RETURNING id, part_number, description, note, status, request_type, requested_qty, created_at;
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

  const rows = await sql`
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

  return { item: updated[0] };
}

async function approveAdjustment(body) {
  const id = Number(body.id);
  if (!id) {
    return { status: 400, error: "Adjustment id is required" };
  }

  const rows = await sql`
    SELECT id, part_number, requested_qty
    FROM order_queue
    WHERE id = ${id} AND request_type = 'adjustment'
    LIMIT 1;
  `;

  const order = rows[0];
  if (!order) {
    return { status: 404, error: "Adjustment request not found" };
  }

  if (Number.isNaN(Number(order.requested_qty))) {
    return { status: 400, error: "Adjustment request is missing a quantity" };
  }

  const updated = await sql.begin(async (tx) => {
    const updatedInventory = await tx`
      UPDATE inventory
      SET current_qty = ${order.requested_qty}
      WHERE part_number = ${order.part_number}
      RETURNING part_number, description, current_qty, min_qty, max_qty;
    `;

    const updatedOrder = await tx`
      UPDATE order_queue
      SET status = 'approved'
      WHERE id = ${id}
      RETURNING id, part_number, description, note, status, request_type, requested_qty, created_at;
    `;

    return { inventory: updatedInventory[0], order: updatedOrder[0] };
  });

  return updated;
}

async function denyAdjustment(body) {
  const id = Number(body.id);
  const decision_note = String(body.decision_note || "").trim();

  if (!id) {
    return { status: 400, error: "Adjustment id is required" };
  }

  const rows = await sql`
    UPDATE order_queue
    SET status = 'denied', note = COALESCE(note, '') || ${
    decision_note ? ` | Decision: ${decision_note}` : ""
  }
    WHERE id = ${id} AND request_type = 'adjustment'
    RETURNING id, part_number, description, note, status, request_type, requested_qty, created_at;
  `;

  if (rows.length === 0) {
    return { status: 404, error: "Adjustment request not found" };
  }

  return { order: rows[0] };
}

// Authentication endpoints
async function handleLogin(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const users = await sql`SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = ${email} LIMIT 1;`;
  const user = users[0];

  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken(user);
  const locations = await getUserLocations(user.id);

  return res.status(200).json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, locations },
  });
}

async function handleMe(req, res) {
  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const locations = await getUserLocations(user.id);
  return res.status(200).json({ user: { ...user, locations } });
}

// Admin endpoints
async function handleAdminCreateUser(req, res) {
  const admin = await authenticateRequest(req);
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { email, password, name, role, locationIds } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password, and name are required" });
  }

  const userRole = role === "admin" ? "admin" : "user";
  const passwordHash = hashPassword(password);

  const newUser = await sql.begin(async (tx) => {
    const inserted = await tx`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (${email}, ${passwordHash}, ${name}, ${userRole})
      RETURNING id, email, name, role;
    `;

    if (locationIds && Array.isArray(locationIds) && locationIds.length > 0) {
      for (const locId of locationIds) {
        await tx`
          INSERT INTO user_locations (user_id, location_id)
          VALUES (${inserted[0].id}, ${locId})
          ON CONFLICT DO NOTHING;
        `;
      }
    }

    return inserted[0];
  });

  const locations = await getUserLocations(newUser.id);
  return res.status(201).json({ success: true, user: { ...newUser, locations } });
}

async function handleAdminListUsers(req, res) {
  const admin = await authenticateRequest(req);
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const users = await sql`SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at DESC;`;
  const usersWithLocations = await Promise.all(
    users.map(async (user) => ({
      ...user,
      locations: await getUserLocations(user.id),
    }))
  );

  return res.status(200).json({ users: usersWithLocations });
}

async function handleAdminUpdateUser(req, res) {
  const admin = await authenticateRequest(req);
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id, name, role, isActive, locationIds } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const updated = await sql.begin(async (tx) => {
    const userRole = role === "admin" ? "admin" : "user";
    const updated = await tx`
      UPDATE users
      SET name = COALESCE(${name}, name),
          role = COALESCE(${userRole}, role),
          is_active = COALESCE(${isActive}, is_active)
      WHERE id = ${id}
      RETURNING id, email, name, role, is_active;
    `;

    if (locationIds && Array.isArray(locationIds)) {
      await tx`DELETE FROM user_locations WHERE user_id = ${id};`;
      for (const locId of locationIds) {
        await tx`
          INSERT INTO user_locations (user_id, location_id)
          VALUES (${id}, ${locId})
          ON CONFLICT DO NOTHING;
        `;
      }
    }

    return updated[0];
  });

  const locations = await getUserLocations(updated.id);
  return res.status(200).json({ success: true, user: { ...updated, locations } });
}

async function handleAdminCreateLocation(req, res) {
  const admin = await authenticateRequest(req);
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { name, warehouseCode } = req.body || {};
  if (!name || !warehouseCode) {
    return res.status(400).json({ error: "Name and warehouse code are required" });
  }

  const location = await sql`
    INSERT INTO locations (name, warehouse_code)
    VALUES (${name}, ${warehouseCode})
    RETURNING id, name, warehouse_code, created_at;
  `;

  return res.status(201).json({ success: true, location: location[0] });
}

async function handleAdminListLocations(req, res) {
  const admin = await authenticateRequest(req);
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const locations = await sql`SELECT id, name, warehouse_code, created_at FROM locations ORDER BY name;`;
  return res.status(200).json({ locations });
}

export default async function handler(req, res) {
  await setupPromise;
  res.setHeader("Content-Type", "application/json");

  try {
    // Public auth endpoints
    if (req.path === "/api/auth/login" && req.method === "POST") {
      return handleLogin(req, res);
    }

    if (req.path === "/api/auth/me" && req.method === "GET") {
      return handleMe(req, res);
    }

    // Admin endpoints
    if (req.path === "/api/admin/users" && req.method === "POST") {
      return handleAdminCreateUser(req, res);
    }

    if (req.path === "/api/admin/users" && req.method === "GET") {
      return handleAdminListUsers(req, res);
    }

    if (req.path === "/api/admin/users" && req.method === "PATCH") {
      return handleAdminUpdateUser(req, res);
    }

    if (req.path === "/api/admin/locations" && req.method === "POST") {
      return handleAdminCreateLocation(req, res);
    }

    if (req.path === "/api/admin/locations" && req.method === "GET") {
      return handleAdminListLocations(req, res);
    }

    // Protected inventory endpoints - require authentication
    const user = await authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user's accessible locations
    const userLocs = await getUserLocations(user.id);
    if (user.role !== "admin" && userLocs.length === 0) {
      return res.status(403).json({ error: "No accessible locations assigned" });
    }

    if (req.method === "GET") {
      // Get inventory filtered by user's locations
      const locationIds = user.role === "admin"
        ? (await sql`SELECT id FROM locations;`).map(l => l.id)
        : userLocs.map(l => l.id);

      const inventory = await sql`
        SELECT part_number, location_id, description, current_qty, min_qty, max_qty
        FROM inventory
        WHERE location_id = ANY(${locationIds})
        ORDER BY part_number;
      `;

      const orderQueue = await sql`
        SELECT id, part_number, location_id, user_id, description, note, status, request_type, requested_qty, created_at
        FROM order_queue
        WHERE location_id = ANY(${locationIds}) AND status NOT IN ('completed', 'approved', 'denied')
        ORDER BY created_at ASC;
      `;

      return res.status(200).json({ inventory, orderQueue, user, locations: userLocs });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
