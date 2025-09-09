import { Router } from 'express';
import { factCheck } from '../services/factCheck.service.js';

const router = Router();

router.post('/fact-check', async (req, res) => {
  try {
    const { text, url } = req.body || {};
    const result = await factCheck({ text, url });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Bad Request' });
  }
});

export default router;


