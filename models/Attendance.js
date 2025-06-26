const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  mainSlot: {
    type: String,
    required: true
  },
  individualSlot: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  present: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

module.exports = mongoose.model("Attendance", attendanceSchema);
