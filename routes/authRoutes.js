import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

// Import your controller functions here
import {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  logout,
  verifyEmail,
  resendVerification
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login a user
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', protect, getCurrentUser);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiate forgot password process
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset user password
 * @access  Public
 */
router.post('/reset-password', resetPassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (optional, if you use tokens in cookies)
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user email
 * @access  Public
 */
router.get('/verify-email/:token', verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification', protect, resendVerification);

export default router;