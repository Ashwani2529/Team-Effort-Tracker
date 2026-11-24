import mongoose from 'mongoose';
import { env } from './env.js';
export async function connectDatabase(uri = env.MONGODB_URI): Promise<void> { mongoose.set('strictQuery', true); await mongoose.connect(uri, { autoIndex: env.NODE_ENV !== 'production' }); }
export async function disconnectDatabase(): Promise<void> { await mongoose.disconnect(); }
