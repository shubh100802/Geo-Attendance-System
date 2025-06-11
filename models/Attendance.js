const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  slot: { type: String, required: true },
  present: [{ type: String }], // array of RegNo
  date: { type: String, required: true }, // should be saved as 'YYYY-MM-DD'
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model("Attendance", attendanceSchema);
