const { Router } = require('express');
const { handleChat } = require('../controllers/aiController');

const router = Router();

router.get('/healthz', (req, res) =>
  res.json({ status: 'healthy', service: 'ai-service' })
);

router.post('/api/ai/chat', handleChat);

module.exports = router;
