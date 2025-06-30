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
      // Prevent duplicate
      if (existing.mainSlot === slot) {
        return res.status(409).json({ message: "Student already exists in this slot." });
      } else {
        // Optionally, allow adding another mainSlot for the same email (not typical)
        return res.status(409).json({ message: "Student already exists with a different slot." });
      }
    }

    const hashedPassword = await bcrypt.hash(regNo, 10);
    const newStudent = new Student({
      name,
      email,
      regNo,
      password: hashedPassword,
      mainSlot: slot,
      archivedSlots: [],
      createdBy: req.userId,
    });
    await newStudent.save();
    res.status(201).json({ message: 'Student added successfully' });
  } catch (err) {
    console.error(' Error in /add-student:', err);
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
        mainSlot: Slot, // Store as mainSlot string
        archivedSlots: [],
        createdBy: req.userId 
      }).save();
    }
    res.status(201).json({ message: "Students uploaded successfully!" });
  } catch (err) {
    console.error("Error in /upload-students:", err);
    res.status(500).json({ message: "Server error during Excel upload" });
  }
});


// ============= GET /teacher/students =============

router.get('/students', verifyToken, async (req, res) => {
  try {
    const mainSlot = req.query.slot;
    const filter = { createdBy: req.userId };
    if (mainSlot) {
      filter.mainSlot = mainSlot;
      // Exclude students who have this slot in archivedSlots
      filter.archivedSlots = { $ne: mainSlot };
    }
    const students = await Student.find(filter).select("-password");
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ============= GET /teacher/slots =============

router.get('/slots', verifyToken, async (req, res) => {
  try {
    // Get distinct mainSlots only for students created by this teacher
    // Exclude slots that are archived
    const allSlots = await Student.distinct("mainSlot", { createdBy: req.userId });
    const archivedSlots = await Student.distinct("archivedSlots", { createdBy: req.userId });
    // Filter out archived slots from active slots
    const activeSlots = allSlots.filter(slot => !archivedSlots.includes(slot));
    res.json(activeSlots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch slots' });
  }
});


// ============= Delete one student from a slot =============
router.delete('/students/:regNo', verifyToken, async (req, res) => {
  try {
    const regNo = req.params.regNo;
    const slot = req.query.slot;
    if (!slot) {
      return res.status(400).json({ message: 'Slot is required to remove student from a slot.' });
    }
    const student = await Student.findOne({ regNo, createdBy: req.userId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    // Remove the slot from the student's slot array
    student.slot = student.slot.filter(s => s !== slot);
    // If no slots remain, delete the student
    if (student.slot.length === 0) {
      await Student.deleteOne({ regNo, createdBy: req.userId });
      return res.json({ message: `Student deleted completely (no slots left)` });
    } else {
      await student.save();
      return res.json({ message: `Student removed from slot ${slot}` });
    }
  } catch (err) {
    console.error(' Error deleting student:', err);
    res.status(500).json({ message: 'Server error while deleting student' });
  }
});


// ============= Delete all Students =============

router.delete('/slots/:slot', verifyToken, async (req, res) => {
  try {
    const slot = decodeURIComponent(req.params.slot);
    // Only delete students created by this teacher
    await Student.deleteMany({ 
      mainSlot: slot,
      createdBy: req.userId 
    });
    res.json({ message: `All students from slot ${slot} deleted for your account.` });
  } catch (err) {
    console.error('Error deleting slot:', err);
    res.status(500).json({ message: 'Server error while deleting slot' });
  }
});


// ============= Attendance Setup Setting =============

router.post('/attendance-settings', verifyToken, async (req, res) => {
  const { radius, startTime, endTime, latitude, longitude, mainSlot, individualSlot } = req.body;
  const createdBy = req.userId;

  try {
    const existing = await AttendanceSetting.findOne({ 
      createdBy, 
      mainSlot,
      individualSlot 
    });

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
        mainSlot,
        individualSlot,
        createdBy,
        deleteAt
      });
    }

    res.status(200).json({ message: "✅ Attendance settings saved!" });
  } catch (err) {
    console.error("Error saving settings:", err);
    res.status(500).json({ message: "Server error while saving settings" });
  }
});




// ============ GET /teacher/download-attendance ============

router.get("/download-attendance", verifyToken, async (req, res) => {
  try {
    const { mainSlot, individualSlot, type } = req.query; // type is "present" or "absent"
    const dateString = new Date().toISOString().split("T")[0];

    if (!mainSlot || !individualSlot || !type) {
      return res.status(400).json({ message: "Main slot, individual slot, and type are required" });
    }

    // Find attendance record for the specified date and individual slot
    const attendance = await Attendance.findOne({ 
      mainSlot,
      individualSlot,
      date: dateString,
      createdBy: req.userId
    });

    // Get all students in this main slot
    const students = await Student.find({ 
      mainSlot,
      createdBy: req.userId
    }).sort({ name: 1 });

    let dataToExport = [];

    if (type === "present") {
      const presentSet = new Set(attendance?.present || []);
      dataToExport = students
        .filter((s) => presentSet.has(s.regNo))
        .map((s) => ({
          Name: s.name,
          Email: s.email,
          RegNo: s.regNo,
          MainSlot: mainSlot,
          IndividualSlot: individualSlot,
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
          MainSlot: mainSlot,
          IndividualSlot: individualSlot,
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
      `attachment; filename=${mainSlot}_${individualSlot}_${type}_${dateString}.xlsx`
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);

  } catch (err) {
    console.error("Download attendance error:", err);
    res.status(500).json({ message: "Failed to download attendance" });
  }
});

// ============ POST /teacher/archive-slot/:slot ============

router.post('/archive-slot/:slot', verifyToken, async (req, res) => {
  try {
    const slot = decodeURIComponent(req.params.slot);
    
    // Find all students created by this teacher who have this slot
    const students = await Student.find({ 
      slot: { $in: [slot] },
      createdBy: req.userId 
    });

    if (students.length === 0) {
      return res.status(404).json({ message: `No students found in slot ${slot}` });
    }

    // Archive the slot for each student
    for (const student of students) {
      // Add slot to archivedSlots if not already there
      if (!student.archivedSlots.includes(slot)) {
        student.archivedSlots.push(slot);
      }
      // Remove slot from active slots
      student.slot = student.slot.filter(s => s !== slot);
      await student.save();
    }

    res.json({ message: `Slot ${slot} archived successfully for ${students.length} students` });
  } catch (err) {
    console.error('Error archiving slot:', err);
    res.status(500).json({ message: 'Server error while archiving slot' });
  }
});

// ============ GET /teacher/archived-slots ============

router.get('/archived-slots', verifyToken, async (req, res) => {
  try {
    // Get distinct archived slots only for students created by this teacher
    const archivedSlots = await Student.distinct("archivedSlots", { 
      createdBy: req.userId,
      archivedSlots: { $exists: true, $ne: [] }
    });
    res.json(archivedSlots);
  } catch (err) {
    console.error('Error fetching archived slots:', err);
    res.status(500).json({ message: 'Failed to fetch archived slots' });
  }
});

// ============ GET /teacher/archived-students ============

router.get('/archived-students', verifyToken, async (req, res) => {
  try {
    const slot = req.query.slot;
    const filter = { 
      createdBy: req.userId,
      archivedSlots: { $exists: true, $ne: [] }
    };
    
    if (slot) {
      filter.archivedSlots = slot;
    }
    
    const students = await Student.find(filter).select("-password");
    res.json(students);
  } catch (err) {
    console.error('Error fetching archived students:', err);
    res.status(500).json({ message: 'Server error while fetching archived students' });
  }
});

// ============ POST /teacher/unarchive-student/:regNo ============

router.post('/unarchive-student/:regNo', verifyToken, async (req, res) => {
  try {
    const regNo = req.params.regNo;
    const { slot } = req.body; // Optional slot parameter
    
    const student = await Student.findOne({ 
      regNo: regNo,
      createdBy: req.userId 
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (student.archivedSlots.length === 0) {
      return res.status(400).json({ message: 'Student has no archived slots' });
    }

    if (slot) {
      // Unarchive specific slot
      if (!student.archivedSlots.includes(slot)) {
        return res.status(400).json({ message: `Slot ${slot} is not archived for this student` });
      }
      
      // Move specific slot from archived to active
      student.archivedSlots = student.archivedSlots.filter(s => s !== slot);
      student.slot.push(slot);
    } else {
      // Unarchive all slots
      student.slot = [...student.slot, ...student.archivedSlots];
      student.archivedSlots = [];
    }
    
    await student.save();

    const action = slot ? `Slot ${slot} unarchived` : 'All slots unarchived';
    res.json({ message: `Student ${student.name} - ${action} successfully` });
  } catch (err) {
    console.error('Error unarchiving student:', err);
    res.status(500).json({ message: 'Server error while unarchiving student' });
  }
});

// ============= GET /teacher/attendance-report =============

router.get('/attendance-report', verifyToken, async (req, res) => {
    const { mainSlot, individualSlot, date } = req.query;
    const createdBy = req.userId;

    if (!mainSlot || !individualSlot || !date) {
        return res.status(400).json({ message: 'Main slot, individual slot, and date are required.' });
    }

    try {
        const filter = { createdBy, mainSlot, individualSlot, date };
        const attendanceRecord = await Attendance.findOne(filter);
        const allStudents = await Student.find({ createdBy, mainSlot });
        if (!allStudents || allStudents.length === 0) {
            return res.status(404).json({ message: 'No students found for this slot.' });
        }
        const presentRegNos = attendanceRecord ? attendanceRecord.present : [];
        const reportData = allStudents.map(student => ({
            'Registration Number': student.regNo,
            'Name': student.name,
            'Status': presentRegNos.includes(student.regNo) ? 'Present' : 'Absent'
        }));
        const worksheet = xlsx.utils.json_to_sheet(reportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Attendance');
        const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Disposition', `attachment; filename="Attendance-${mainSlot}-${individualSlot}-${date}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('Error generating attendance report:', err);
        res.status(500).json({ message: 'Server error while generating report.' });
    }
});

// ============= Get today's attendance =============

router.get('/today-attendance', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({ date: today, createdBy: req.userId });

    if (!attendance) {
      return res.status(404).json({ message: 'No attendance record found for today' });
    }

    const presentRegNos = attendance.present;
    const students = await Student.find({ createdBy: req.userId, regNo: { $in: presentRegNos } }).select('-password');

    const reportData = students.map(student => ({
      'Registration Number': student.regNo,
      'Name': student.name,
      'Status': 'Present'
    }));

    const worksheet = xlsx.utils.json_to_sheet(reportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Today\'s Attendance');

    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename="Today's-Attendance-${today}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error fetching today\'s attendance:', err);
    res.status(500).json({ message: 'Server error while fetching today\'s attendance' });
  }
});

// ============= LIVE ATTENDANCE COUNT =============
router.get('/attendance-live-count', verifyToken, async (req, res) => {
  try {
    const { mainSlot, individualSlot } = req.query;
    if (!mainSlot || !individualSlot) {
      return res.status(400).json({ message: 'mainSlot and individualSlot are required.' });
    }
    const today = new Date().toISOString().split('T')[0];
    // Get all students in this main slot
    const students = await Student.find({
      mainSlot,
      createdBy: req.userId
    });
    const total = students.length;
    // Get today's attendance record
    const attendance = await Attendance.findOne({
      mainSlot,
      individualSlot,
      date: today,
      createdBy: req.userId
    });
    const presentRegNos = attendance ? attendance.present : [];
    const present = presentRegNos.length;
    const absent = total - present;
    res.json({ total, present, absent });
  } catch (err) {
    console.error('Error fetching live attendance count:', err);
    res.status(500).json({ message: 'Server error while fetching live attendance count.' });
  }
});

module.exports = router;
