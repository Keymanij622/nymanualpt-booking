require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER || 'hewidypt@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS; // Gmail App Password

// Google Calendar configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'hewidypt@gmail.com';

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize bookings file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ bookings: [] }, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());

// Email transporter (Gmail)
let transporter = null;
if (EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
  console.log('Email notifications enabled');
} else {
  console.log('Email notifications disabled (no EMAIL_PASS set)');
}

// Google Calendar OAuth2 client
let calendar = null;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  console.log('Google Calendar integration enabled');
} else {
  console.log('Google Calendar integration disabled (missing credentials)');
}

// Helper: Send email notification
async function sendEmailNotification(booking) {
  if (!transporter) return;

  const appointmentDate = new Date(booking.start);
  const dateStr = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = appointmentDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  // Email to clinic owner
  const ownerEmail = {
    from: EMAIL_USER,
    to: EMAIL_USER,
    subject: `New Appointment: ${booking.name} - ${dateStr}`,
    html: `
      <h2>New Appointment Booked</h2>
      <p><strong>Patient:</strong> ${booking.name}</p>
      <p><strong>Email:</strong> ${booking.email}</p>
      <p><strong>Phone:</strong> ${booking.phone || 'Not provided'}</p>
      <p><strong>Location:</strong> ${booking.location || 'Not specified'}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Time:</strong> ${timeStr}</p>
      <hr>
      <p><small>Booking ID: ${booking.id}</small></p>
    `
  };

  // Confirmation email to patient
  const patientEmail = {
    from: EMAIL_USER,
    to: booking.email,
    subject: `Appointment Confirmed - NY Manual PT`,
    html: `
      <h2>Your Appointment is Confirmed!</h2>
      <p>Hi ${booking.name},</p>
      <p>Your appointment at New York Manual Physical Therapy has been confirmed.</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Time:</strong> ${timeStr}</p>
      <p><strong>Location:</strong> ${booking.location || '5608 New Utrecht Avenue, Brooklyn, NY 11219'}</p>
      <hr>
      <p>If you need to reschedule or cancel, please call us at <strong>(929) 705-0376</strong>.</p>
      <p>We look forward to seeing you!</p>
      <p>— NY Manual PT Team</p>
    `
  };

  try {
    await transporter.sendMail(ownerEmail);
    console.log(`Email sent to clinic: ${EMAIL_USER}`);
    await transporter.sendMail(patientEmail);
    console.log(`Confirmation email sent to patient: ${booking.email}`);
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

// Helper: Add event to Google Calendar
async function addToGoogleCalendar(booking) {
  if (!calendar) return;

  const startTime = new Date(booking.start);
  const endTime = new Date(startTime.getTime() + 20 * 60000); // 20 min appointment

  const event = {
    summary: `PT Appointment: ${booking.name}`,
    description: `Patient: ${booking.name}\nEmail: ${booking.email}\nPhone: ${booking.phone || 'N/A'}\nLocation: ${booking.location || 'N/A'}\n\nBooking ID: ${booking.id}`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/New_York'
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/New_York'
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 30 }
      ]
    }
  };

  try {
    const result = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      resource: event
    });
    console.log(`Google Calendar event created: ${result.data.htmlLink}`);
    return result.data.id;
  } catch (err) {
    console.error('Google Calendar error:', err.message);
  }
}

// Helper: Load bookings from file
function loadBookings() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data).bookings || [];
  } catch (err) {
    return [];
  }
}

// Helper: Save bookings to file
function saveBookings(bookings) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ bookings }, null, 2));
}

