import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lectomate';
  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${uri}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    throw err;
  }
};

export default mongoose;
