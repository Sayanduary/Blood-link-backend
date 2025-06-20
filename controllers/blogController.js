import Blog from '../models/Blog.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * Create blog post
 * @route POST /api/blogs
 * @access Private (NGO only)
 */
export const createBlog = asyncHandler(async (req, res) => {
  const { 
    title, 
    content, 
    summary, 
    tags, 
    coverImage, 
    status 
  } = req.body;
  
  // Check if user is NGO
  if (req.user.role !== 'ngo') {
    throw new AppError('Only NGOs can create blog posts', 403);
  }
  
  // Validate required fields
  if (!title || !content || !summary) {
    throw new AppError('Please provide title, content, and summary', 400);
  }
  
  const blog = new Blog({
    title,
    content,
    summary,
    author: req.user.id,
    tags: tags || [],
    coverImage: coverImage || null,
    status: status || 'published',
    createdAt: new Date()
  });
  
  // Set publishedAt if status is published
  if (blog.status === 'published') {
    blog.publishedAt = new Date();
  }
  
  await blog.save();
  
  // Increment blog count for NGO
  const ngo = await User.findById(req.user.id);
  if (ngo) {
    ngo.blogCount = (ngo.blogCount || 0) + 1;
    await ngo.save();
  }
  
  res.status(201).json({
    success: true,
    message: 'Blog post created successfully',
    data: blog
  });
});

/**
 * Get all blogs (with filters)
 * @route GET /api/blogs
 * @access Public
 */
export const getBlogs = asyncHandler(async (req, res) => {
  const { 
    tag, 
    status, 
    author, 
    search,
    page = 1,
    limit = 10,
    sort = 'newest'
  } = req.query;
  
  // Build query
  let query = {};
  
  // Public users should only see published blogs
  if (req.user?.role !== 'admin' && req.user?.id !== author) {
    query.status = 'published';
  } else if (status) {
    query.status = status;
  }
  
  if (tag) {
    query.tags = tag;
  }
  
  if (author) {
    query.author = author;
  }
  
  if (search) {
    query.$text = { $search: search };
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Determine sort order
  let sortOptions = {};
  switch(sort) {
    case 'newest':
      sortOptions = { createdAt: -1 };
      break;
    case 'oldest':
      sortOptions = { createdAt: 1 };
      break;
    case 'popular':
      sortOptions = { views: -1 };
      break;
    case 'a-z':
      sortOptions = { title: 1 };
      break;
    default:
      sortOptions = { createdAt: -1 };
  }
  
  // Execute query
  const blogs = await Blog.find(query)
    .populate('author', 'name ngoName')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const total = await Blog.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: blogs.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: blogs
  });
});

/**
 * Get blog by ID
 * @route GET /api/blogs/:id
 * @access Public
 */
export const getBlogById = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
    .populate('author', 'name ngoName email');
  
  if (!blog) {
    throw new AppError('Blog not found', 404);
  }
  
  // Check if user can view non-published blog
  if (blog.status !== 'published' && 
      req.user?.id !== blog.author._id.toString() && 
      req.user?.role !== 'admin') {
    throw new AppError('Blog post not available', 404);
  }
  
  // Increment view count if not author
  if (!req.user || req.user.id !== blog.author._id.toString()) {
    await blog.incrementViews();
  }
  
  res.status(200).json({
    success: true,
    data: blog
  });
});

/**
 * Update blog
 * @route PUT /api/blogs/:id
 * @access Private (Author or Admin)
 */
export const updateBlog = asyncHandler(async (req, res) => {
  let blog = await Blog.findById(req.params.id);
  
  if (!blog) {
    throw new AppError('Blog not found', 404);
  }
  
  // Check ownership
  if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this blog', 403);
  }
  
  // Check if publishing for the first time
  const isPublishing = req.body.status === 'published' && blog.status !== 'published';
  
  // Update blog
  blog = await Blog.findByIdAndUpdate(
    req.params.id,
    { 
      ...req.body,
      updatedAt: new Date(),
      ...(isPublishing ? { publishedAt: new Date() } : {})
    },
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    message: 'Blog updated successfully',
    data: blog
  });
});

/**
 * Delete blog
 * @route DELETE /api/blogs/:id
 * @access Private (Author or Admin)
 */
export const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  
  if (!blog) {
    throw new AppError('Blog not found', 404);
  }
  
  // Check ownership
  if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to delete this blog', 403);
  }
  
  await blog.remove();
  
  // Decrement blog count for NGO
  if (blog.author) {
    const ngo = await User.findById(blog.author);
    if (ngo && ngo.blogCount > 0) {
      ngo.blogCount -= 1;
      await ngo.save();
    }
  }
  
  res.status(200).json({
    success: true,
    message: 'Blog deleted successfully'
  });
});

/**
 * Like/unlike blog
 * @route PUT /api/blogs/:id/like
 * @access Private
 */
export const toggleLikeBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  
  if (!blog) {
    throw new AppError('Blog not found', 404);
  }
  
  const result = await blog.toggleLike(req.user.id);
  
  res.status(200).json({
    success: true,
    message: `Blog ${result.action}`,
    data: {
      likes: result.blog.likes,
      action: result.action
    }
  });
});