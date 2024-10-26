import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  logo: {
    type: String,
  },
  region: {
    type: String,
  },
});

export default mongoose.model('Brand', brandSchema);
