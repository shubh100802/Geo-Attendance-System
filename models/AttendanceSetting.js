const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  radius: {
    type: Number,
    required: true,
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  slot: {
  type: String,
  required: true
},
deleteAt: { type: Date, index: { expireAfterSeconds: 0 } }
});

function saveAttendanceSettings() {
  const radius = document.getElementById("radiusInput").value;
  const latitude = document.getElementById("latitude").value;
  const longitude = document.getElementById("longitude").value;
  const startTime = document.getElementById("startTimeInput").value;
  const endTime = document.getElementById("endTimeInput").value;
  const slot = document.getElementById("slotSelect").value; // <-- ✅ Add this line

  if (!radius || !startTime || !endTime || !latitude || !longitude || !slot) {
    alert("Please complete all fields including location and slot."); // <-- updated message
    return;
  }

  const data = { radius, latitude, longitude, startTime, endTime, slot }; // <-- ✅ Include slot

  fetch("http://localhost:3000/teacher/attendance-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(data),
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById("radiusSavedMsg").innerText =
        data.message || "Attendance settings saved!";
    })
    .catch(err => {
      console.error("Error saving settings:", err);
      alert("Something went wrong.");
    });
}



module.exports = mongoose.model("AttendanceSetting", settingSchema);
