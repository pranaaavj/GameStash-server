import mongoose from 'mongoose';

const connectDB = async (URI) => {
  mongoose.connection.on('connected', () =>
    console.log('Connected to Database')
  );
  mongoose.connection.on('disconnected', () =>
    console.log('Disconnected from Database')
  );
  mongoose.connection.on('error', (err) =>
    console.log('Database connection error: ', err)
  );
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('Database connection terminated');
    process.exit(0);
  });
  try {
    await mongoose.connect(URI);
  } catch (error) {
    throw error;
  }
};

export default connectDB;
