const { Appointment } = require('../models/models');

const getAppointments = async (req, res, next) => {
  try {
    const list = await Appointment.find().sort({ dateTime: 1 });
    res.json(list);
  } catch (err) { next(err); }
};

const createAppointment = async (req, res, next) => {
  try {
    const appt  = new Appointment(req.body);
    const saved = await appt.save();
    res.status(201).json(saved);
  } catch (err) { next(err); }
};

module.exports = { getAppointments, createAppointment };
