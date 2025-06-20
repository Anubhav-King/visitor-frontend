  // src/App.js
  import React, { useEffect, useState, useRef } from "react";
  import axios from "axios";
  import imageCompression from "browser-image-compression";

  // Public VAPID key and backend URL
  const VAPID_PUBLIC_KEY = "BNkdLVGab29b6l24GDBpc6vkRS1j28JewZzwU6YGbHgONiwAydbs9SHgwI4BYDwxiNTAr6wjS9NDeIQUqSqWvj8";
  const BASE_URL = "https://visitor-backend-nfts.onrender.com";

  export default function App() {
    const [activeTab, setActiveTab] = useState("current");
    const [filterBlock, setFilterBlock] = useState("");
    const [filterFlat, setFilterFlat] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [isFiltering, setIsFiltering] = useState(false);
    const [enablePreApproval, setEnablePreApproval] = useState(false);
    const fileInputRef = useRef(null);
    const [token, setToken] = useState(localStorage.getItem("token") || "");
    const [userInfo, setUserInfo] = useState({
      name: localStorage.getItem("name") || "",
      role: localStorage.getItem("role") || "",
      block: localStorage.getItem("block") || "",
      flat: localStorage.getItem("flat") || "",
    });

    const [mobile, setMobile] = useState("");
    const [password, setPassword] = useState("");
    const [visitors, setVisitors] = useState([]);

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
    useEffect(() => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(console.error);
      }
    }, []);

    useEffect(() => {
      if (token) fetchVisitors();
    }, [token, activeTab, filterBlock, filterFlat, filterStatus, filterDate]);

    useEffect(() => {
      const interval = setInterval(() => {
        if (token && !isFiltering) fetchVisitors();
      }, 2000);
      return () => clearInterval(interval);
    }, [token, activeTab, isFiltering]);

    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    }
    async function subscribeUser(authToken) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await axios.post(`${BASE_URL}/api/subscribe`, { subscription: sub }, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (err) {
        console.error("Push subscribe failed:", err);
      }
    }

    async function login() {
      try {
        const res = await axios.post(`${BASE_URL}/api/login`, { mobile, password });
        const { token: t, name, role, block, flat } = res.data;
        setToken(t);
        setUserInfo({ name, role, block, flat });
        ["token", "name", "role", "block", "flat"].forEach((k, i) =>
          localStorage.setItem(k, [t, name, role, block, flat][i])
        );
        await subscribeUser(t);
      } catch (err) {
        alert(err.response?.data?.message || "Login failed");
      }
    }

    // Handle form field change
    function handleVisitorChange(e) {
      const { name, value } = e.target;
      setVisitorForm((prev) => {
        const updated = { ...prev, [name]: value };
        // Clear vehicle number if "none" selected
        if (name === "vehicleType" && value === "none") {
          updated.vehicleNumber = "";
        }
        return updated;
      });
    }


    function logout() {
      localStorage.clear();
      setToken("");
      setUserInfo({ name: "", role: "", block: "", flat: "" });
    }
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

    async function updateVisitor(id, data) {
      try {
        await axios.patch(`${BASE_URL}/api/visitors/${id}`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
        fetchVisitors();
      } catch (err) {
        alert("Update failed: " + (err.response?.data?.error || err.message));
      }
    }

    async function handlePhoto(e) {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const options = {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 800,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);

        const reader = new FileReader();
        reader.onloadend = () => {
          setVisitorForm((prev) => ({ ...prev, photo: reader.result }));
        };
        reader.readAsDataURL(compressedFile);
      } catch (err) {
        console.error("Image compression failed:", err);
      }
    }

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

      // ✅ Only guard must provide a photo at submission time
      if (userInfo.role === "guard" && !visitorForm.photo) {
        alert("Photo is mandatory for guards");
        return;
      }

      try {
        await axios.post(`${BASE_URL}/api/visitors`, body, {
          headers: { Authorization: `Bearer ${token}` },
        });
        fetchVisitors();
        // ✅ Reset form and file input
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
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (err) {
        alert("Failed to add visitor");
        console.error(err);
      }
    }

    const handleChangePassword = async () => {
      const oldPassword = prompt("Enter old password:");
      const newPassword = prompt("Enter new password:");
      if (!oldPassword || !newPassword) return alert("Both fields are required");

      try {
        const res = await fetch(`${BASE_URL}/api/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        const data = await res.json();
        alert(data.message);
      } catch (err) {
        alert("Error changing password");
      }
    };

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

          {userInfo.role === "resident" && (
            <div style={{ marginTop: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={enablePreApproval}
                  onChange={(e) => setEnablePreApproval(e.target.checked)}
                  style={{ marginRight: 10 }}
                />
                Enable Pre‑Approved Visitor Entry
              </label>
            </div>
          )}
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

        {/* Visitor form (current only, conditional by role and toggle) */}
        {activeTab === "current" &&
          (userInfo.role !== "resident" || enablePreApproval) && (
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
              {["Bike", "Car"].includes(visitorForm.vehicleType) && (
                <input
                  name="vehicleNumber"
                  placeholder="Vehicle Number"
                  value={visitorForm.vehicleNumber}
                  onChange={handleVisitorChange}
                  style={{ marginRight: 10 }}
                />
              )}

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
                ref={fileInputRef}
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

                {/* Guard arrival */}
                {userInfo.role === "guard" &&
                  activeTab === "current" &&
                  ["approved", "pre-approved"].includes(v.status) &&
                  !v.actualArrival && (
                    <>
                      {(!v.photo || !v.vehicleType || (!v.vehicleNumber && v.vehicleType !== "none")) && (
                        <div>
                          {!v.photo && (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;

                                  const options = {
                                    maxSizeMB: 0.2,
                                    maxWidthOrHeight: 800,
                                    useWebWorker: true,
                                  };
                                  const compressed = await imageCompression(file, options);
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    updateVisitor(v._id, { photo: reader.result });
                                  };
                                  reader.readAsDataURL(compressed);
                                }}
                              />
                              <br />
                            </>
                          )}

                          {!v.vehicleType && (
                            <select
                              onChange={(e) =>
                                updateVisitor(v._id, { vehicleType: e.target.value })
                              }
                            >
                              <option value="">Select Vehicle</option>
                              <option value="none">No Vehicle</option>
                              <option value="Bike">Bike</option>
                              <option value="Car">Car</option>
                            </select>
                          )}

                          {!v.vehicleNumber && ["Bike", "Car"].includes(v.vehicleType) && (
                            <input
                              placeholder="Vehicle Number"
                              onBlur={(e) =>
                                updateVisitor(v._id, {
                                  vehicleNumber: e.target.value,
                                })
                              }
                            />
                          )}

                        </div>
                      )}

                      {v.photo &&
                        ((v.vehicleType === "none") ||
                         (["Bike", "Car"].includes(v.vehicleType) && v.vehicleNumber?.trim())) && (
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

                    </>
                )}


                {/* Guard departure */}
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
