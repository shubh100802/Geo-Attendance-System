# 📚 Geo-Attendance Management System

A comprehensive web-based attendance management system with geolocation verification, designed to prevent proxy attendance and ensure fair attendance tracking in educational institutions.

## 🌟 Features

### 👨‍🏫 Teacher Features

* **Secure Authentication**: Teacher login with email and password
* **Student Management**: Add individual students or bulk upload via Excel
* **Slot Management**: Create and manage multiple class slots
* **Location Settings**: Set attendance location with radius and time windows
* **Attendance Tracking**: View and manage attendance records
* **Student Removal**: Remove students from specific slots or delete completely
* **Excel Integration**: Import/export student data with proper templates
* **Responsive Dashboard**: Modern, mobile-friendly interface

### 👨‍🎓 Student Features

* **Secure Authentication**: Student login with registration number
* **Geolocation Verification**: Mark attendance with location validation
* **Time Window Compliance**: Attendance only allowed during specified time periods
* **Multi-Slot Support**: Students can be enrolled in multiple slots
* **Attendance History**: View past attendance records
* **Chrome-Only Access**: Enhanced security with browser restrictions
* **Tab Switching Protection**: Automatic logout on tab switching
* **Responsive Interface**: Mobile-friendly attendance marking

### 🔧 Technical Features

* **Real-time Geolocation**: GPS-based attendance verification
* **Time Window Validation**: Configurable attendance time periods
* **JWT Authentication**: Secure token-based authentication
* **MongoDB Database**: Scalable data storage with Mongoose ODM
* **Browser Security**: Chrome-only access enforcement
* **Tab Switching Protection**: Prevents multi-tab attendance marking
* **Responsive Design**: Works on all devices
* **Excel Integration**: Import/export functionality
* **RESTful API**: Clean API architecture

## 🚀 Quick Start

### Prerequisites

* Node.js (v18 or higher)
* MongoDB (local or Atlas)
* Google Chrome browser (required for students)
* Git

### Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/yourusername/geo-attendance-system.git
   cd geo-attendance-system
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Environment Setup**  
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/attendance-system
   JWT_SECRET=your_jwt_secret_key_here
   NODE_ENV=development
   ```

4. **Start the server**  
   ```bash
   npm start
   # or for development
   npm run dev
   ```

5. **Access the application**  
   Open `http://localhost:5000` in your browser

## 📁 Project Structure

```
attendance-app/
├── middleware/
│   ├── auth.js                 # JWT authentication middleware
│   └── browserCheck.js         # Browser validation middleware
├── models/
│   ├── Attendance.js           # Attendance records model
│   ├── AttendanceSetting.js    # Location and time settings model
│   ├── Student.js              # Student data model
│   └── User.js                 # Teacher/User model
├── public/
│   ├── css/
│   │   └── styles.css          # Main stylesheet
│   ├── index.html              # Landing page
│   ├── student_login.html      # Student login page
│   ├── student-dashboard.html  # Student attendance interface
│   ├── teacher_login.html      # Teacher login page
│   └── teacher-dashboard.html  # Teacher management interface
├── routes/
│   ├── auth.js                 # Authentication routes
│   ├── student.js              # Student API routes
│   └── teacher.js              # Teacher API routes
├── seed/
│   └── createTeacher.js        # Teacher creation script
├── package.json                # Dependencies and scripts
├── server.js                   # Main server file
└── render.yaml                 # Deployment configuration
```

## 🔐 Authentication

### Teacher Login
* **Email**: Teacher's email address
* **Password**: Set by administrator

### Student Login
* **Email**: Student's email address
* **Password**: Registration number (automatically hashed)

## 📊 Usage Guide

### For Teachers

1. **Add Students**  
   * Go to "Add Student" section
   * Enter student details (name, email, registration number, slot)
   * Or use "Upload Students" for bulk import via Excel

2. **Set Attendance Location**  
   * Navigate to "Set Location" section
   * Enter latitude, longitude, and radius
   * Set start and end time for attendance window
   * Students can only mark attendance during this period

3. **Manage Students**  
   * View all students in "View Students" section
   * Remove students from specific slots
   * Delete students completely if needed

