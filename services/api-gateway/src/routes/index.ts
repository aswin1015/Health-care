import { Router } from 'express';
import * as historyController from '../controllers/historyController';
import * as appointmentController from '../controllers/appointmentController';
import * as medicationController from '../controllers/medicationController';
import * as caregiverController from '../controllers/caregiverController';
import * as statusController from '../controllers/statusController';
import * as aiController from '../controllers/aiController';
import * as authController from '../controllers/authController';
import * as adminController from '../controllers/adminController';
import * as activityController from '../controllers/activityController';
import * as cosmosController from '../controllers/cosmosController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// ─── Auth (public) ────────────────────────────────────────────────────────────
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authController.getMe);

// All routes below require a valid JWT ────────────────────────────────────────

// ─── Medical History ─────────────────────────────────────────────────────────
router.get('/history', authMiddleware, historyController.getHistory);
router.post('/history', authMiddleware, historyController.createHistory);
router.put('/history/:id', authMiddleware, historyController.updateHistory);
router.delete('/history/:id', authMiddleware, historyController.deleteHistory);

// ─── File Upload (Azure Blob Storage) ───────────────────────────────────────
import * as uploadController from '../controllers/uploadController';
router.post('/history/upload', authMiddleware, uploadController.uploadMiddleware, uploadController.uploadHealthRecord);
router.get('/history/upload/:id/status', authMiddleware, uploadController.getUploadStatus);

// ─── Cosmos DB — OCR Processed Documents ──────────────────────────────────────
router.get('/history/documents', authMiddleware, cosmosController.getProcessedDocuments);

// ─── Appointments ─────────────────────────────────────────────────────────────
router.get('/appointments', authMiddleware, appointmentController.getAppointments);
router.post('/appointments', authMiddleware, appointmentController.createAppointment);
router.put('/appointments/:id', authMiddleware, appointmentController.updateAppointment);
router.delete('/appointments/:id', authMiddleware, appointmentController.deleteAppointment);

// ─── Medications ──────────────────────────────────────────────────────────────
router.get('/medications', authMiddleware, medicationController.getMedications);
router.post('/medications', authMiddleware, medicationController.createMedication);
router.put('/medications/:id', authMiddleware, medicationController.updateMedication);
router.delete('/medications/:id', authMiddleware, medicationController.deleteMedication);
router.post('/medications/reset-all', authMiddleware, medicationController.resetAllMedications);
router.post('/medications/:id/take', authMiddleware, medicationController.takeMedication);
router.post('/medications/:id/miss', authMiddleware, medicationController.missMedication);

// ─── Caregiver Config ─────────────────────────────────────────────────────────
router.get('/caregiver', authMiddleware, caregiverController.getCaregiver);
router.post('/caregiver', authMiddleware, caregiverController.updateCaregiver);

// ─── System Status ────────────────────────────────────────────────────────────
router.get('/status', authMiddleware, statusController.getStatus);
router.post('/status/reset', authMiddleware, statusController.resetStatus);

// ─── Activity Tracker ─────────────────────────────────────────────────────────
router.get('/activities', authMiddleware, activityController.getActivities);
router.get('/activities/stats', authMiddleware, activityController.getStats);
router.post('/activities', authMiddleware, activityController.createActivity);
router.put('/activities/:id', authMiddleware, activityController.updateActivity);
router.delete('/activities/:id', authMiddleware, activityController.deleteActivity);

// ─── AI Chat ──────────────────────────────────────────────────────────────────
router.post('/ai/chat', authMiddleware, aiController.handleChat);

// ─── Admin User Management ────────────────────────────────────────────────────
router.get('/admin/users', authMiddleware, adminController.getAllUsers);
router.get('/admin/caregivers', authMiddleware, adminController.getCaregivers);
router.get('/admin/my-patients', authMiddleware, adminController.getMyPatients);
router.post('/admin/assign', authMiddleware, adminController.assignPatientToCaregiver);
router.delete('/admin/users/:id', authMiddleware, adminController.deleteUser);

export default router;
