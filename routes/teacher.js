const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const xlsx = require('xlsx');
const Student = require('../models/Student');
const User = require('../models/User');
const AttendanceSetting = require('../models/AttendanceSetting');
const verifyToken = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');



// =================== Multer setup ===================

const storage = multer.memoryStorage();
const upload = multer({ storage });


// =================== POST /teacher/add-student ===================

router.post('/add-student', verifyToken, async (req, res) => {
  console.log("req.userId in /add-student:", req.userId);
  const { name, email, regNo, slot } = req.body;

  try {

    const existing = await Student.findOne({ email });

    if (existing) {
      let currentSlots = [];

      if (Array.isArray(existing.slot)) {
        currentSlots = existing.slot;
      } else if (typeof existing.slot === "string") {
        currentSlots = [existing.slot];
      }

      // Prevent duplicate
      if (!currentSlots.includes(slot)) {
        // Reassign fully as array
        existing.set("slot", [...currentSlots, slot]);
        existing.markModified("slot"); 
        await existing.save();
        return res.status(200).json({ message: `Student already exists. Slot "${slot}" added.` });
      } else {
        return res.status(409).json({ message: "Student already exists in this slot." });
      }
    }


    const hashedPassword = await bcrypt.hash(regNo, 10);

    const newStudent = new Student({
      name,
      email,
      regNo,
      password: hashedPassword,
      slot: [slot],
      createdBy: req.userId,
    });

    await newStudent.save();
    res.status(201).json({ message: 'Student added successfully' });
  } catch (err) {
    console.error('❌ Error in /add-student:', err);
    res.status(500).json({ message: 'Server error while adding student' });
  }
});


// =================== POST /teacher/upload-students ===================

router.post('/upload-students', verifyToken, upload.single('file'), async (req, res) => {
  // Only allow teachers to upload students
  if (req.role !== 'teacher') {
    return res.status(403).json({ message: 'Forbidden: Only teachers can upload students.' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const students = xlsx.utils.sheet_to_json(sheet);

    for (const student of students) {
      const { Name, Email, RegNo, Slot } = student;

      // Skip if any field is missing
      if (!Name || !Email || !RegNo || !Slot) continue;

      // Skip if student already exists
      const exists = await Student.findOne({ $or: [{ email: Email }, { regNo: RegNo }] });
      if (exists) continue;

      const hashedPassword = await bcrypt.hash(RegNo, 10);

      await new Student({
        name: Name,
        email: Email,
        regNo: RegNo,
        password: hashedPassword,
        slot: Slot.split("+"),
        createdBy: req.userId // Always set from the authenticated teacher
      }).save();
    }

    res.status(201).json({ message: "Students uploaded successfully!" });

  } catch (err) {
    console.error("❌ Error in /upload-students:", err);
    res.status(500).json({ message: "Server error during Excel upload" });
  }
});


// ============= GET /teacher/students =============

router.get('/students', verifyToken, async (req, res) => {
  try {
    const slot = req.query.slot;
    const filter = { createdBy: req.userId }; // Filter by teacher's ID
    if (slot) {
      filter.slot = slot;
    }
    const students = await Student.find(filter).select("-password"); // omit passwords
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ============= GET /teacher/slots =============

router.get('/slots', verifyToken, async (req, res) => {
  try {
    // Get distinct slots only for students created by this teacher
    const slots = await Student.distinct("slot", { createdBy: req.userId });
    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch slots' });
  }
});


// ============= Delete one student =============

router.delete('/students/:regNo', async (req, res) => {
  try {
    const regNo = req.params.regNo;
    await Student.deleteOne({ regNo });
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting student:', err);
    res.status(500).json({ message: 'Server error while deleting student' });
  }
});


// ============= Delete all Students =============

router.delete('/slots/:slot', verifyToken, async (req, res) => {
  try {
    const slot = decodeURIComponent(req.params.slot);
    // Only delete students created by this teacher
    await Student.deleteMany({ 
      slot: slot,
      createdBy: req.userId 
    });
    res.json({ message: `All students from slot ${slot} deleted for your account.` });
  } catch (err) {
    console.error('❌ Error deleting slot:', err);
    res.status(500).json({ message: 'Server error while deleting slot' });
  }
});


// ============= Attendance Setup Setting =============

router.post('/attendance-settings', verifyToken, async (req, res) => {
  const { radius, startTime, endTime, latitude, longitude, slot } = req.body;
  const createdBy = req.userId;

  try {
    const existing = await AttendanceSetting.findOne({ createdBy, slot });

    if (existing) {
      existing.radius = radius;
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.latitude = latitude;
      existing.longitude = longitude;
      await existing.save();
    } else {
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const today = new Date();
      const deleteAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endHour, endMinute);

      await AttendanceSetting.create({
        radius,
        startTime,
        endTime,
        latitude,
        longitude,
        slot,
        createdBy,
        deleteAt
      });
    }

    res.status(200).json({ message: "✅ Attendance settings saved!" });
  } catch (err) {
    console.error("❌ Error saving settings:", err);
    res.status(500).json({ message: "Server error while saving settings" });
  }
});




// ============ GET /teacher/download-attendance ============

router.get("/download-attendance", async (req, res) => {
  try {
    const slot = req.query.slot;
    const type = req.query.type; // "present" or "absent"
    const dateString = new Date().toISOString().split("T")[0];

    if (!slot || !type) {
      return res.status(400).json({ message: "Slot and type are required" });
    }

    const attendance = await Attendance.findOne({ slot, date: dateString });
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
    } else {
      return res.status(400).json({ message: "Invalid type value" });
    }

    // Generate Excel
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(dataToExport);
    xlsx.utils.book_append_sheet(wb, ws, "Attendance");

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${slot}_${type}_${dateString}.xlsx`
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("❌ Download attendance error:", err);
    res.status(500).json({ message: "Failed to download attendance" });
  }
});



module.exports = router;
