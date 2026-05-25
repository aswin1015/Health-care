const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');
const morgan     = require('morgan');
const router     = require('./routes/index');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { Medication, Caregiver, SystemStatus } = require('./models/models');

dotenv.config();

const app         = express();
const PORT        = process.env.PORT || 5002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-health-agent';

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/', router);
app.use(notFound);
app.use(errorHandler);

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('[medication-service] Connected to MongoDB');

    if ((await Medication.countDocuments()) === 0) {
      await Medication.insertMany([
        {
          name: 'Lisinopril', dosage: '10mg', frequency: 'Daily',
          schedules: [{ time: '08:00', taken: false }, { time: '20:00', taken: false }],
          startDate: '2026-05-18',
          instructions: 'Take once with breakfast, once with dinner. Do not skip.',
          missedCount: 0,
        },
        {
          name: 'Atorvastatin', dosage: '20mg', frequency: 'Daily',
          schedules: [{ time: '21:00', taken: false }],
          startDate: '2026-05-18',
          instructions: 'Take before sleep.',
          missedCount: 0,
        },
      ]);
      console.log('[medication-service] Seeded default Medications');
    }

    if ((await Caregiver.countDocuments()) === 0) {
      await Caregiver.create({
        name: 'Sarah Connor', relationship: 'Daughter / Emergency Contact',
        phone: '+1-555-0199', email: 'sarah.connor@example.com', alertThreshold: 2,
      });
      console.log('[medication-service] Seeded default Caregiver');
    }

    if ((await SystemStatus.countDocuments()) === 0) {
      await SystemStatus.create({ caregiverAlerted: false });
    }

    app.listen(PORT, () =>
      console.log(`[medication-service] Running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error('[medication-service] DB connection failed:', err.message);
    process.exit(1);
  });
