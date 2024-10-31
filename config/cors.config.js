import cors from 'cors';

const corsOptions = {
  origin: process.env.FRONT_END_URL,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

export default cors(corsOptions);
