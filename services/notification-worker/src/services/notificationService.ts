import mongoose from 'mongoose';
import { MedicationModel, CaregiverModel, SystemStatusModel } from '../models/models';
import { formatDate, formatTime } from '../utils/helpers';

// Extend SystemStatus schema with lastResetDate for worker tracking
const SystemStatusSchema = mongoose.model('SystemStatus').schema;
SystemStatusSchema.add({ lastResetDate: String });

export async function runWorkerCycle(): Promise<void> {
  try {
    const now = new Date();
    const currentDateStr = formatDate(now);
    const currentTimeStr = formatTime(now);

    console.log(
      `[Worker - ${now.toISOString()}] Running monitoring cycle. Time: ${currentTimeStr}, Date: ${currentDateStr}`
    );

    // Fetch system status
    let statusDoc = (await SystemStatusModel.findOne()) as any;
    if (!statusDoc) {
      statusDoc = await SystemStatusModel.create({ caregiverAlerted: false });
    }

    // ─── 1. Daily Reset ───────────────────────────────────────────────────────
    if (statusDoc.lastResetDate !== currentDateStr) {
      console.log(`[Worker] New day detected! Resetting medication schedules.`);
      const medications = await MedicationModel.find();
      for (const med of medications) {
        med.schedules = med.schedules.map((s) => {
          s.taken = false;
          s.takenAt = undefined;
          return s;
        });
        await med.save();
      }
      statusDoc.lastResetDate = currentDateStr;
      await statusDoc.save();
      console.log(`[Worker] Daily reset complete.`);
    }

    // ─── 2. Missed Routines Detection ────────────────────────────────────────
    const medications = await MedicationModel.find();
    const caregiver = await CaregiverModel.findOne();
    const alertThreshold = caregiver?.alertThreshold || 2;

    for (const med of medications) {
      let updated = false;

      for (const schedule of med.schedules) {
        const isPastDue = currentTimeStr > schedule.time;
        const isNotTaken = !schedule.taken;
        const notYetProcessedToday =
          !schedule.takenAt || !schedule.takenAt.startsWith(`missed-${currentDateStr}`);

        if (isNotTaken && isPastDue && notYetProcessedToday) {
          console.log(
            `[Worker] MISSED: Medication "${med.name}" schedule "${schedule.time}" has passed.`
          );
          schedule.takenAt = `missed-${currentDateStr}`;
          med.missedCount += 1;
          med.lastUpdated = now.toISOString();
          updated = true;

          // ─── 3. Caregiver Alert ─────────────────────────────────────────────
          if (med.missedCount >= alertThreshold) {
            console.warn(
              `[Worker] ⚠️ CRITICAL: Missed count (${med.missedCount}) >= threshold (${alertThreshold})!`
            );
            statusDoc.caregiverAlerted = true;
            statusDoc.alertReason = `Patient missed "${med.name}" (${med.dosage}) ${med.missedCount} times. Threshold: ${alertThreshold}.`;
            statusDoc.lastNotificationSent = now.toISOString();

            console.log(`[Worker] [SMS] Alerting caregiver: ${caregiver?.name || 'Sarah Connor'} (${caregiver?.phone || '+1-555-0199'})`);
            console.log(`[Worker] [EMAIL] Alerting: ${caregiver?.email || 'sarah.connor@example.com'}`);
          }
        }
      }

      if (updated) await med.save();
    }

    await statusDoc.save();
  } catch (error) {
    console.error('[Worker Error] Exception in monitoring cycle:', error);
  }
}
