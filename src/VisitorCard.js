// frontend/VisitorCard.js
import React from "react";

export default function VisitorCard({ v, role, onApprove, onDeny, onArchive }) {
  return (
    <div style={{ margin: "10px 0", padding: 10, border: "1px solid #ccc", borderRadius: 5 }}>
      <strong>{v.name}</strong><br/>
      <em>{v.purpose}</em><br/>
      {v.photo && <img src={v.photo} alt="visitor" style={{ width: 80, marginTop: 5 }} />}<br/>

      {role === "guard" && (
        <>
          Block {v.block}, Flat {v.flat}<br/>
          Expected: {v.expectedArrival || "--"}<br/>
          Actual: {v.actualArrival || "--"}<br/>
          Departure: {v.departureTime || "--"}<br/>
          Vehicle: {v.vehicleType} {v.vehicleNumber}<br/>
          Contact: {v.contactNumber || "--"}<br/>
          Status: <b>{v.status}</b><br/>

          {/* Guard actions */}
          {v.status==="pending" && <button onClick={()=>onApprove(v._id)}>Approve</button>}
          {v.status==="approved" && !v.actualArrival && (
            <input type="time" onChange={e=>onApprove(v._id, e.target.value)} />
          )}
          {v.actualArrival && !v.departureTime && (
            <input type="time" onChange={e=>onArchive(v._id, e.target.value)} />
          )}
        </>
      )}

      {role==="resident" && (
        <>
          {/* Resident sees only name, purpose, photo */}
          Status: <b>{v.status}</b>
        </>
      )}
    </div>
  );
}
