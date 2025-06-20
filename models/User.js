import mongoose from 'mongoose';
import { Schema } from 'mongoose';

// Define GeoJSON schema for location
const pointSchema = new Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true
  }
});

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  role: {
    type: String,
    enum: ['donor', 'requester', 'doctor', 'ngo', 'admin'],
    required: true
  },
  // Common profile fields
  address: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String, // URL to image
    default: null
  },
  // GeoJSON location
  location: {
    type: pointSchema,
    index: '2dsphere', // Create geospatial index
    default: null
  },
  
  // Fields for donors and requesters
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: function() {
      return this.role === 'donor' || this.role === 'requester';
    }
  },
  diseases: {
    type: [String], // Medical history
    default: []
  },

  // Fields specific to donors
  isAvailable: {
    type: Boolean,
    default: false
  },
  lastDonationDate: {
    type: Date,
    default: null
  },
  donationCount: {
    type: Number,
    default: 0
  },
  
  // Fields specific to doctors
  hospitalId: {
    type: String,
    required: function() {
      return this.role === 'doctor';
    },
    trim: true
  },
  hospitalName: {
    type: String,
    trim: true
  },
  verificationCount: {
    type: Number,
    default: 0
  },
  
  // Fields specific to NGOs
  ngoId: {
    type: String,
    required: function() {
      return this.role === 'ngo';
    },
    trim: true
  },
  ngoName: {
    type: String,
    trim: true
  },
  blogCount: {
    type: Number,
    default: 0
  },
  campCount: {
    type: Number,
    default: 0
  },
  
  // Account status and tracking fields
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  },
  
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Additional fields
  fcmToken: String, // For push notifications
  preferences: {
    notifyByEmail: {
      type: Boolean,
      default: true
    },
    notifyBySMS: {
      type: Boolean,
      default: true
    },
    notifyByPush: {
      type: Boolean,
      default: true
    },
    radius: {
      type: Number,
      default: 10 // km
    }
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ bloodGroup: 1 });
userSchema.index({ isAvailable: 1 });

// Method to get public profile (no sensitive info)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  delete userObject.fcmToken;
  
  return userObject;
};

// Create a compound index for donor matching
userSchema.index({ 
  bloodGroup: 1, 
  isAvailable: 1, 
  role: 1,
  isActive: 1
});

// Method to check if donor is eligible to donate
userSchema.methods.isEligibleToDonate = function() {
  // If user is not a donor or not available, return false
  if (this.role !== 'donor' || !this.isAvailable || !this.isActive) {
    return false;
  }
  
  // Check if last donation was at least 3 months ago
  if (this.lastDonationDate) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return this.lastDonationDate <= threeMonthsAgo;
  }
  
  // If no previous donation, they are eligible
  return true;
};

// Virtual for full NGO or hospital name
userSchema.virtual('organizationName').get(function() {
  if (this.role === 'ngo' && this.ngoName) {
    return this.ngoName;
  }
  if (this.role === 'doctor' && this.hospitalName) {
    return this.hospitalName;
  }
  return null;
});

const User = mongoose.model('User', userSchema);

export default User;