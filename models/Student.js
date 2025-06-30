const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  regNo: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  mainSlot: { type: String, required: true },
  archivedSlots: [{ type: String, default: [] }], 
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
});

module.exports = mongoose.model('Student', studentSchema);
