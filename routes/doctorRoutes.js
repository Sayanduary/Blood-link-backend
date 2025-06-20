import express from 'express';
import {
  getPendingVerifications,
  verifyDonation,
  getVerificationHistory,
  getDoctorStats
} from '../controllers/doctorController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/doctors
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// All doctor routes require authentication
router.use(protect);
// Restrict all routes to doctor role
router.use(restrictTo('doctor', 'admin'));

router.get('/pending-verifications', getPendingVerifications);
router.post('/verify-donation/:requestId', verifyDonation);
router.get('/verification-history', getVerificationHistory);
router.get('/stats', getDoctorStats);

export default router;