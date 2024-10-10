import 'dotenv/config';
import 'express-async-errors';
import cors from './config/cors.config.js';
import router from './routers/index.routes.js';
import express from 'express';
import connectDB from './config/database.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.use(cors);
// Routes
app.use('/api', router);

//Global Error

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
