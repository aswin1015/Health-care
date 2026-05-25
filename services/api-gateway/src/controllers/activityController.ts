import { Request, Response } from 'express';
import { ActivityModel } from '../models/models';

export const getActivities = async (req: Request, res: Response) => {
  try {
    const activities = await ActivityModel.find({ userId: req.userId }).sort({ date: -1 });
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const activity = new ActivityModel({ ...req.body, userId: req.userId });
    const saved = await activity.save();
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const updated = await ActivityModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Activity not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const deleted = await ActivityModel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Activity not found' });
    res.json({ message: 'Activity deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
