const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  slot: { type: String, required: true },
  present: [{ type: String }], 
  date: { type: String, required: true }, 
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model("Attendance", attendanceSchema);
