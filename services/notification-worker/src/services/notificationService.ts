import mongoose from 'mongoose';
import { MedicationModel, CaregiverModel, SystemStatusModel } from '../models/models';
import { formatDate, formatTime } from '../utils/helpers';

export async function runWorkerCycle(): Promise<void> {
  try {
    const now = new Date();
    const currentDateStr = formatDate(now);
    const currentTimeStr = formatTime(now);

    console.log(
      `[Worker - ${now.toISOString()}] Running monitoring cycle. Time: ${currentTimeStr}, Date: ${currentDateStr}`
    );

    // ─── Get all unique userIds that have medications ─────────────────────────
    const userIds = await MedicationModel.distinct('userId');
    console.log(`[Worker] Found ${userIds.length} user(s) to process.`);

    for (const userId of userIds) {
      await processUserCycle(userId, now, currentDateStr, currentTimeStr);
    }

  } catch (error) {
    console.error('[Worker Error] Exception in monitoring cycle:', error);
  }
}

async function processUserCycle(
  userId: any,
  now: Date,
  currentDateStr: string,
  currentTimeStr: string
): Promise<void> {
  try {
    // Get or create per-user system status
    let statusDoc = await (SystemStatusModel as any).findOne({ userId }) as any;
    if (!statusDoc) {
      statusDoc = await (SystemStatusModel as any).create({ userId, caregiverAlerted: false });
    }

    // ─── 1. Daily Reset (per user) ────────────────────────────────────────────
    if (statusDoc.lastResetDate !== currentDateStr) {
      console.log(`[Worker][User:${userId}] New day detected! Resetting medication schedules.`);
      const medications = await MedicationModel.find({ userId });
      for (const med of medications) {
        med.schedules = med.schedules.map((s) => {
          s.taken = false;
          s.takenAt = undefined;
          return s;
        });
        med.missedCount = 0;
        await med.save();
      }
      statusDoc.lastResetDate = currentDateStr;
      statusDoc.caregiverAlerted = false;
      statusDoc.alertReason = undefined;
      await statusDoc.save();
      console.log(`[Worker][User:${userId}] Daily reset complete.`);
    }

    // ─── 2. Missed Routines Detection (per user) ──────────────────────────────
    const medications = await MedicationModel.find({ userId });
    const caregiver = await CaregiverModel.findOne({ userId });
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
            `[Worker][User:${userId}] MISSED: Medication "${med.name}" schedule "${schedule.time}" has passed.`
          );
          schedule.takenAt = `missed-${currentDateStr}`;
          med.missedCount += 1;
          med.lastUpdated = now.toISOString();
          updated = true;

          // ─── 3. Caregiver Alert (per user) ─────────────────────────────────
          if (med.missedCount >= alertThreshold) {
            console.warn(
              `[Worker][User:${userId}] ⚠️ CRITICAL: Missed count (${med.missedCount}) >= threshold (${alertThreshold})!`
            );
            statusDoc.caregiverAlerted = true;
            statusDoc.alertReason = `Patient missed "${med.name}" (${med.dosage}) ${med.missedCount} times. Threshold: ${alertThreshold}.`;
            statusDoc.lastNotificationSent = now.toISOString();
            console.log(
              `[Worker][User:${userId}] Alerting caregiver: ${caregiver?.name || 'N/A'} (${caregiver?.phone || 'N/A'})`
            );
          }
        }
      }

      if (updated) await med.save();
    }

    await statusDoc.save();

  } catch (error) {
    console.error(`[Worker Error][User:${userId}] Exception in processUserCycle:`, error);
  }
}
