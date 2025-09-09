import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import factCheckRouter from './routes/factCheck.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: '*'}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', factCheckRouter);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});


