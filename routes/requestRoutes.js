import express from 'express';
import {
  createRequest,
  getRequests,
  getRequestById,
  updateRequest,
  cancelRequest,
  acceptRequest,
  fulfillRequest
} from '../controllers/requestController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';
import { isResourceOwner } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/requests
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// All request routes require authentication
router.use(protect);

// Routes for all authenticated users
router.get('/', getRequests);
router.get('/:id', getRequestById);

// Requester routes
router.post('/', restrictTo('requester'), createRequest);
router.put('/:id', isResourceOwner(req => req.params.id), updateRequest);
router.put('/:id/cancel', isResourceOwner(req => req.params.id), cancelRequest);

// Donor routes
router.put('/:id/accept', restrictTo('donor'), acceptRequest);

// Doctor routes
router.put('/:id/fulfill', restrictTo('doctor'), fulfillRequest);

export default router;