// Helper: Generate time slots for a given date (in EST/EDT - New York timezone)
function generateSlots(dateStr) {
  // Parse the date and check day of week
  const [year, month, day] = dateStr.split('-').map(Number);
  const checkDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // noon UTC to safely get day
  const dayOfWeek = checkDate.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  // Open Sunday-Thursday (0-4), Closed Friday (5) and Saturday (6)
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    return [];
  }

  const slots = [];
  
  // Business hours: 10 AM - 6 PM EST/EDT (New York)
  // Slot duration: 20 minutes
  const startHour = 10;
  const endHour = 18;
  const slotDurationMinutes = 20;

  // Determine if date is in DST (rough check for US)
  // DST: 2nd Sunday in March to 1st Sunday in November
  const janDate = new Date(Date.UTC(year, 0, 1));
  const julDate = new Date(Date.UTC(year, 6, 1));
  const stdOffset = Math.max(janDate.getTimezoneOffset(), julDate.getTimezoneOffset());
  
  // For NY: EST = UTC-5, EDT = UTC-4
  // Check if the date falls in DST period
  const marchSecondSun = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7));
  const novFirstSun = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7));
  
  const isDST = checkDate >= marchSecondSun && checkDate < novFirstSun;
  const utcOffset = isDST ? 4 : 5; // EDT = UTC-4, EST = UTC-5

  // Generate slots in UTC that correspond to 10 AM - 6 PM New York time
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += slotDurationMinutes) {
      const slotStartUTC = new Date(Date.UTC(year, month - 1, day, hour + utcOffset, min, 0));
      const slotEndUTC = new Date(slotStartUTC.getTime() + slotDurationMinutes * 60000);
      
      // Make sure we don't go past 6 PM
      const endHourLocal = (slotEndUTC.getUTCHours() - utcOffset + 24) % 24;
      const endMinLocal = slotEndUTC.getUTCMinutes();
      if (endHourLocal < endHour || (endHourLocal === endHour && endMinLocal === 0)) {
        slots.push({
          start: slotStartUTC.toISOString(),
          end: slotEndUTC.toISOString()
        });
      }
    }
  }

  return slots;
}

// Helper: Check if a slot is already booked
function isSlotBooked(slotStart, bookings) {
  return bookings.some(booking => booking.start === slotStart);
}

// GET /slots?date=YYYY-MM-DD
app.get('/slots', (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const allSlots = generateSlots(date);
  const bookings = loadBookings();

  // Filter out booked slots
  const availableSlots = allSlots.filter(slot => !isSlotBooked(slot.start, bookings));

  res.json(availableSlots);
});

// POST /book
app.post('/book', (req, res) => {
  const { start, name, email, phone, location } = req.body;

  // Validate required fields
  if (!start || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields: start, name, email' });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const bookings = loadBookings();

  // Check if slot is already booked
  if (isSlotBooked(start, bookings)) {
    return res.status(409).json({ error: 'This time slot is no longer available' });
  }

  // Create booking
  const booking = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    start,
    name,
    email,
    phone: phone || '',
    location: location || '',
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  saveBookings(bookings);

  console.log(`New booking: ${name} - ${new Date(start).toLocaleString()}`);

  // Send email notification (async, don't wait)
  sendEmailNotification(booking).catch(err => console.error('Email failed:', err));

  // Add to Google Calendar (async, don't wait)
  addToGoogleCalendar(booking).catch(err => console.error('Calendar failed:', err));

  res.status(201).json({
    success: true,
    message: 'Booking confirmed',
    booking: {
      id: booking.id,
      start: booking.start,
      name: booking.name
    }
  });
});

// GET /bookings - Admin endpoint to view all bookings
app.get('/bookings', (req, res) => {
  const bookings = loadBookings();
  res.json(bookings);
});

// DELETE /bookings/:id - Cancel a booking
app.delete('/bookings/:id', (req, res) => {
  const { id } = req.params;
  let bookings = loadBookings();
  
  const index = bookings.findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  bookings.splice(index, 1);
  saveBookings(bookings);

  res.json({ success: true, message: 'Booking cancelled' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Booking server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /slots?date=YYYY-MM-DD  - Get available slots`);
  console.log(`  POST /book                   - Create a booking`);
  console.log(`  GET  /bookings               - View all bookings`);
  console.log(`  DELETE /bookings/:id         - Cancel a booking`);
});
