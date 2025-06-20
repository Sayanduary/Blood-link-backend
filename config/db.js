import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!MONGODB_URI) {
    throw new Error('Please provide the MONGODB_URI environment variable in your .env file');
}

const connectToDatabase = async () => {
    try {
        console.log('Attempting database connection...');
        await mongoose.connect(MONGODB_URI, {
            // These options ensure robust connection handling
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('Connected!');
        console.log(`Connected to database: ${NODE_ENV} mode`);
    } catch (error) {
        console.error('Error connecting to database:', error.message);
        console.error(error.stack);
        
        // Instead of exiting, try to reconnect after a delay
        console.log('Attempting to reconnect in 5 seconds...');
        setTimeout(() => connectToDatabase(), 5000);
    }
};

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection lost');
    console.log('Attempting to reconnect...');
    setTimeout(() => connectToDatabase(), 5000);
});

// Handle connection errors
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
    setTimeout(() => connectToDatabase(), 5000);
});

export default connectToDatabase;