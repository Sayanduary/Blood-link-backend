
import mongoose from 'mongoose';
import { MONGODB_URI, NODE_ENV } from '../config/env.js';

if (!MONGODB_URI) {
    throw new Error('Please provide the MONGODB_URI environment variable inside the .env.<development/production>.local');
}

const connectToDatabase = async () => {
    try {
        console.log('Attempting database connection...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected!');
        console.log(`Connected to database: ${NODE_ENV} mode`);
    } catch (error) {
        console.error('Error connecting to database:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection lost');
});

export default connectToDatabase;