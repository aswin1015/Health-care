const { MedicalRecord } = require('../models/models');

const getHistory = async (req, res, next) => {
  try {
    const records = await MedicalRecord.find().sort({ date: -1 });
    res.json(records);
  } catch (err) { next(err); }
};

const createHistory = async (req, res, next) => {
  try {
    const record = new MedicalRecord(req.body);
    const saved  = await record.save();
    res.status(201).json(saved);
  } catch (err) { next(err); }
};

module.exports = { getHistory, createHistory };
