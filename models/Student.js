const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  regNo: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Hashed regNo
  slot: [{ type: String, required: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Link to teacher
});

module.exports = mongoose.model('Student', studentSchema);
