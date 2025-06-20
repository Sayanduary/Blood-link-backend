import express from 'express';
import {
  getActiveRequests,
  getRequestHistory,
  getRequesterStats,
  updateRequesterProfile,
  getDonationStatus,
  getCompatibleDonors,
  contactDonor,
  rateDonor
} from '../controllers/requesterController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/requesters
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// All requester routes require authentication
router.use(protect);
// Restrict all routes to requester role
router.use(restrictTo('requester', 'admin'));

router.get('/active-requests', getActiveRequests);
router.get('/request-history', getRequestHistory);
router.get('/stats', getRequesterStats);
router.put('/profile', updateRequesterProfile);
router.get('/donation-status/:requestId', getDonationStatus);
router.get('/compatible-donors/:requestId', getCompatibleDonors);
router.post('/contact-donor', contactDonor);
router.post('/rate-donor', rateDonor);

export default router;