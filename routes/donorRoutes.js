import express from 'express';
import {
  toggleAvailability,
  getActiveRequests,
  getDonationHistory,
  getNearbyRequests,
  getDonorStats,
  checkEligibility
} from '../controllers/donorController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/donors
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// All donor routes require authentication
router.use(protect);
// Restrict all routes to donor role
router.use(restrictTo('donor', 'admin'));

router.put('/toggle-availability', toggleAvailability);
router.get('/active-requests', getActiveRequests);
router.get('/donation-history', getDonationHistory);
router.get('/nearby-requests', getNearbyRequests);
router.get('/stats', getDonorStats);
router.get('/check-eligibility', checkEligibility);

export default router;