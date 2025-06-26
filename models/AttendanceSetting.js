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
  mainSlot: {
    type: String,
    required: true
  },
  individualSlot: {
    type: String,
    required: true
  },
  deleteAt: { 
    type: Date, 
    index: { expireAfterSeconds: 0 } 
  }
});

module.exports = mongoose.model("AttendanceSetting", settingSchema);
