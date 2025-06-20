import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';
import * as requestController from '../controllers/requestController.js';

const router = express.Router();

/**
 * @route   POST /api/requests
 * @desc    Create a new blood request
 * @access  Private (Requester, Admin, NGO)
 */
router.post(
  '/',
  protect,
  restrictTo('requester', 'admin', 'ngo'),
  requestController.createRequest
);

/**
 * @route   GET /api/requests
 * @desc    Get all requests (with filters, pagination)
 * @access  Private (All roles)
 */
router.get(
  '/',
  protect,
  requestController.getRequests
);

/**
 * @route   GET /api/requests/:id
 * @desc    Get specific request by ID
 * @access  Private (Owner, Donor, Admin, or if isPublic)
 */
router.get(
  '/:id',
  protect,
  requestController.getRequestById
);

/**
 * @route   PUT /api/requests/:id
 * @desc    Update a request (only by requester or admin, and only if not matched/fulfilled)
 * @access  Private (Owner, Admin)
 */
router.put(
  '/:id',
  protect,
  requestController.updateRequest
);

/**
 * @route   PUT /api/requests/:id/cancel
 * @desc    Cancel a request (only by requester or admin)
 * @access  Private (Owner, Admin)
 */
router.put(
  '/:id/cancel',
  protect,
  requestController.cancelRequest
);

/**
 * @route   PUT /api/requests/:id/accept
 * @desc    Donor accepts a request (status: pending -> matched)
 * @access  Private (Donor only)
 */
router.put(
  '/:id/accept',
  protect,
  restrictTo('donor'),
  requestController.acceptRequest
);

/**
 * @route   PUT /api/requests/:id/fulfill
 * @desc    Doctor verifies/fulfills a request (status: matched -> fulfilled)
 * @access  Private (Doctor only)
 */
router.put(
  '/:id/fulfill',
  protect,
  restrictTo('doctor'),
  requestController.fulfillRequest
);

export default router;