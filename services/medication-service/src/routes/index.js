const { Router } = require('express');
const medCtrl      = require('../controllers/medicationController');
const caregiverCtrl = require('../controllers/caregiverController');
const statusCtrl   = require('../controllers/statusController');

const router = Router();

router.get('/healthz', (req, res) => res.json({ status: 'healthy', service: 'medication-service' }));

// Medications (order matters — reset-all before :id)
router.get( '/api/medications',            medCtrl.getMedications);
router.post('/api/medications',            medCtrl.createMedication);
router.post('/api/medications/reset-all',  medCtrl.resetAllMedications);
router.post('/api/medications/:id/take',   medCtrl.takeMedication);
router.post('/api/medications/:id/miss',   medCtrl.missMedication);

// Caregiver
router.get( '/api/caregiver', caregiverCtrl.getCaregiver);
router.post('/api/caregiver', caregiverCtrl.updateCaregiver);

// System Status
router.get( '/api/status',       statusCtrl.getStatus);
router.post('/api/status/reset', statusCtrl.resetStatus);

module.exports = router;
