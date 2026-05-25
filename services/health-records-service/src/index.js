const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');
const morgan     = require('morgan');
const router     = require('./routes/index');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { MedicalRecord, Appointment } = require('./models/models');

dotenv.config();

const app         = express();
const PORT        = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-health-agent';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', router);

// ─── 404 & Error ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── DB + Seed + Start ───────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('[health-records-service] Connected to MongoDB');

    if ((await MedicalRecord.countDocuments()) === 0) {
      await MedicalRecord.insertMany([
        {
          date: '2026-05-10', category: 'Allergy',
          title: 'Penicillin Allergy',
          description: 'Develops hives and swelling upon ingestion.',
          notes: 'Flagged in all prescriptions.',
        },
        {
          date: '2026-05-18', category: 'Diagnosis',
          title: 'Stage I Hypertension',
          description: 'Identified elevated resting blood pressure readings (138/89). Recommended lifestyle changes.',
          notes: 'Resting BP checked twice daily.',
        },
      ]);
      console.log('[health-records-service] Seeded default Medical Records');
    }

    if ((await Appointment.countDocuments()) === 0) {
      await Appointment.insertMany([
        {
          dateTime: '2026-06-15T10:00:00.000Z',
          provider: 'Jane Foster', specialty: 'Cardiology',
          purpose: 'Hypertension follow-up check and medication review.',
          status: 'Scheduled', notes: 'Bring BP history log.',
        },
      ]);
      console.log('[health-records-service] Seeded default Appointments');
    }

    app.listen(PORT, () =>
      console.log(`[health-records-service] Running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error('[health-records-service] DB connection failed:', err.message);
    process.exit(1);
  });
