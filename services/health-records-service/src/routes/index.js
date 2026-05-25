const { Router } = require('express');
const historyCtrl     = require('../controllers/historyController');
const appointmentCtrl = require('../controllers/appointmentController');

const router = Router();

// Health check
router.get('/healthz', (req, res) => res.json({ status: 'healthy', service: 'health-records-service' }));

// Medical History
router.get( '/api/history', historyCtrl.getHistory);
router.post('/api/history', historyCtrl.createHistory);

// Appointments
router.get( '/api/appointments', appointmentCtrl.getAppointments);
router.post('/api/appointments', appointmentCtrl.createAppointment);

module.exports = router;
