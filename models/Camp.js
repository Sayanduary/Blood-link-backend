import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const campSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  organizer: {
    type: Schema.Types.ObjectId,
    ref: 'User', // NGO user
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  address: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  startTime: String,
  endTime: String,
  targetUnits: {
    type: Number,
    min: 1
  },
  collectedUnits: {
    type: Number,
    default: 0
  },
  bloodGroups: {
    type: [{
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    }],
    default: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  image: String,
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  participants: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    attended: {
      type: Boolean,
      default: false
    },
    bloodDonated: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  additionalInfo: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster camp retrieval
campSchema.index({ startDate: 1 });
campSchema.index({ organizer: 1 });
campSchema.index({ status: 1 });

// Ensure the location field has a 2dsphere index
campSchema.index({ location: '2dsphere' });

// Static method to find nearby camps
campSchema.statics.findNearbyCamps = function(coordinates, radius = 10) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: radius * 1000 // Convert km to meters
      }
    },
    status: { $in: ['upcoming', 'ongoing'] }
  });
};

// Register a user for the camp
campSchema.methods.registerParticipant = async function(userId) {
  if (this.status !== 'upcoming' && this.status !== 'ongoing') {
    throw new Error('Registration is closed for this camp');
  }
  
  // Check if user is already registered
  const isRegistered = this.participants.some(p => 
    p.user.toString() === userId.toString()
  );
  
  if (isRegistered) {
    throw new Error('User is already registered for this camp');
  }
  
  // Add user to participants
  this.participants.push({
    user: userId,
    registrationDate: new Date(),
    attended: false,
    bloodDonated: false
  });
  
  return this.save();
};

// Update camp status based on dates
campSchema.pre('find', function() {
  this.updateCampStatus();
});

campSchema.pre('findOne', function() {
  this.updateCampStatus();
});

// Static method to update camp status based on dates
campSchema.statics.updateCampStatus = async function() {
  const now = new Date();
  
  // Update upcoming to ongoing
  await this.updateMany({
    status: 'upcoming',
    startDate: { $lte: now }
  }, {
    status: 'ongoing'
  });
  
  // Update ongoing to completed
  await this.updateMany({
    status: 'ongoing',
    endDate: { $lt: now }
  }, {
    status: 'completed'
  });
};

const Camp = mongoose.model('Camp', campSchema);

export default Camp;