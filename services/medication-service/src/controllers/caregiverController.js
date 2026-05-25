const { Caregiver } = require('../models/models');

const getCaregiver = async (req, res, next) => {
  try {
    let cg = await Caregiver.findOne();
    if (!cg) cg = await Caregiver.create({
      name: 'Sarah Connor', relationship: 'Daughter / Emergency Contact',
      phone: '+1-555-0199', email: 'sarah.connor@example.com', alertThreshold: 2,
    });
    res.json(cg);
  } catch (err) { next(err); }
};

const updateCaregiver = async (req, res, next) => {
  try {
    let cg = await Caregiver.findOne();
    if (cg) { Object.assign(cg, req.body); await cg.save(); }
    else { cg = new Caregiver(req.body); await cg.save(); }
    res.json(cg);
  } catch (err) { next(err); }
};

module.exports = { getCaregiver, updateCaregiver };
