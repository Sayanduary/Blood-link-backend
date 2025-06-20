import express from 'express';
import {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  toggleLikeBlog
} from '../controllers/blogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';
import { isResourceOwner } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/blogs
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// Public routes
router.get('/', getBlogs);
router.get('/:id', getBlogById);

// Protected routes
router.use(protect);

// Like/unlike blog
router.put('/:id/like', toggleLikeBlog);

// NGO only routes
router.post('/', restrictTo('ngo'), createBlog);
router.put('/:id', isResourceOwner(async req => {
  const blog = await Blog.findById(req.params.id);
  return blog ? blog.author : null;
}), updateBlog);
router.delete('/:id', isResourceOwner(async req => {
  const blog = await Blog.findById(req.params.id);
  return blog ? blog.author : null;
}), deleteBlog);

export default router;