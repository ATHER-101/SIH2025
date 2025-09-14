// src/App.jsx
import React, { useEffect, useState, useRef } from "react";

// Helper: read query param
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Helper: validate crate_int_id (basic integer check)
function isValidCrateId(id) {
  if (!id) return false;
  return /^\d+$/.test(id);
}

// Send payload with retries; uses fetch
async function sendLocation(payload, { retries = 3 } = {}) {
  let attempt = 0;
  let lastErr = null;
  const backoff = (n) => 500 * Math.pow(2, n);

  while (attempt <= retries) {
    try {
      const res = await fetch("http://localhost:3000/api/submit-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      if (res.ok) {
        return { ok: true, status: res.status };
      } else {
        const text = await res.text().catch(() => "");
        lastErr = new Error(`HTTP ${res.status} ${text}`);
        if (res.status >= 400 && res.status < 500) break;
      }
    } catch (err) {
      lastErr = err;
    }

    attempt++;
    await new Promise((r) => setTimeout(r, backoff(attempt)));
  }
  return { ok: false, error: lastErr };
}

export default function App() {
  const crateId = useRef(
    getQueryParam("crate_int_id") ||
      getQueryParam("crate_id") ||
      getQueryParam("id") ||
      ""
  );

  const [status, setStatus] = useState("idle");
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  useEffect(() => {
    if (!crateId.current) {
      setStatus("missing_crate_id");
      setError("Missing crate_int_id in URL. Example: ?crate_int_id=12345");
      return;
    }

    if (!isValidCrateId(crateId.current)) {
      setStatus("invalid_crate_id");
      setError("Crate ID appears invalid. Expected integer.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("no_geolocation");
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("requesting_permission");

    const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setCoords(p);
        setStatus("sending");

        const payload = { crate_int_id: crateId.current, location: p };
        const result = await sendLocation(payload);

        if (result.ok) setStatus("sent");
        else {
          setStatus("send_failed");
          setError(result.error ? String(result.error) : "Unknown error");
        }
      },
      (err) => {
        setStatus("permission_denied");
        setError(err.message || String(err));
      },
      opts
    );

    // send last coords when leaving page
    const handleUnload = () => {
      if (!coords) return;
      const payload = {
        crate_int_id: crateId.current,
        location: coords,
      };
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "http://localhost:3000/api/submit-location",
          blob
        );
      }
    };
    window.addEventListener("pagehide", handleUnload);
    return () => window.removeEventListener("pagehide", handleUnload);
  }, []);

  async function handleManualSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!manualLat || !manualLng) {
      setError("Please enter latitude and longitude.");
      return;
    }

    const p = {
      latitude: Number(manualLat),
      longitude: Number(manualLng),
      accuracy: null,
      timestamp: Date.now(),
    };
    setCoords(p);
    setStatus("sending");

    const payload = { crate_int_id: crateId.current, location: p };
    const result = await sendLocation(payload);

    if (result.ok) setStatus("sent");
    else {
      setStatus("send_failed");
      setError(result.error ? String(result.error) : "Unknown error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-xl w-full bg-white shadow-lg rounded-2xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Location Capture</h1>
        <p className="text-sm text-gray-600 mb-4">
          Crate ID:{" "}
          <span className="font-mono">{crateId.current || "—"}</span>
        </p>

        <div className="space-y-3">
          <div>
            <strong>Status:</strong>{" "}
            <span className="font-medium">{status}</span>
          </div>

          {coords && (
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm">Latitude: {coords.latitude}</div>
              <div className="text-sm">Longitude: {coords.longitude}</div>
              <div className="text-sm">
                Accuracy: {coords.accuracy ?? "—"} meters
              </div>
            </div>
          )}

          {error && <div className="text-red-600 text-sm">Error: {error}</div>}

          <div className="flex gap-2">
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded shadow hover:opacity-95"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>

            <button
              className="px-3 py-2 border rounded"
              onClick={() => setManualMode((s) => !s)}
            >
              {manualMode ? "Hide manual entry" : "Enter location manually"}
            </button>
          </div>

          {manualMode && (
            <form onSubmit={handleManualSubmit} className="mt-2 space-y-2">
              <div>
                <label className="block text-xs">Latitude</label>
                <input
                  className="w-full border p-2 rounded"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs">Longitude</label>
                <input
                  className="w-full border p-2 rounded"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-3 py-2 bg-green-600 text-white rounded"
                >
                  Send manual
                </button>
                <button
                  type="button"
                  className="px-3 py-2 border rounded"
                  onClick={() => {
                    setManualLat("");
                    setManualLng("");
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          )}

          <div className="text-xs text-gray-500 pt-3">
            Notes: Geolocation works only over HTTPS (except localhost). If GPS
            capture fails, use manual entry. Location will be sent to{" "}
            <span className="font-mono">
              http://localhost:3000/api/submit-location
            </span>
            .
          </div>
        </div>
      </div>
    </div>
  );
}