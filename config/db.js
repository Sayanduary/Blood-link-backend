import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';
if (!NODE_ENV) {
    throw new Error('Please provide the NODE_ENV environment variable inside the .env.<development/production>.local');
}

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