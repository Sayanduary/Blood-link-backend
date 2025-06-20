import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const donationSchema = new Schema({
  donor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  request: {
    type: Schema.Types.ObjectId,
    ref: 'Request',
    required: true
  },
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
    min: 1
  },
  donationDate: {
    type: Date,
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
  hospitalName: {
    type: String,
    required: true
  },
  hospitalAddress: String,
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Doctor who verified the donation
    required: true
  },
  verificationDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['verified', 'rejected'],
    default: 'verified'
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster queries
donationSchema.index({ donor: 1 });
donationSchema.index({ requester: 1 });
donationSchema.index({ verifiedBy: 1 });
donationSchema.index({ donationDate: 1 });

// Ensure the location field has a 2dsphere index
donationSchema.index({ location: '2dsphere' });

// Update donor's last donation date and count when a donation is verified
donationSchema.post('save', async function(doc) {
  try {
    if (doc.status === 'verified') {
      const User = mongoose.model('User');
      const donor = await User.findById(doc.donor);
      
      if (donor) {
        donor.lastDonationDate = doc.donationDate;
        donor.donationCount = (donor.donationCount || 0) + 1;
        await donor.save();
      }
    }
  } catch (error) {
    console.error('Error updating donor stats:', error);
  }
});

const Donation = mongoose.model('Donation', donationSchema);

export default Donation;