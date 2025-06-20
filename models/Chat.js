import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const chatSchema = new Schema({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  isGroupChat: {
    type: Boolean,
    default: false
  },
  chatName: {
    type: String,
    trim: true
  },
  request: {
    type: Schema.Types.ObjectId,
    ref: 'Request'
  },
  latestMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message'
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster chat retrieval
chatSchema.index({ participants: 1 });
chatSchema.index({ request: 1 });
chatSchema.index({ updatedAt: -1 });

// Static method to find or create a chat between users
chatSchema.statics.findOrCreateChat = async function(userId1, userId2, requestId = null) {
  try {
    // Try to find existing chat
    const existingChat = await this.findOne({
      participants: { $all: [userId1, userId2] },
      isGroupChat: false
    });
    
    if (existingChat) {
      return existingChat;
    }
    
    // Create new chat
    const newChat = await this.create({
      participants: [userId1, userId2],
      isGroupChat: false,
      createdBy: userId1,
      request: requestId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Populate the participants
    const chat = await this.findById(newChat._id).populate('participants', 'name email profileImage');
    
    return chat;
  } catch (error) {
    console.error('Error in findOrCreateChat:', error);
    throw error;
  }
};

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;