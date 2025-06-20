import express from 'express';
import {
  createCamp,
  getCamps,
  getCampById,
  updateCamp,
  cancelCamp,
  registerForCamp,
  unregisterFromCamp
} from '../controllers/campController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';
import { isResourceOwner } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/camps
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// Public routes
router.get('/', getCamps);
router.get('/:id', getCampById);

// Protected routes
router.use(protect);

// Routes for all authenticated users
router.post('/:id/register', registerForCamp);
router.delete('/:id/register', unregisterFromCamp);

// NGO only routes
router.post('/', restrictTo('ngo'), createCamp);
router.put('/:id', isResourceOwner(async req => {
  const camp = await Camp.findById(req.params.id);
  return camp ? camp.organizer : null;
}), updateCamp);
router.put('/:id/cancel', isResourceOwner(async req => {
  const camp = await Camp.findById(req.params.id);
  return camp ? camp.organizer : null;
}), cancelCamp);

export default router;