import mongoose from 'mongoose';
const { Schema } = mongoose;

// GeoJSON schema for location
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

const requestSchema = new Schema({
  requester: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  units: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  diseases: {
    type: [String],
    default: []
  },
  location: {
    type: pointSchema,
    required: true,
    index: '2dsphere'
  },
  address: {
    type: String,
    required: true
  },
  hospital: {
    name: String,
    address: String,
    phone: String
  },
  needByDate: {
    type: Date,
    required: true
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  patientName: {
    type: String,
    required: true
  },
  patientAge: Number,
  patientGender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  purpose: {
    type: String,
    required: true
  },
  additionalNotes: String,
  status: {
    type: String,
    enum: ['pending', 'matched', 'fulfilled', 'expired', 'cancelled'],
    default: 'pending'
  },
  assignedDonor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  matchedAt: Date,
  fulfilledAt: Date,
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Doctor who verified
    default: null
  },
  verifiedAt: Date,
  contactDetails: {
    name: String,
    phone: String,
    relationship: String
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  donorRating: {
    rating: Number,
    feedback: String,
    ratedAt: Date
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

requestSchema.index({ bloodGroup: 1, status: 1 });
requestSchema.index({ needByDate: 1 });
requestSchema.index({ requester: 1 });
requestSchema.index({ assignedDonor: 1 });

requestSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'pending') return 0;
  const now = new Date();
  const needBy = new Date(this.needByDate);
  const diff = needBy - now;
  return diff > 0 ? diff : 0;
});

requestSchema.virtual('isUrgent').get(function() {
  if (this.status !== 'pending') return false;
  const now = new Date();
  const needBy = new Date(this.needByDate);
  const diff = needBy - now;
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
});

const Request = mongoose.model('Request', requestSchema);

export default Request;