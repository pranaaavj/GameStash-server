// scripts/train-model.js
import { trainRecommendationModel } from '../controllers/recommend.controller.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
mongoose.connect(
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/GameStash'
);

async function trainModel() {
  console.log('Starting model training...');
  await trainRecommendationModel();
  console.log('Training completed!');
  process.exit(0);
}

trainModel().catch((err) => {
  console.error('Error during training:', err);
  process.exit(1);
});
