import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/authRoutes.js';
import donorRoutes from './routes/donorRoutes.js';
import requesterRoutes from './routes/requesterRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import ngoRoutes from './routes/ngoRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import campRoutes from './routes/campRoutes.js';
import mapRoutes from './routes/mapRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import connectToDatabase from './config/db.js';
import setupSocket from './config/socket.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.io with CORS options
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Configure Socket.io
setupSocket(io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requesters', requesterRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/camps', campRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);

// API health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'BloodLink API is running',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5500;
const startServer = async () => {
  try {
    await connectToDatabase();
    server.listen(PORT, () => {
      console.log(`🩸 BloodLink server running on port ${PORT}`);
      console.log(`📅 Server started at: ${new Date().toISOString()}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...', err.name, err.message);
  console.error(err.stack);
  server.close(() => {
    process.exit(1);
  });
});

export { app, io };