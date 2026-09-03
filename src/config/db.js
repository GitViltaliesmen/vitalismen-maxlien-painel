import mongoose from 'mongoose';
import { strictReadOnlyMongooseConnectOptions } from '../services/strictReadOnlyObservationService.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI,
      strictReadOnlyMongooseConnectOptions(process.env)
    );
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
