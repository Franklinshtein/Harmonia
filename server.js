// ============================================
// BOOKING SYSTEM BACKEND - server.js
// ============================================
// This file handles appointment bookings for the clinic website
// It checks availability, saves bookings, and sends email notifications

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();
const PORT = 3000;

// Middleware - allows the server to understand JSON and handle cross-origin requests
app.use(cors()); // Allows frontend to communicate with backend
app.use(express.json()); // Allows reading JSON data from requests

// ============================================
// FILE PATHS - Where we store booking data
// ============================================
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Create bookings file if it doesn't exist
if (!fs.existsSync(BOOKINGS_FILE)) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify({ bookings: [] }, null, 2));
}

// ============================================
// EMAIL CONFIGURATION
// ============================================
// Configure email settings - IMPORTANT: Replace with real credentials
const emailConfig = {
  service: 'gmail', // or 'outlook', 'yahoo', etc.
  auth: {
    user: 'xgod7x@gmail.com', // REPLACE with your clinic email
    pass: 'tnuv vwkc vpky wres'      // REPLACE with your app password (NOT regular password)
  }
};

// Create email transporter
const transporter = nodemailer.createTransport(emailConfig);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Read all bookings from file
 */
function readBookings() {
  try {
    const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading bookings:', error);
    return { bookings: [] };
  }
}

/**
 * Save bookings to file
 */
function saveBookings(data) {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving bookings:', error);
    return false;
  }
}

/**
 * Check if a time slot is available
 */
function isTimeSlotAvailable(date, time) {
  const data = readBookings();
  
  // Check if there's already a booking for this date and time
  const existingBooking = data.bookings.find(
    booking => booking.date === date && booking.time === time
  );
  
  return !existingBooking; // Returns true if slot is free
}

/**
 * Send email notification to clinic
 */
async function sendClinicNotification(booking) {
  const mailOptions = {
    from: emailConfig.auth.user,
    to: 'harmonia.sibo@gmail.com', // Clinic email
    subject: `Nowa rezerwacja: ${booking.service}`,
    html: `
      <h2>Nowa rezerwacja wizyty</h2>
      <p><strong>Pacjent:</strong> ${booking.firstName} ${booking.lastName}</p>
      <p><strong>Email:</strong> ${booking.email}</p>
      <p><strong>Telefon:</strong> ${booking.phone}</p>
      <p><strong>Usługa:</strong> ${booking.service}</p>
      <p><strong>Data:</strong> ${booking.date}</p>
      <p><strong>Godzina:</strong> ${booking.time}</p>
      <p><strong>Cena:</strong> ${booking.price}</p>
      ${booking.notes ? `<p><strong>Notatki:</strong> ${booking.notes}</p>` : ''}
      <hr>
      <p><small>ID rezerwacji: ${booking.id}</small></p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Clinic notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending clinic notification:', error);
    return false;
  }
}

/**
 * Send confirmation email to client
 */
async function sendClientConfirmation(booking) {
  const mailOptions = {
    from: emailConfig.auth.user,
    to: booking.email,
    subject: 'Potwierdzenie rezerwacji - HARMONIA',
    html: `
      <h2>Dziękujemy za rezerwację!</h2>
      <p>Szanowny/a ${booking.firstName} ${booking.lastName},</p>
      <p>Potwierdzamy Twoją rezerwację:</p>
      <ul>
        <li><strong>Usługa:</strong> ${booking.service}</li>
        <li><strong>Data:</strong> ${booking.date}</li>
        <li><strong>Godzina:</strong> ${booking.time}</li>
        <li><strong>Cena:</strong> ${booking.price}</li>
      </ul>
      <p><strong>Adres:</strong> ul. Zacisze 16/1, 31-156 Kraków</p>
      <p>Prosimy o przybycie 5 minut przed umówioną godziną.</p>
      <p>W razie pytań prosimy o kontakt:</p>
      <ul>
        <li>Tel: 692 922 926</li>
        <li>Email: harmonia.sibo@gmail.com</li>
      </ul>
      <hr>
      <p><small>Numer rezerwacji: ${booking.id}</small></p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Client confirmation sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending client confirmation:', error);
    return false;
  }
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /api/available-times
 * Returns available time slots for a specific date
 */
app.get('/api/available-times', (req, res) => {
  const { date } = req.query;
  
  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  // All possible time slots
  const allTimeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  // Get all bookings for this date
  const data = readBookings();
  const bookedTimes = data.bookings
    .filter(booking => booking.date === date)
    .map(booking => booking.time);

  // Filter out booked times
  const availableTimes = allTimeSlots.filter(time => !bookedTimes.includes(time));

  res.json({ 
    date, 
    availableTimes,
    bookedTimes 
  });
});

/**
 * POST /api/bookings
 * Creates a new booking
 */
app.post('/api/bookings', async (req, res) => {
  const { firstName, lastName, email, phone, service, date, time, notes, price } = req.body;

  // Validation - check if all required fields are present
  if (!firstName || !lastName || !email || !phone || !service || !date || !time) {
    return res.status(400).json({ 
      error: 'Wszystkie wymagane pola muszą być wypełnione' 
    });
  }

  // Check if time slot is still available
  if (!isTimeSlotAvailable(date, time)) {
    return res.status(409).json({ 
      error: 'Ten termin jest już zajęty. Proszę wybrać inny.' 
    });
  }

  // Create new booking object
  const newBooking = {
    id: Date.now().toString(), // Simple ID based on timestamp
    firstName,
    lastName,
    email,
    phone,
    service,
    date,
    time,
    notes: notes || '',
    price: price || '',
    createdAt: new Date().toISOString()
  };

  // Save booking
  const data = readBookings();
  data.bookings.push(newBooking);
  
  if (!saveBookings(data)) {
    return res.status(500).json({ 
      error: 'Błąd podczas zapisywania rezerwacji' 
    });
  }

  // Send email notifications
  // Note: We don't wait for emails to avoid slow response
  sendClinicNotification(newBooking).catch(err => 
    console.error('Failed to send clinic notification:', err)
  );
  
  sendClientConfirmation(newBooking).catch(err => 
    console.error('Failed to send client confirmation:', err)
  );

  // Send success response
  res.status(201).json({
    success: true,
    message: 'Rezerwacja została pomyślnie utworzona',
    booking: {
      id: newBooking.id,
      date: newBooking.date,
      time: newBooking.time,
      service: newBooking.service
    }
  });
});

/**
 * GET /api/bookings
 * Returns all bookings (for admin purposes)
 */
app.get('/api/bookings', (req, res) => {
  const data = readBookings();
  res.json(data.bookings);
});

/**
 * DELETE /api/bookings/:id
 * Deletes a booking by ID (for admin purposes)
 */
app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  
  const data = readBookings();
  const bookingIndex = data.bookings.findIndex(b => b.id === id);
  
  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Rezerwacja nie znaleziona' });
  }
  
  data.bookings.splice(bookingIndex, 1);
  saveBookings(data);
  
  res.json({ success: true, message: 'Rezerwacja została usunięta' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('===========================================');
  console.log(`🚀 Booking system started!`);
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`📁 Bookings saved to: ${BOOKINGS_FILE}`);
  console.log('===========================================');
  console.log('Available endpoints:');
  console.log(`  GET    /api/available-times?date=YYYY-MM-DD`);
  console.log(`  POST   /api/bookings`);
  console.log(`  GET    /api/bookings`);
  console.log(`  DELETE /api/bookings/:id`);
  console.log('===========================================');
});
