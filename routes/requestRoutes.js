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
import Request from '../models/Request.js';

const router = express.Router();

// All request routes require authentication
router.use(protect);

// Routes for all authenticated users
router.get('/', getRequests);
router.get('/:id', getRequestById);

// Requester routes
router.post('/', restrictTo('requester'), createRequest);

// Update request route with ownership check
router.put('/:id',
  restrictTo('requester', 'admin'),
  async (req, res, next) => {
    try {
      const request = await Request.findById(req.params.id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      if (req.user.role === 'admin' || request.requester.toString() === req.user.id) {
        next();
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this request'
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking request ownership',
        error: error.message
      });
    }
  },
  updateRequest
);

// Cancel request route with ownership check
router.put('/:id/cancel',
  restrictTo('requester', 'admin'),
  async (req, res, next) => {
    try {
      const request = await Request.findById(req.params.id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      if (req.user.role === 'admin' || request.requester.toString() === req.user.id) {
        next();
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this request'
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking request ownership',
        error: error.message
      });
    }
  },
  cancelRequest
);

// Donor routes
router.put('/:id/accept', restrictTo('donor'), acceptRequest);

// Doctor routes
router.put('/:id/fulfill', restrictTo('doctor'), fulfillRequest);

export default router;