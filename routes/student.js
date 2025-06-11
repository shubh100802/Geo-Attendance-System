const express = require('express');
const router = express.Router();
const AttendanceSetting = require('../models/AttendanceSetting');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const Attendance = require('../models/Attendance');
const verifyToken = require('../middleware/auth');


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
    const { latitude, longitude, slot } = req.body;
    console.log("✅ Received body:", req.body);


     if (!latitude || !longitude || !slot) {
      return res.status(400).json({ allowed: false, message: "Missing data" });
    }

    // Find student to get who their teacher is
    const student = await Student.findById(req.userId);
    if (!student) {
      return res.status(404).json({ allowed: false, message: "Student not found" });
    }

    // Now find attendance settings set by *that teacher*
    const setting = await AttendanceSetting.findOne({ createdBy: student.createdBy, slot });

    if (!setting || !setting.latitude || !setting.longitude || !setting.radius) {
      return res.status(400).json({ allowed: false, message: "❌ Teacher has not set attendance location yet." });
    }

    const allowedLat = setting.latitude;
    const allowedLng = setting.longitude;
    const radius = setting.radius;

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
    const { slot } = req.body;
    const currentTime = new Date();
    const currentDate = currentTime.toISOString().split('T')[0];

    if (!slot) {
      return res.status(400).json({ message: "Slot is required" });
    }

    // Get student details
    const student = await Student.findById(req.userId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get attendance settings
    const setting = await AttendanceSetting.findOne({ 
      createdBy: student.createdBy, 
      slot 
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
      slot, 
      date: currentDate,
      createdBy: student.createdBy
    });

    if (!attendance) {
      attendance = new Attendance({
        slot,
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

// ============ GET /teacher/download-attendance ============

router.get("/download-attendance", verifyToken, async (req, res) => {
  try {
    const slot = req.query.slot;
    const type = req.query.type; // "present" or "absent"
    const dateString = new Date().toISOString().split("T")[0];

    if (!slot || !type) {
      return res.status(400).json({ message: "Slot and type are required" });
    }

    // Find attendance record for today, filtered by the teacher's ID
    const attendance = await Attendance.findOne({ 
      slot, 
      date: dateString,
      createdBy: req.userId // Filter by the teacher's ID
    });

    const students = await Student.find({ slot });

    let dataToExport = [];

    if (type === "present") {
      const presentSet = new Set(attendance?.present || []);
      dataToExport = students
        .filter((s) => presentSet.has(s.regNo))
        .map((s) => ({
          Name: s.name,
          Email: s.email,
          RegNo: s.regNo,
          Slot: s.slot,
          Date: dateString,
          Status: "Present",
        }));
    } else if (type === "absent") {
      const presentSet = new Set(attendance?.present || []);
      dataToExport = students
        .filter((s) => !presentSet.has(s.regNo))
        .map((s) => ({
          Name: s.name,
          Email: s.email,
          RegNo: s.regNo,
          Slot: s.slot,
          Date: dateString,
          Status: "Absent",
        }));
    }

    res.json(dataToExport);
  } catch (err) {
    console.error("Error downloading attendance:", err);
    res.status(500).json({ message: "Server error while downloading attendance" });
  }
});

// ============ GET /student/attendance-history ============
router.get('/attendance-history', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.userId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const records = await Attendance.find({
      slot: { $in: Array.isArray(student.slot) ? student.slot : [student.slot] },
      createdBy: student.createdBy
    }).sort({ date: -1 });

    const history = records.map(rec => ({
      date: rec.date,
      slot: rec.slot,
      status: rec.present.includes(student.regNo) ? "Present" : "Absent"
    }));

    res.json({ history });
  } catch (err) {
    console.error("Error fetching attendance history:", err);
    res.status(500).json({ message: "Server error while fetching history" });
  }
});

router.use(authenticateToken); 

module.exports = router;
