require('dotenv').config();
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected successfully');
  process.exit(0);
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
}); 