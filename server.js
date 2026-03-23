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
const CLINIC_EMAIL = process.env.CLINIC_EMAIL || 'hewidypt@gmail.com';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

// Google Calendar configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'hewidypt@gmail.com';

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');
const INQUIRY_FILE = path.join(__dirname, 'data', 'inquiries.json');
const QUIZ_FILE = path.join(__dirname, 'data', 'quiz-submissions.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize bookings file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ bookings: [] }, null, 2));
}

// Initialize inquiries file if it doesn't exist
if (!fs.existsSync(INQUIRY_FILE)) {
  fs.writeFileSync(INQUIRY_FILE, JSON.stringify({ inquiries: [] }, null, 2));
}

// Initialize quiz submissions file if it doesn't exist
if (!fs.existsSync(QUIZ_FILE)) {
  fs.writeFileSync(QUIZ_FILE, JSON.stringify({ submissions: [] }, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());

// Lightweight health check for uptime monitoring and warm-up pings
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

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
function confirmationEmailHTML(name, date, program, reason) {
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
                  <tr>
                    <td><strong>Program</strong></td>
                    <td>${program || '—'}</td>
                  </tr>
                  <tr>
                    <td><strong>Reason for Visit</strong></td>
                    <td>${reason || '—'}</td>
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
function adminNotificationHTML(name, email, phone, date, location, program, reason) {
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
      <tr>
        <td><strong>Program:</strong></td>
        <td>${program || '—'}</td>
      </tr>
      <tr>
        <td><strong>Reason for Visit:</strong></td>
        <td>${reason || '—'}</td>
      </tr>
    </table>
  </div>
  `;
}

// Helper: Generate generic inquiry notification HTML
function inquiryNotificationHTML(inquiry) {
  const submittedAt = new Date().toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
  });

  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#0d6e6e; margin-top:0;">New Website Inquiry</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Name:</strong></td>
        <td style="border-bottom:1px solid #eee;">${inquiry.name}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Email:</strong></td>
        <td style="border-bottom:1px solid #eee;">${inquiry.email || '—'}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Phone:</strong></td>
        <td style="border-bottom:1px solid #eee;">${inquiry.phone || '—'}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Main Concern:</strong></td>
        <td style="border-bottom:1px solid #eee;">${inquiry.mainConcern || '—'}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Preferred Timing:</strong></td>
        <td style="border-bottom:1px solid #eee;">${inquiry.preferredTiming || '—'}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Message:</strong></td>
        <td style="border-bottom:1px solid #eee; white-space:pre-wrap;">${inquiry.message || '—'}</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #eee;"><strong>Source Page:</strong></td>
        <td style="border-bottom:1px solid #eee;">${inquiry.sourcePage || '—'}</td>
      </tr>
      <tr>
        <td><strong>Submitted:</strong></td>
        <td>${submittedAt}</td>
      </tr>
    </table>
  </div>
  `;
}

function quizNotificationHTML(submission) {
  const submittedAt = new Date(submission.createdAt || Date.now()).toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
  });

  const rows = [
    ['Name', escapeHtml(submission.fullName)],
    ['Email', submission.email ? `<a href="mailto:${escapeHtml(submission.email)}">${escapeHtml(submission.email)}</a>` : '—'],
    ['Phone', escapeHtml(submission.phone || '—')],
    ['Pain Rating', escapeHtml(submission.painLevel || '—')],
    ['Pain Type', escapeHtml(submission.painType || '—')],
    ['How It Started', escapeHtml(submission.cause || '—')],
    ['How Long', escapeHtml(submission.duration || '—')],
    ['Preferred Day', escapeHtml(submission.preferredDay || '—')],
    ['Preferred Time', escapeHtml(submission.preferredTime || '—')],
    ['Same-Day Requested', submission.sameDayRequested ? 'Yes' : 'No'],
    ['Source Page', escapeHtml(submission.sourcePage || '—')],
    ['Submitted', escapeHtml(submittedAt)]
  ].map(([label, value], index, arr) => `
      <tr>
        <td style="${index < arr.length - 1 ? 'border-bottom:1px solid #eee;' : ''}"><strong>${label}:</strong></td>
        <td style="${index < arr.length - 1 ? 'border-bottom:1px solid #eee;' : ''}">${value}</td>
      </tr>
  `).join('');

  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#0d6e6e; margin-top:0;">New Pain Quiz Submission</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; max-width:720px;">
      ${rows}
    </table>
  </div>
  `;
}

function quizConfirmationEmailHTML(submission) {
  const year = new Date().getFullYear();

  return `
  <div style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="background:#0d6e6e; padding:20px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size:24px;">NY Manual Physical Therapy</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <h2 style="margin-top:0; color:#0d6e6e;">We Received Your Pain Quiz</h2>
                <p>Hi ${escapeHtml(submission.fullName)},</p>
                <p>Thank you. Your preferred visit request was received by NY Manual Physical Therapy.</p>

                <table cellpadding="10" cellspacing="0" style="background:#f9f9f9; border-radius:6px; width:100%; margin:20px 0;">
                  <tr>
                    <td><strong>Preferred Day</strong></td>
                    <td>${escapeHtml(submission.preferredDay || '—')}</td>
                  </tr>
                  <tr>
                    <td><strong>Preferred Time</strong></td>
                    <td>${escapeHtml(submission.preferredTime || '—')}</td>
                  </tr>
                  <tr>
                    <td><strong>Same-Day Requested</strong></td>
                    <td>${submission.sameDayRequested ? 'Yes' : 'No'}</td>
                  </tr>
                  <tr>
                    <td><strong>Requested Appointment Slot</strong></td>
                    <td>${escapeHtml(submission.preferredDay || '—')} | ${escapeHtml(submission.preferredTime || '—')}</td>
                  </tr>
                </table>

                <p style="margin-top:20px;">If you need immediate help or want to talk with the clinic directly, call <strong>(929) 705-0376</strong>.</p>

                <p style="margin-top:20px;">
                  <a href="https://newyorkmanualpt.com/booking.html"
                     style="display:inline-block; background:#0d6e6e; color:#ffffff; padding:12px 20px; border-radius:4px; text-decoration:none; font-weight:bold;">
                     View Booking Page
                  </a>
                </p>

                <p style="margin-top:20px;">
                  —<br />
                  <strong>NY Manual Physical Therapy</strong>
                </p>
              </td>
            </tr>
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

function bookingToQuizSubmission(booking) {
  const reasonParts = String(booking.reason || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\n|\|/)
    .map((part) => part.trim())
    .filter(Boolean);
  const readPart = (label) => {
    const match = reasonParts.find((part) => part.toLowerCase().startsWith(label.toLowerCase() + ':'));
    return match ? match.split(':').slice(1).join(':').trim() : '';
  };

  return {
    fullName: booking.name || '',
    email: booking.email || '',
    phone: booking.phone || '',
    painLevel: readPart('Pain level'),
    painType: readPart('Pain type'),
    cause: readPart('Cause'),
    duration: readPart('Duration'),
    preferredDay: readPart('Preferred day'),
    preferredTime: readPart('Preferred time'),
    sameDayRequested: readPart('Same-day requested').toLowerCase() === 'yes',
    sourcePage: 'index.html',
    createdAt: booking.createdAt || new Date().toISOString(),
    worsens: [],
    treatmentsTried: []
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper: Send email notification
async function sendEmailNotification(booking) {
  if (!resend) return;

  try {
    const isQuizRequest = booking.program === 'Pain Quiz Request' || booking.program === 'Pain Quiz Submission';

    // Email to clinic owner
    await resend.emails.send({
      from: isQuizRequest
        ? `NY Manual PT Quiz <${RESEND_FROM_EMAIL}>`
        : `NY Manual PT Booking <${RESEND_FROM_EMAIL}>`,
      to: CLINIC_EMAIL,
      subject: isQuizRequest
        ? `New Pain Quiz: ${booking.name}`
        : `New Appointment: ${booking.name}`,
      html: isQuizRequest
        ? quizNotificationHTML(bookingToQuizSubmission(booking))
        : adminNotificationHTML(
            booking.name,
            booking.email,
            booking.phone,
            booking.start,
            booking.location,
            booking.program,
            booking.reason
          )
    });
    console.log(`Email sent to clinic: ${CLINIC_EMAIL}`);

    // Confirmation email to patient
    await resend.emails.send({
      from: `NY Manual Physical Therapy <${RESEND_FROM_EMAIL}>`,
      to: booking.email,
      subject: isQuizRequest
        ? `We Received Your Pain Quiz - NY Manual PT`
        : `Your Appointment is Confirmed - NY Manual PT`,
      html: isQuizRequest
        ? quizConfirmationEmailHTML(bookingToQuizSubmission(booking))
        : confirmationEmailHTML(
            booking.name,
            booking.start,
            booking.program,
            booking.reason
          )
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
    description: `Patient: ${booking.name}\nEmail: ${booking.email}\nPhone: ${booking.phone || 'N/A'}\nLocation: ${booking.location || 'N/A'}\nProgram: ${booking.program || 'N/A'}\nReason: ${booking.reason || 'N/A'}\n\nBooking ID: ${booking.id}`,
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

// Helper: Load inquiries from file
function loadInquiries() {
  try {
    const data = fs.readFileSync(INQUIRY_FILE, 'utf8');
    return JSON.parse(data).inquiries || [];
  } catch (err) {
    return [];
  }
}

// Helper: Save inquiries to file
function saveInquiries(inquiries) {
  fs.writeFileSync(INQUIRY_FILE, JSON.stringify({ inquiries }, null, 2));
}

function loadQuizSubmissions() {
  try {
    const data = fs.readFileSync(QUIZ_FILE, 'utf8');
    return JSON.parse(data).submissions || [];
  } catch (err) {
    return [];
  }
}

function saveQuizSubmissions(submissions) {
  fs.writeFileSync(QUIZ_FILE, JSON.stringify({ submissions }, null, 2));
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
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

function hasBookingConflict(startIso, bookings, durationMinutes = 20) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  return bookings.some((booking) => {
    const existingStart = new Date(booking.start);
    const existingEnd = booking.end
      ? new Date(booking.end)
      : new Date(existingStart.getTime() + durationMinutes * 60000);
    return start < existingEnd && end > existingStart;
  });
}

function getNYTimeParts(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    weekday: map.weekday || '',
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0)
  };
}

function isClinicClosed(date) {
  const { weekday } = getNYTimeParts(date);
  return weekday === 'Fri' || weekday === 'Sat';
}

function isWithinBusinessHours(date) {
  const { hour, minute } = getNYTimeParts(date);
  const minutes = hour * 60 + minute;
  // Open 10:00 through 17:59 New York time.
  return minutes >= 10 * 60 && minutes < 18 * 60;
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
  const now = new Date();

  // Filter out booked slots
  const availableSlots = allSlots.filter(slot => {
    if (new Date(slot.start) <= now) return false;
    return !isSlotBooked(slot.start, bookings);
  });

  res.json(availableSlots);
});

// POST /book
app.post('/book', (req, res) => {
  const { start, name, email, phone, location, program, reason } = req.body;

  // Validate required fields
  if (!start || !name || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields: start, name, email, phone' });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return res.status(400).json({ error: 'Invalid start date/time' });
  }

  // Prevent booking slots that already passed
  if (startDate <= new Date()) {
    return res.status(400).json({ error: 'Cannot book a time slot in the past' });
  }

  if (isClinicClosed(startDate)) {
    return res.status(400).json({ error: 'Clinic is closed on Fridays and Saturdays' });
  }

  if (!isWithinBusinessHours(startDate)) {
    return res.status(400).json({ error: 'Please choose a time between 10:00 AM and 6:00 PM (New York time)' });
  }

  const bookings = loadBookings();

  // Check if booking overlaps with an existing appointment
  if (hasBookingConflict(startDate.toISOString(), bookings)) {
    return res.status(409).json({ error: 'This time conflicts with another booking' });
  }

  // Create booking
  const booking = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    start: startDate.toISOString(),
    end: new Date(startDate.getTime() + 20 * 60000).toISOString(),
    name,
    email,
    phone: String(phone).trim(),
    location: location || '',
    program: program || '',
    reason: reason || '',
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

// POST /inquiry
app.post('/inquiry', async (req, res) => {
  const { name, email, phone, mainConcern, preferredTiming, message, sourcePage } = req.body || {};

  if (!name || (!email && !phone)) {
    return res.status(400).json({ error: 'Missing required fields: name and either email or phone' });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const inquiry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name,
    email: email || '',
    phone: phone || '',
    mainConcern: mainConcern || '',
    preferredTiming: preferredTiming || '',
    message: message || '',
    sourcePage: sourcePage || '',
    createdAt: new Date().toISOString(),
    emailStatus: 'pending'
  };

  const inquiries = loadInquiries();
  inquiries.push(inquiry);
  saveInquiries(inquiries);

  if (!resend) {
    inquiry.emailStatus = 'not-configured';
    saveInquiries(inquiries);
    return res.status(202).json({
      success: true,
      message: 'Inquiry saved, but email delivery is not configured on the server yet.'
    });
  }

  try {
    await resend.emails.send({
      from: `NY Manual PT Website <${RESEND_FROM_EMAIL}>`,
      to: CLINIC_EMAIL,
      subject: `New Inquiry: ${inquiry.name}`,
      html: inquiryNotificationHTML(inquiry)
    });

    inquiry.emailStatus = 'sent';
    saveInquiries(inquiries);

    res.status(201).json({ success: true, message: 'Inquiry sent' });
  } catch (err) {
    console.error('Inquiry email error:', err.message);
    inquiry.emailStatus = `failed: ${err.message}`;
    saveInquiries(inquiries);
    res.status(202).json({
      success: true,
      message: 'Inquiry saved, but email delivery failed. Please contact the clinic by phone if urgent.'
    });
  }
});

// POST /quiz-lead
app.post('/quiz-lead', async (req, res) => {
  const body = req.body || {};
  const submission = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    painLevel: String(body.painLevel || '').trim(),
    painType: String(body.painType || '').trim(),
    cause: String(body.cause || '').trim(),
    duration: String(body.duration || '').trim(),
    worsens: normalizeArray(body.worsens),
    treatmentsTried: normalizeArray(body.treatmentsTried),
    fullName: String(body.fullName || '').trim(),
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    preferredDay: String(body.preferredDay || '').trim(),
    preferredTime: String(body.preferredTime || '').trim(),
    sameDayRequested: Boolean(body.sameDayRequested),
    sourcePage: String(body.sourcePage || '').trim(),
    createdAt: new Date().toISOString(),
    emailStatus: 'pending'
  };

  if (!submission.fullName || !submission.email || !submission.phone) {
    return res.status(400).json({ error: 'Missing required contact fields: fullName, email, phone' });
  }

  if (!submission.painLevel || !submission.painType || !submission.duration) {
    return res.status(400).json({ error: 'Missing required quiz fields' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const submissions = loadQuizSubmissions();
  submissions.push(submission);
  saveQuizSubmissions(submissions);

  if (!resend) {
    submission.emailStatus = 'not-configured';
    saveQuizSubmissions(submissions);
    return res.status(202).json({
      success: true,
      message: 'Quiz saved, but email delivery is not configured on the server yet.'
    });
  }

  try {
    await resend.emails.send({
      from: `NY Manual PT Quiz <${RESEND_FROM_EMAIL}>`,
      to: CLINIC_EMAIL,
      subject: `New Pain Quiz: ${submission.fullName}`,
      html: quizNotificationHTML(submission)
    });

    await resend.emails.send({
      from: `NY Manual Physical Therapy <${RESEND_FROM_EMAIL}>`,
      to: submission.email,
      subject: `We Received Your Pain Quiz - NY Manual PT`,
      html: quizConfirmationEmailHTML(submission)
    });

    submission.emailStatus = 'sent';
    saveQuizSubmissions(submissions);

    res.status(201).json({ success: true, message: 'Quiz submitted successfully' });
  } catch (err) {
    console.error('Quiz email error:', err.message);
    submission.emailStatus = `failed: ${err.message}`;
    saveQuizSubmissions(submissions);
    res.status(202).json({
      success: true,
      message: 'Quiz saved, but email delivery failed. Please contact the clinic by phone if urgent.'
    });
  }
});

// GET /bookings - Admin endpoint to view all bookings
app.get('/bookings', (req, res) => {
  const bookings = loadBookings();
  res.json(bookings);
});

// GET /inquiries - Admin endpoint to view all inquiries
app.get('/inquiries', (req, res) => {
  const inquiries = loadInquiries();
  res.json(inquiries);
});

app.get('/quiz-leads', (req, res) => {
  const submissions = loadQuizSubmissions();
  res.json(submissions);
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
  console.log(`  POST /inquiry                - Send contact inquiry email`);
  console.log(`  POST /quiz-lead              - Save quiz lead + send emails`);
  console.log(`  GET  /bookings               - View all bookings`);
  console.log(`  GET  /inquiries              - View all contact inquiries`);
  console.log(`  GET  /quiz-leads             - View all quiz submissions`);
  console.log(`  DELETE /bookings/:id         - Cancel a booking`);
});


  
                  
            

        

