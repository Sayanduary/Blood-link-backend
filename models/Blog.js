import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const blogSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true,
    maxlength: 200
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  coverImage: {
    type: String
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: Date
});

// Indexes for faster blog retrieval
blogSchema.index({ status: 1, createdAt: -1 });
blogSchema.index({ author: 1 });
blogSchema.index({ tags: 1 });

// Add text index for search
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Increment view count
blogSchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

// Like/unlike a blog
blogSchema.methods.toggleLike = async function(userId) {
  const userIdObj = mongoose.Types.ObjectId(userId);
  
  if (this.likedBy.includes(userIdObj)) {
    // Unlike
    this.likedBy = this.likedBy.filter(id => !id.equals(userIdObj));
    this.likes = this.likedBy.length;
    return { action: 'unliked', blog: await this.save() };
  } else {
    // Like
    this.likedBy.push(userIdObj);
    this.likes = this.likedBy.length;
    return { action: 'liked', blog: await this.save() };
  }
};

// Pre-save hook to update timestamps
blogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set publishedAt date when blog is first published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

const Blog = mongoose.model('Blog', blogSchema);

export default Blog;