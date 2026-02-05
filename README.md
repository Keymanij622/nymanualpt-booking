# NY Manual PT Booking Server

Node.js/Express backend with email notifications and Google Calendar integration.

## Features

- **GET /slots?date=YYYY-MM-DD** — Returns available time slots
- **POST /book** — Creates booking + sends emails + adds to Google Calendar
- **GET /bookings** — View all bookings (admin)
- **DELETE /bookings/:id** — Cancel a booking
- **Email notifications** — Sends confirmation to patient + notification to clinic
- **Google Calendar** — Automatically adds appointments to your calendar

---

## Setup

### 1. Create `.env` file

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 2. Gmail App Password (Required for Email)

Gmail requires an "App Password" (not your regular password):

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already on
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Select "Mail" and "Other (Custom name)" → name it "NY Manual PT"
5. Copy the 16-character password
6. Paste it as `EMAIL_PASS` in your `.env` file

### 3. Google Calendar Setup (Optional but Recommended)

To add appointments to your Google Calendar automatically:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable **Google Calendar API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized redirect URIs: `https://developers.google.com/oauthplayground`
5. Copy Client ID and Client Secret to `.env`
6. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
   - Click gear icon → Check "Use your own OAuth credentials"
   - Enter your Client ID and Secret
   - Select `https://www.googleapis.com/auth/calendar`
   - Authorize and get your **Refresh Token**
7. Add the Refresh Token to `.env`

---

## Deploy to Render.com (Recommended)

Hostinger shared hosting doesn't run Node.js. Use Render.com (free tier):

1. Push `booking-server` folder to GitHub
2. Go to [render.com](https://render.com) → New **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add **Environment Variables** (from your `.env`):
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
   - `GOOGLE_CALENDAR_ID`
6. Deploy!

You'll get a URL like `https://nymanualpt-booking.onrender.com`

### Update Your Website

In `booking.html`, change line 131:

```javascript
const API = "https://nymanualpt-booking.onrender.com";
```

Then upload your HTML files to Hostinger as usual.

---

## Business Hours

- **Open:** Sunday – Thursday
- **Hours:** 10 AM – 6 PM
- **Slot Duration:** 20 minutes
- **Closed:** Fridays & Saturdays

Edit `server.js` to change these settings.

---

## Testing Locally

```bash
cd booking-server
npm install
npm start
```

Server runs at `http://localhost:3000`
