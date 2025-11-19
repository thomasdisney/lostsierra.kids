import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function notifyClerk(item) {
  console.log(`Order part ${item.part_number} up to ${item.max_qty}`);
}

const initialFormState = {
  part_number: "",
  description: "",
  current_qty: "",
  min_qty: "",
  max_qty: "",
};

function ExampleWMS() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lowStockItems = useMemo(
    () => inventory.filter((item) => Number(item.current_qty) <= Number(item.min_qty)),
    [inventory]
  );

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    lowStockItems.forEach((item) => notifyClerk(item));
  }, [lowStockItems]);

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory");
      if (!response.ok) {
        throw new Error("Failed to load inventory");
      }
      const data = await response.json();
      setInventory(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      part_number: formData.part_number,
      description: formData.description,
      current_qty: Number(formData.current_qty),
      min_qty: Number(formData.min_qty),
      max_qty: Number(formData.max_qty),
    };

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Unable to save item");
      }

      await fetchInventory();
      setFormData(initialFormState);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reorderToMax = async (item) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_number: item.part_number }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Unable to reorder item");
      }

      await fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="text-sm text-blue-200 hover:text-white transition"
      >
        ← Back to home
      </button>
      <h1 className="text-3xl font-bold">Example Warehouse Management</h1>

      {lowStockItems.length > 0 && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-semibold">Low stock alert!</p>
          <ul className="list-disc list-inside">
            {lowStockItems.map((item) => (
              <li key={item.part_number}>
                {item.part_number} - current {item.current_qty}, min {item.min_qty}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="text-red-600">Error: {error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-100 p-4 rounded">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            name="part_number"
            placeholder="Part Number"
            value={formData.part_number}
            onChange={handleChange}
            className="p-2 border rounded"
            required
          />
          <input
            type="text"
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            className="p-2 border rounded"
            required
          />
          <input
            type="number"
            name="current_qty"
            placeholder="Current Qty"
            value={formData.current_qty}
            onChange={handleChange}
            className="p-2 border rounded"
            required
          />
          <input
            type="number"
            name="min_qty"
            placeholder="Min Qty"
            value={formData.min_qty}
            onChange={handleChange}
            className="p-2 border rounded"
            required
          />
          <input
            type="number"
            name="max_qty"
            placeholder="Max Qty"
            value={formData.max_qty}
            onChange={handleChange}
            className="p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Saving..." : "Add / Update Item"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Part Number</th>
              <th className="p-2 border">Description</th>
              <th className="p-2 border">Current Qty</th>
              <th className="p-2 border">Min Qty</th>
              <th className="p-2 border">Max Qty</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.part_number} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{item.part_number}</td>
                <td className="p-2 border">{item.description}</td>
                <td className="p-2 border">{item.current_qty}</td>
                <td className="p-2 border">{item.min_qty}</td>
                <td className="p-2 border">{item.max_qty}</td>
                <td className="p-2 border space-x-2">
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    onClick={() => reorderToMax(item)}
                    disabled={loading}
                  >
                    Reorder to Max
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExampleWMS;
