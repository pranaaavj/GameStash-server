import 'dotenv/config';
import cors from 'cors';

const corsOptions = {
  origin: process.env.FRONT_END_URL,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
};

export default cors(corsOptions);
