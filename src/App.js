// src/App.js
import React, { useEffect, useState } from "react";
import axios from "axios";

// Public VAPID key and backend URL
const VAPID_PUBLIC_KEY =
  "BNkdLVGab29b6l24GDBpc6vkRS1j28JewZzwU6YGbHgONiwAydbs9SHgwI4BYDwxiNTAr6wjS9NDeIQUqSqWvj8";
const BASE_URL = "https://visitor-backend-nfts.onrender.com";

export default function App() {
  // Tabs & filters
  const [activeTab, setActiveTab] = useState("current"); // 'current' or 'archived'
  const [filterBlock, setFilterBlock] = useState("");
  const [filterFlat, setFilterFlat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);

  // Auth state
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userInfo, setUserInfo] = useState({
    name: localStorage.getItem("name") || "",
    role: localStorage.getItem("role") || "",
    block: localStorage.getItem("block") || "",
    flat: localStorage.getItem("flat") || "",
  });

  // Login form
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  // Visitor list
  const [visitors, setVisitors] = useState([]);

  // Register service worker once
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);
  // Visitor form state
  const [visitorForm, setVisitorForm] = useState({
    name: "",
    purpose: "",
    expectedArrival: "",
    vehicleType: "none",
    vehicleNumber: "",
    contactNumber: "",
    photo: "",
    vBlock: "",
    vFlat: "",
  });
  // Fetch visitors whenever dependencies change
  useEffect(() => {
    if (token) fetchVisitors();
  }, [token, activeTab, filterBlock, filterFlat, filterStatus, filterDate]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (token && !isFiltering) fetchVisitors();
    }, 2000);
    return () => clearInterval(interval);
  }, [token, activeTab, isFiltering]);

  const handleChangePassword = async () => {
    const oldPassword = prompt("Enter old password:");
    const newPassword = prompt("Enter new password:");

    if (!oldPassword || !newPassword) return alert("Both fields are required");

    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert("Error changing password");
    }
  };

  // Fetch visitors with filters
  async function fetchVisitors() {
    try {
      const params = new URLSearchParams();
      params.append("isArchived", activeTab === "archived");
      if (userInfo.role === "guard") {
        if (filterBlock) params.append("block", filterBlock);
        if (filterFlat) params.append("flat", filterFlat);
        if (filterStatus) params.append("status", filterStatus);
      } else {
        params.append("block", userInfo.block);
        params.append("flat", userInfo.flat);
      }
      if (filterDate) params.append("date", filterDate);

      const res = await axios.get(`${BASE_URL}/api/visitors?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVisitors(res.data);
      setIsFiltering(false);
    } catch (err) {
      console.error("Fetch visitors error:", err);
    }
  }
  // Convert VAPID key
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  // Subscribe user to push
  async function subscribeUser(authToken) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await axios.post(
        `${BASE_URL}/api/subscribe`,
        { subscription: sub },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
    } catch (err) {
      console.error("Push subscribe failed:", err);
    }
  }

  // Handle login
  async function login() {
    try {
      const res = await axios.post(`${BASE_URL}/api/login`, {
        mobile,
        password,
      });
      const { token: t, name, role, block, flat } = res.data;
      setToken(t);
      setUserInfo({ name, role, block, flat });
      ["token", "name", "role", "block", "flat"].forEach((k, i) =>
        localStorage.setItem(k, [t, name, role, block, flat][i]),
      );
      await subscribeUser(t);
    } catch (err) {
      console.error("Login error:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Login failed");
    }
  }

  // Handle logout
  function logout() {
    localStorage.clear();
    setToken("");
    setUserInfo({ name: "", role: "", block: "", flat: "" });
  }

  // Update visitor (approve/deny/arrival/departure)
  async function updateVisitor(id, data) {
    //console.log('🔼 Sending PATCH →', id, data);
    try {
      const res = await axios.patch(`${BASE_URL}/api/visitors/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      //console.log('✅ PATCH response:', res.data);
      fetchVisitors();
    } catch (err) {
      //console.error('❌ PATCH failed:', err.response?.data || err.message);
      alert("Update failed: " + err.response?.data?.error || err.message);
    }
  }

  // If not logged in, show login form
  if (!token) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Login</h2>
        <input
          placeholder="Mobile"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
        />
        <br />
        <br />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <br />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  // Handle form field change
  function handleVisitorChange(e) {
    const { name, value } = e.target;
    setVisitorForm((f) => ({ ...f, [name]: value }));
  }

  // Handle photo upload
  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onloadend = () => setVisitorForm((f) => ({ ...f, photo: r.result }));
    r.readAsDataURL(file);
  }

  // Add new visitor
  async function addVisitor() {
    const body = {
      name: visitorForm.name,
      purpose: visitorForm.purpose,
      block:
        userInfo.role === "guard"
          ? Number(visitorForm.vBlock)
          : Number(userInfo.block),
      flat:
        userInfo.role === "guard"
          ? Number(visitorForm.vFlat)
          : Number(userInfo.flat),
      expectedArrival: visitorForm.expectedArrival,
      vehicleType:
        visitorForm.vehicleType === "none"
          ? undefined
          : visitorForm.vehicleType,
      vehicleNumber: visitorForm.vehicleNumber.trim()
        ? visitorForm.vehicleNumber
        : undefined,
      contactNumber: visitorForm.contactNumber,
      photo: visitorForm.photo,
      status: userInfo.role === "resident" ? "pre-approved" : "pending",
    };
    await axios.post(`${BASE_URL}/api/visitors`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchVisitors();
    // Reset the form fields
    setVisitorForm({
      name: "",
      purpose: "",
      expectedArrival: "",
      vehicleType: "none",
      vehicleNumber: "",
      contactNumber: "",
      photo: "",
      vBlock: "",
      vFlat: "",
    });
  }
  const sendPushSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          "BNkdLVGab29b6l24GDBpc6vkRS1j28JewZzwU6YGbHgONiwAydbs9SHgwI4BYDwxiNTAr6wjS9NDeIQUqSqWvj8",
        ),
      });

      const token = localStorage.getItem("token");

      await fetch(
        "https://fbec7c6b-d209-4c19-89b3-47d4d655fbb4-00-1ymaygrxq38u5.pike.replit.dev:3000/api/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription }),
        },
      );

      alert("Push subscription saved!");
    } catch (err) {
      console.error("Push subscription error", err);
      alert("Failed to save push subscription");
    }
  };

  // Helper
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <header style={{ marginBottom: 20 }}>
        <h2>{new Date().toLocaleDateString("en-GB")}</h2>
        <em>Real‑time use only — all times refer to today</em>
      </header>

      <h1>🏘️ Visitor Management</h1>
      <p>
        Logged in as <b>{userInfo.name}</b> ({userInfo.role})
        <div style={{ marginBottom: 20 }}>
          <button onClick={logout} style={{ marginRight: 10 }}>
            Logout
          </button>
          <button onClick={handleChangePassword}>Change Password</button>
        </div>
      </p>

      {/* Tabs */}
      <div style={{ margin: "20px 0" }}>
        <button
          onClick={() => setActiveTab("current")}
          style={{ fontWeight: activeTab === "current" ? "bold" : "normal" }}
        >
          Current Visitors
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          style={{
            marginLeft: 10,
            fontWeight: activeTab === "archived" ? "bold" : "normal",
          }}
        >
          Past Visitors
        </button>
      </div>

      {/* Filters (archived only) */}
      {activeTab === "archived" && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setIsFiltering(true);
            }}
            style={{ marginRight: 10 }}
          />
          {userInfo.role === "guard" && (
            <>
              <input
                placeholder="Block"
                value={filterBlock}
                onChange={(e) => {
                  setFilterBlock(e.target.value);
                  setIsFiltering(true);
                }}
                style={{ marginRight: 10 }}
              />
              <input
                placeholder="Flat"
                value={filterFlat}
                onChange={(e) => {
                  setFilterFlat(e.target.value);
                  setIsFiltering(true);
                }}
                style={{ marginRight: 10 }}
              />
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setIsFiltering(true);
                }}
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="pending">Pending</option>
              </select>
            </>
          )}
        </div>
      )}

      {/* Visitor form (current only) */}
      {activeTab === "current" && (
        <div style={{ marginBottom: 20 }}>
          <input
            name="name"
            placeholder="Name"
            value={visitorForm.name}
            onChange={handleVisitorChange}
            style={{ marginRight: 10 }}
          />
          <input
            name="purpose"
            placeholder="Purpose"
            value={visitorForm.purpose}
            onChange={handleVisitorChange}
            style={{ marginRight: 10 }}
          />
          {userInfo.role === "guard" && (
            <>
              <input
                name="vBlock"
                type="number"
                placeholder="Block"
                value={visitorForm.vBlock}
                onChange={handleVisitorChange}
                style={{ marginRight: 10 }}
              />
              <input
                name="vFlat"
                type="number"
                placeholder="Flat"
                value={visitorForm.vFlat}
                onChange={handleVisitorChange}
                style={{ marginRight: 10 }}
              />
            </>
          )}
          <input
            name="expectedArrival"
            type="time"
            value={visitorForm.expectedArrival}
            onChange={handleVisitorChange}
            style={{ marginRight: 10 }}
          />
          <select
            name="vehicleType"
            value={visitorForm.vehicleType}
            onChange={handleVisitorChange}
            style={{ marginRight: 10 }}
          >
            <option value="none">No Vehicle</option>
            <option value="Bike">Bike</option>
            <option value="Car">Car</option>
          </select>
          <input
            name="vehicleNumber"
            placeholder="Vehicle Number"
            value={visitorForm.vehicleNumber}
            onChange={handleVisitorChange}
            style={{ marginRight: 10 }}
          />
          <input
            name="contactNumber"
            placeholder="Contact Number"
            value={visitorForm.contactNumber}
            onChange={handleVisitorChange}
            style={{ marginRight: 10 }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            style={{ marginRight: 10 }}
          />
          <button onClick={addVisitor}>Add Visitor</button>
        </div>
      )}
      <h2>{activeTab === "archived" ? "Past Visitors" : "Visitor Log"}</h2>

      {visitors.length === 0 ? (
        <p>No visitors found.</p>
      ) : (
        visitors
          .filter((v) => {
            if (activeTab === "archived") return true;
            return !v.departureTime && v.status !== "denied";
          })
          .map((v) => (
            <div
              key={v._id}
              style={{
                border: "1px solid #ccc",
                padding: 10,
                marginBottom: 10,
              }}
            >
              <p>
                <strong>{v.name}</strong> — {v.purpose}
              </p>
              <p>
                Block {v.block}, Flat {v.flat}
              </p>
              <p>Date: {new Date(v.createdAt).toLocaleDateString("en-GB")}</p>
              <p>Expected: {v.expectedArrival || "--"}</p>
              <p>
                Actual:{" "}
                {v.actualArrival ? `${v.actualArrival} ✅ Arrived` : "--"}
              </p>
              <p>
                Departure:{" "}
                {v.departureTime ? `${v.departureTime} 🚪 Departed` : "--"}
              </p>
              {v.photo && <img src={v.photo} alt="visitor" width={80} />}
              <p>
                Status:{" "}
                <b
                  style={{
                    color:
                      v.status === "approved"
                        ? "blue"
                        : v.status === "pre-approved"
                          ? "purple"
                          : v.status === "arrived"
                            ? "green"
                            : v.status === "departed"
                              ? "gray"
                              : v.status === "denied"
                                ? "red"
                                : "black",
                  }}
                >
                  {v.status}
                </b>
              </p>

              {/* Resident approve/deny */}
              {userInfo.role === "resident" &&
                activeTab === "current" &&
                v.status === "pending" && (
                  <>
                    <button
                      onClick={() =>
                        updateVisitor(v._id, { status: "approved" })
                      }
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateVisitor(v._id, { status: "denied" })}
                      style={{ marginLeft: 10 }}
                    >
                      Deny
                    </button>
                  </>
                )}

              {/* Guard arrival/departure */}
              {userInfo.role === "guard" &&
                activeTab === "current" &&
                ["approved", "pre-approved"].includes(v.status) &&
                !v.actualArrival && (
                  <button
                    onClick={() =>
                      updateVisitor(v._id, {
                        actualArrival: new Date().toTimeString().slice(0, 5),
                        status: "arrived",
                      })
                    }
                  >
                    Mark Arrived
                  </button>
                )}
              {userInfo.role === "guard" &&
                activeTab === "current" &&
                v.actualArrival &&
                !v.departureTime && (
                  <button
                    onClick={() =>
                      updateVisitor(v._id, {
                        departureTime: new Date().toTimeString().slice(0, 5),
                        status: "departed",
                      })
                    }
                  >
                    Mark Departed
                  </button>
                )}
            </div>
          ))
      )}
    </div>
  );
}
