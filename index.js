import 'dotenv/config';
import 'express-async-errors';
import cors from './config/cors.config.js';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './routers/index.routes.js';
import express from 'express';
import connectDB from './config/database.js';
import cookieParser from 'cookie-parser';
import errorHandler from './middlewares/error.middleware.js';

const app = express();

// Middlewares
app.use(cors); // Cross origin resource sharing
app.use(cookieParser()); // For parsing cookies
// app.use(limiter); // Rate limiter
app.use(helmet()); // Security headers
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', router);

// Global Error handler
app.use(errorHandler);

(async function startServer() {
  try {
    const DB = process.env.MONGO_URI;
    const PORT = process.env.PORT || 4000;
    await connectDB(DB);
    app.listen(PORT, () =>
      console.log(`Server listening at http://localhost:${PORT}`)
    );
  } catch (error) {
    console.log(`Error occurred while starting the server: ${error.message}`);
  }
})();
