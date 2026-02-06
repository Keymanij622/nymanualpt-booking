require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Email configuration (Resend)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CLINIC_EMAIL = 'hewidypt@gmail.com';

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

// Resend email client
let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('Email notifications enabled (Resend)');
} else {
  console.log('Email notifications disabled (no RESEND_API_KEY set)');
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
  const brand = '#14b8a6';

  return `
  <div style="font-family: 'Arial', sans-serif; background:#f1f5f9; padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0;">
            <!-- Header -->
            <tr>
              <td style="background:#f8fafc; padding:28px; text-align:center; border-bottom:1px solid #e2e8f0;">
                <div style="display:inline-flex; align-items:center; gap:10px; font-weight:700; font-size:18px; letter-spacing:0.08em; text-transform:uppercase; color:#0f172a;">
                  <span style="display:inline-block; width:12px; height:12px; border-radius:999px; background:${brand};"></span>
                  NY Manual PT
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 36px; color:#0f172a;">
                <div style="text-align:center; margin-bottom:24px;">
                  <div style="width:48px; height:48px; margin:0 auto 16px; border-radius:999px; background:#ecfdf5; color:${brand}; font-size:28px; line-height:48px;">✓</div>
                  <h1 style="margin:0 0 8px; font-size:20px; font-weight:600;">Appointment Confirmed</h1>
                  <p style="margin:0; color:#475569; font-size:14px; line-height:1.6;">Hi ${name}, your appointment with <strong style="color:#0f172a;">NY Manual PT</strong> has been successfully booked. We look forward to seeing you.</p>
                </div>

                <!-- Appointment Card -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:24px;">
                  <div style="display:flex; align-items:flex-start; gap:12px;">
                    <div style="color:#94a3b8; font-size:18px; line-height:1;">📅</div>
                    <div>
                      <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.08em; color:#94a3b8; text-transform:uppercase;">Date & Time</p>
                      <p style="margin:0; font-size:14px; font-weight:600; color:#0f172a;">${dateTimeStr}</p>
                    </div>
                  </div>
                  <div style="height:1px; background:#e2e8f0; margin:16px 0;"></div>
                  <div style="display:flex; align-items:flex-start; gap:12px;">
                    <div style="color:#94a3b8; font-size:18px; line-height:1;">📍</div>
                    <div>
                      <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.08em; color:#94a3b8; text-transform:uppercase;">Location</p>
                      <p style="margin:0; font-size:14px; font-weight:600; color:#0f172a;">NY Manual PT</p>
                      <p style="margin:2px 0 0; font-size:13px; color:#475569;">5608 New Utrecht Avenue, Brooklyn, NY 11219</p>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <a href="https://newyorkmanualpt.com" style="display:block; width:100%; background:#0f172a; color:#ffffff; text-align:center; padding:12px 0; border-radius:10px; font-size:14px; font-weight:600; text-decoration:none;">Visit Our Website</a>

                <div style="margin-top:24px; text-align:center; border-top:1px solid #e2e8f0; padding-top:18px;">
                  <p style="margin:0 0 6px; font-size:12px; color:#64748b;">Need to reschedule?</p>
                  <p style="margin:0; font-size:12px; color:#94a3b8;">Please contact us at least 24 hours in advance. Call us at <a href="tel:9297050376" style="color:#475569; text-decoration:underline;">(929) 705-0376</a>.</p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f8fafc; padding:16px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0;">
                © ${year} NY Manual PT · <a href="https://newyorkmanualpt.com" style="color:${brand}; text-decoration:none;">newyorkmanualpt.com</a>
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
  const brand = '#14b8a6';

  return `
  <div style="font-family: 'Arial', sans-serif; background:#f1f5f9; padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0;">
            <tr>
              <td style="background:${brand}; padding:20px 24px; display:flex; align-items:center; justify-content:space-between; color:#ffffff;">
                <span style="font-weight:700; text-transform:uppercase; letter-spacing:0.08em; font-size:14px;">NY Manual PT Admin</span>
                <span style="background:rgba(255,255,255,0.2); color:#ffffff; font-size:10px; font-weight:700; padding:4px 8px; border-radius:999px; text-transform:uppercase;">New Booking</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <h1 style="margin:0 0 6px; font-size:18px; color:#0f172a;">New Appointment Request</h1>
                <p style="margin:0 0 20px; font-size:13px; color:#64748b;">A new booking has been made via the website.</p>

                <div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; margin-bottom:20px;">
                  <div style="background:#f8fafc; padding:10px 14px; border-bottom:1px solid #e2e8f0; font-size:11px; font-weight:600; color:#64748b; letter-spacing:0.08em; text-transform:uppercase;">Patient Details</div>
                  <div style="padding:14px;">
                    <p style="margin:0 0 10px; font-size:14px; font-weight:600; color:#0f172a;">${name}</p>
                    <table cellpadding="6" cellspacing="0" style="width:100%; font-size:13px; color:#475569;">
                      <tr>
                        <td>Email</td>
                        <td><a href="mailto:${email}" style="color:#0f172a; text-decoration:none;">${email}</a></td>
                      </tr>
                      <tr>
                        <td>Phone</td>
                        <td>${phone || '—'}</td>
                      </tr>
                    </table>
                  </div>
                </div>

                <div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                  <div style="background:#f8fafc; padding:10px 14px; border-bottom:1px solid #e2e8f0; font-size:11px; font-weight:600; color:#64748b; letter-spacing:0.08em; text-transform:uppercase;">Appointment Info</div>
                  <table cellpadding="10" cellspacing="0" style="width:100%; font-size:13px; color:#0f172a;">
                    <tr style="border-bottom:1px solid #e2e8f0;">
                      <td style="color:#64748b; width:30%;">Date & Time</td>
                      <td style="font-weight:600;">${dateTimeStr}</td>
                    </tr>
                    <tr>
                      <td style="color:#64748b;">Location</td>
                      <td style="font-weight:600;">${location || '—'}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc; padding:12px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0;">
                System Notification
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}

// Helper: Send email notification
async function sendEmailNotification(booking) {
  if (!resend) return;

  try {
    // Email to clinic owner
    await resend.emails.send({
      from: 'NY Manual PT Booking <onboarding@resend.dev>',
      to: CLINIC_EMAIL,
      subject: `New Appointment: ${booking.name}`,
      html: adminNotificationHTML(booking.name, booking.email, booking.phone, booking.start, booking.location)
    });
    console.log(`Email sent to clinic: ${CLINIC_EMAIL}`);

    // Confirmation email to patient
    await resend.emails.send({
      from: 'NY Manual Physical Therapy <onboarding@resend.dev>',
      to: booking.email,
      subject: `Your Appointment is Confirmed - NY Manual PT`,
      html: confirmationEmailHTML(booking.name, booking.start)
    });
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
