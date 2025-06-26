const express = require('express');
const router = express.Router();
const AttendanceSetting = require('../models/AttendanceSetting');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const Attendance = require('../models/Attendance');
const verifyToken = require('../middleware/auth');
const bcrypt = require('bcrypt');

const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

console.log("IST time:", new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

// ============ Middleware to authenticate and get userId from token ============
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

// ============ POST /student/validate-location ============
router.post('/validate-location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, mainSlot, individualSlot } = req.body;
    console.log("Received body:", req.body);

    if (!latitude || !longitude || !mainSlot || !individualSlot) {
      return res.status(400).json({ allowed: false, message: "Missing data" });
    }

    // Find student to get who their teacher is
    const student = await Student.findById(req.userId);
    if (!student) {
      return res.status(404).json({ allowed: false, message: "Student not found" });
    }

    // Now find attendance settings set by *that teacher*
    const setting = await AttendanceSetting.findOne({ 
      createdBy: student.createdBy, 
      mainSlot,
      individualSlot 
    });

    if (!setting || !setting.latitude || !setting.longitude || !setting.radius) {
      return res.status(400).json({ allowed: false, message: "Teacher has not set attendance location yet." });
    }

    const allowedLat = setting.latitude;
    const allowedLng = setting.longitude;
    const radius = setting.radius;

    // Time window check (IST)
    const currentTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const [startHour, startMinute] = setting.startTime.split(':').map(Number);
    const [endHour, endMinute] = setting.endTime.split(':').map(Number);
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const isWithinTimeWindow = (
      (currentHour > startHour || (currentHour === startHour && currentMinute >= startMinute)) &&
      (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute))
    );
    if (!isWithinTimeWindow) {
      return res.json({ allowed: false, message: `Attendance can only be marked between ${setting.startTime} and ${setting.endTime}` });
    }

    const toRad = (val) => val * Math.PI / 180;
    const earthRadius = 6371000;

    const dLat = toRad(latitude - allowedLat);
    const dLng = toRad(longitude - allowedLng);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(allowedLat)) *
      Math.cos(toRad(latitude)) *
      Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;

    if (distance <= radius) {
      res.json({ allowed: true });
    } else {
      res.json({ allowed: false });
    }

  } catch (err) {
    console.error("Error in validate-location:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// ============ GET /student/my-slot ============

router.get('/my-slot', authenticateToken, async (req, res) => {
  const student = await Student.findById(req.userId);
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json({ slot: student.slot });
});


// ============ POST /student/mark-attendance ============
router.post('/mark-attendance', authenticateToken, async (req, res) => {
  try {
    const { mainSlot, individualSlot } = req.body;
    // Convert current time to IST (UTC+5:30)
    const currentTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentDate = currentTime.toISOString().split('T')[0];

    if (!mainSlot || !individualSlot) {
      return res.status(400).json({ message: "Main slot and individual slot are required" });
    }

    // Get student details
    const student = await Student.findById(req.userId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get attendance settings
    const setting = await AttendanceSetting.findOne({ 
      createdBy: student.createdBy, 
      mainSlot,
      individualSlot 
    });

    if (!setting) {
      return res.status(400).json({ message: "Attendance settings not found for this slot" });
    }

    // Check if current time is within allowed window
    const [startHour, startMinute] = setting.startTime.split(':').map(Number);
    const [endHour, endMinute] = setting.endTime.split(':').map(Number);
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();

    const isWithinTimeWindow = (
      (currentHour > startHour || (currentHour === startHour && currentMinute >= startMinute)) &&
      (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute))
    );

    if (!isWithinTimeWindow) {
      return res.status(400).json({ 
        message: `Attendance can only be marked between ${setting.startTime} and ${setting.endTime}` 
      });
    }

    // Find or create attendance record for today
    let attendance = await Attendance.findOne({ 
      mainSlot,
      individualSlot,
      date: currentDate,
      createdBy: student.createdBy
    });

    if (!attendance) {
      attendance = new Attendance({
        mainSlot,
        individualSlot,
        date: currentDate,
        present: [],
        createdBy: student.createdBy
      });
    }

    // Check if student has already marked attendance
    if (attendance.present.includes(student.regNo)) {
      return res.status(400).json({ message: "Attendance already marked for today" });
    }

    // Add student to present list
    attendance.present.push(student.regNo);
    await attendance.save();

    res.status(200).json({ message: "Attendance marked successfully" });
  } catch (err) {
    console.error("Error marking attendance:", err);
    res.status(500).json({ message: "Server error while marking attendance" });
  }
});

// ============ GET /student/attendance-history ============
router.get('/attendance-history', authenticateToken, async (req, res) => {
  try {
    const { mainSlot } = req.query;
    const student = await Student.findById(req.userId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Find all attendance records for the student's slots
    const records = await Attendance.find({
      mainSlot,
      createdBy: student.createdBy,
      present: student.regNo
    }).sort({ date: -1 });

    const history = records.map(rec => ({
      date: rec.date,
      individualSlot: rec.individualSlot,
      status: "Present"
    }));

    // Also find records where student was absent
    const absentRecords = await Attendance.find({
      mainSlot,
      createdBy: student.createdBy,
      date: { $in: records.map(r => r.date) },
      present: { $ne: student.regNo }
    });

    // Add absent records to history
    absentRecords.forEach(rec => {
      if (!history.some(h => h.date === rec.date && h.individualSlot === rec.individualSlot)) {
        history.push({
          date: rec.date,
          individualSlot: rec.individualSlot,
          status: "Absent"
        });
      }
    });

    // Sort by date and take last 10
    const sortedHistory = history
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    res.json({ history: sortedHistory });
  } catch (err) {
    console.error("Error fetching attendance history:", err);
    res.status(500).json({ message: "Server error while fetching history" });
  }
});

// ============ POST /student/change-password ============

router.post("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const studentId = req.userId;

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    student.password = hashedPassword;
    await student.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Failed to change password" });
  }
});

// ============ GET /student/attendance-time-window ============
router.get('/attendance-time-window', verifyToken, async (req, res) => {
  try {
    const { mainSlot, individualSlot } = req.query;

    if (!mainSlot || !individualSlot) {
      return res.status(400).json({ message: "Both main and individual slots are required." });
    }

    const student = await Student.findById(req.userId);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const setting = await AttendanceSetting.findOne({ 
      createdBy: student.createdBy, 
      mainSlot,
      individualSlot 
    });

    if (!setting) {
      return res.status(404).json({ message: "Attendance settings not found for this slot." });
    }

    res.json({
      startTime: setting.startTime,
      endTime: setting.endTime,
      serverTime: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    });

  } catch (err) {
    console.error("Error fetching attendance time window:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.use(authenticateToken); 

module.exports = router;
