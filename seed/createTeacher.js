const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); 
require('dotenv').config(); 

// Debug environment variables
console.log('MongoDB URI:', process.env.MONGO_URI ? 'Present' : 'Missing');
console.log('JWT Secret:', process.env.JWT_SECRET ? 'Present' : 'Missing');

async function createTeacher(teacherData) {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Successfully connected to MongoDB');

    // Check if teacher already exists
    const existingTeacher = await User.findOne({ email: teacherData.email });
    if (existingTeacher) {
      console.log(` Teacher with email ${teacherData.email} already exists. Skipping...`);
      return null;
    }

    // Generate username from email
    const username = teacherData.email.split('@')[0];

    console.log(`Creating teacher: ${teacherData.name}`);
    const hashedPassword = await bcrypt.hash(teacherData.password, 10);
    const teacher = new User({
      name: teacherData.name,
      username: username,
      email: teacherData.email,
      password: hashedPassword,
      role: 'teacher',
    });

    await teacher.save();
    console.log(` Teacher ${teacherData.name} added!`);
    return teacher;
  } catch (err) {
    console.error(' Error adding teacher:', err.message);
    throw err;
  }
}

// Example usage:
async function addTeachers() {
  try {
    console.log('Starting teacher creation process...');
    const teachers = [
      {
        name: 'Mr. Sharma',
        email: 'sharma@college.com',
        password: 'teacher123'
      },
      {
        name: 'Mr.Sajjad Ahmed',
        email: 'sajjadahmed@vitbhopal.ac.in',
        password: 'Ahmed@2025'
      }
      // Add more teachers 
    ];

    console.log(`Found ${teachers.length} teachers to add`);

    for (const teacher of teachers) {
      await createTeacher(teacher);
    }
    
    console.log(' All teachers added successfully!');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error(' Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
console.log('Script started');
addTeachers().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
