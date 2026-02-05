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

// Email transporter (Gmail with SSL)
let transporter = null;
if (EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
  
  // Verify connection on startup
  transporter.verify(function(error, success) {
    if (error) {
      console.log('Email setup error:', error.message);
    } else {
      console.log('Email server ready');
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

// Helper: Generate patient confirmation email HTML
function confirmationEmailHTML(name, date) {
  const appointmentDate = new Date(date);
  const dateTimeStr = appointmentDate.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
  });
  const year = new Date().getFullYear();

  return `
  <div style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden;">
            
            <!-- Header -->
            <tr>
              <td style="background:#0d6e6e; padding:20px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size:24px;">NY Manual Physical Therapy</h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:#333;">
                <h2 style="margin-top:0; color:#0d6e6e;">Appointment Confirmed</h2>
                <p>Hi ${name},</p>
                <p>Your appointment has been successfully booked.</p>

                <table cellpadding="10" cellspacing="0" style="background:#f9f9f9; border-radius:6px; width:100%; margin:20px 0;">
                  <tr>
                    <td><strong>Date & Time</strong></td>
                    <td>${dateTimeStr}</td>
                  </tr>
                  <tr>
                    <td><strong>Location</strong></td>
                    <td>5608 New Utrecht Avenue, Brooklyn, NY 11219</td>
                  </tr>
                </table>

                <p style="margin-top:20px;">
                  If you need to reschedule or cancel, please contact us at <strong>(929) 705-0376</strong>.
                </p>

                <p style="margin-top:20px;">
                  <a href="https://newyorkmanualpt.com"
                     style="display:inline-block; background:#0d6e6e; color:#ffffff; padding:12px 20px; border-radius:4px; text-decoration:none; font-weight:bold;">
                     Visit Our Website
                  </a>
                </p>

                <p style="margin-top:20px;">
                  —<br />
                  <strong>NY Manual Physical Therapy</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#eeeeee; padding:15px; text-align:center; font-size:12px; color:#777;">
                © ${year} NY Manual Physical Therapy<br />
                <a href="https://newyorkmanualpt.com" style="color:#0d6e6e;">newyorkmanualpt.com</a>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}

// Helper: Generate admin notification email HTML
function adminNotificationHTML(name, email, phone, date, location) {
  const appointmentDate = new Date(date);
  const dateTimeStr = appointmentDate.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
  });

  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#0d6e6e; margin-top:0;">New Appointment Booking</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Name:</strong></td>
        <td style="border-bottom:1px solid #eee;">${name}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Email:</strong></td>
        <td style="border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Phone:</strong></td>
        <td style="border-bottom:1px solid #eee;">${phone || '—'}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Date & Time:</strong></td>
        <td style="border-bottom:1px solid #eee;">${dateTimeStr}</td>
      </tr>
      <tr>
        <td><strong>Location:</strong></td>
        <td>${location || '—'}</td>
      </tr>
    </table>
  </div>
  `;
}

// Helper: Send email notification
async function sendEmailNotification(booking) {
  if (!transporter) return;

  // Email to clinic owner
  const ownerEmail = {
    from: `"NY Manual PT Booking" <${EMAIL_USER}>`,
    to: EMAIL_USER,
    subject: `New Appointment: ${booking.name}`,
    html: adminNotificationHTML(booking.name, booking.email, booking.phone, booking.start, booking.location)
  };

  // Confirmation email to patient
  const patientEmail = {
    from: `"NY Manual Physical Therapy" <${EMAIL_USER}>`,
    to: booking.email,
    subject: `Your Appointment is Confirmed - NY Manual PT`,
    html: confirmationEmailHTML(booking.name, booking.start)
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
