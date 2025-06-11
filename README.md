# Geo-Attendance-System

Geo-Attendance-System is a location-based attendance tracking system. It allows teachers to set attendance locations, and students can mark attendance only when they are physically present within the defined geofence area.

This project includes two separate dashboards:
- **Teacher Dashboard:** For adding students, setting attendance radius, viewing slots and students, and downloading attendance.
- **Student Dashboard:** For logging in, checking allowed status based on location, and marking attendance.

---

## Features

### Teacher Panel:
- Secure login for teachers (admin created accounts).
- Add students manually or via Excel file upload.
- Assign multiple slots to students.
- Define location radius and time slots for attendance.
- View students by slots.
- Delete individual students or entire slots.
- Download present and absent student lists in Excel format.

### Student Panel:
- Secure login for students.
- Location access validation.
- Display assigned slots dynamically.
- Allow attendance marking only if within the allowed radius and time.
- Display student’s current latitude and longitude.
- Responsive UI for mobile and desktop devices.

---

## Tech Stack

- Backend: Node.js, Express.js
- Database: MongoDB Atlas
- Frontend: HTML, CSS, JavaScript 
- Deployment : Render 
- File upload: Multer (for Excel sheets)
- Authentication: JWT (JSON Web Tokens)
- Excel Processing: XLSX package