4. **View Attendance**  
   * Check attendance records by date and slot
   * Monitor student attendance patterns

### For Students

1. **Mark Attendance**  
   * Login with registration number
   * Select your slot from dropdown
   * Allow location access when prompted
   * Click "Mark Attendance" button
   * System validates location and time window

2. **View History**  
   * Check "View History" to see past attendance records
   * View attendance status for different dates

3. **Browser Requirements**  
   * Use Google Chrome browser only
   * Enable location services
   * Don't switch tabs during attendance marking

## 🛠️ API Endpoints

### Authentication
* `POST /auth/login` - User login (teacher/student)

### Teacher Routes
* `POST /teacher/add-student` - Add individual student
* `POST /teacher/upload-students` - Bulk upload students via Excel
* `GET /teacher/students` - Get all students for teacher
* `GET /teacher/slots` - Get all slots for teacher
* `DELETE /teacher/students/:regNo` - Remove student from slot
* `DELETE /teacher/slots/:slot` - Delete all students in slot
* `POST /teacher/set-location` - Set attendance location and time
* `GET /teacher/attendance` - Get attendance records

### Student Routes
* `POST /student/validate-location` - Validate student location
* `POST /student/mark-attendance` - Mark attendance
* `GET /student/my-slot` - Get student's slots
* `GET /student/attendance-history` - Get attendance history

## 🔒 Security Features

### Browser Security
* Chrome-only access enforcement
* User agent validation
* Mobile Chrome support

### Tab Switching Protection
* Automatic logout on tab switch
* Prevents multi-tab attendance marking
* Enhanced session security

### Geolocation Security
* Real-time GPS validation
* Configurable radius settings
* Time window restrictions

## 🚀 Deployment

### Render Deployment
The application is configured for deployment on Render with the following settings:

```yaml
services:
  - type: web
    name: attendance-app
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: MONGO_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: NODE_ENV
        value: production
    nodeVersion: 18.x
```

### Environment Variables
* `MONGO_URI`: MongoDB connection string
* `JWT_SECRET`: Secret key for JWT tokens
* `NODE_ENV`: Environment (development/production)
* `PORT`: Server port (default: 5000)

## 🔧 Development

### Running in Development Mode
```bash
npm run dev
```

### Creating Teachers
```bash
node seed/createTeacher.js
```

### Database Models

#### User Model
```javascript
{
  name: String,
  username: String,
  email: String,
  password: String,
  role: 'teacher' | 'student'
}
```

#### Student Model
```javascript
{
  name: String,
  email: String,
  regNo: String,
  password: String,
  slot: [String],
  archivedSlots: [String],
  createdBy: ObjectId
}
```

#### Attendance Model
```javascript
{
  mainSlot: String,
  individualSlot: String,
  date: String,
  present: [String],
  createdBy: ObjectId
}
```

#### AttendanceSetting Model
```javascript
{
  radius: Number,
  latitude: Number,
  longitude: Number,
  startTime: String,
  endTime: String,
  mainSlot: String,
  individualSlot: String,
  createdBy: ObjectId,
  deleteAt: Date
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For any feedback or support:
* Instagram: [@itsmeshubh2026](https://www.instagram.com/itsmeshubh2026?igsh=MW51dXh1ZHc4bjY5Ng==)

## 🎯 Future Enhancements

* Email notifications for attendance
* Mobile app development
* Advanced reporting and analytics
* QR code attendance option
* Integration with existing LMS systems
* Real-time attendance monitoring
* Attendance statistics and insights
* Multi-language support

## 🔍 Troubleshooting

### Common Issues

1. **Location not working**
   - Ensure Chrome browser is used
   - Allow location permissions
   - Check if GPS is enabled on device

2. **Attendance not marking**
   - Verify time window settings
   - Check if within allowed radius
   - Ensure student is enrolled in the slot

3. **Browser compatibility**
   - Use Google Chrome only
   - Update to latest Chrome version
   - Disable other browser extensions

4. **Deployment issues**
   - Check environment variables
   - Verify MongoDB connection
   - Review server logs

---

**Built with ❤️ for Educational Institutions**

## License

This project is licensed under the MIT License - see the LICENSE file for details. 