/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Array} coord1 - [longitude, latitude] of first point
 * @param {Array} coord2 - [longitude, latitude] of second point
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2) return Infinity;
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Build MongoDB geospatial query for finding nearby points
 * @param {Array} coordinates - [longitude, latitude]
 * @param {number} radius - Search radius in kilometers
 * @returns {object}
 */
export const buildNearbyQuery = (coordinates, radius = 10) => {
  if (!coordinates || coordinates.length !== 2) {
    throw new Error('Invalid coordinates provided');
  }
  return {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: radius * 1000 // meters
      }
    }
  };
};

/**
 * Find donors within radius of a location and matching blood group
 * @param {Array} coordinates - [longitude, latitude]
 * @param {string} bloodGroup
 * @param {number} radius
 * @param {Model} User - Mongoose User model
 */
export const findNearbyDonors = async (coordinates, bloodGroup, radius, User) => {
  try {
    const geoQuery = buildNearbyQuery(coordinates, radius);
    const donors = await User.find({
      ...geoQuery,
      role: 'donor',
      isAvailable: true,
      isActive: true,
      bloodGroup
    }).select('-password');
    return donors;
  } catch (error) {
    console.error('Error finding nearby donors:', error);
    throw error;
  }
};

/**
 * Check if a donor can donate to a requester based on blood group compatibility
 * @param {string} donorBloodGroup
 * @param {string} requesterBloodGroup
 * @returns {boolean}
 */
export const isBloodCompatible = (donorBloodGroup, requesterBloodGroup) => {
  const compatibility = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };
  return compatibility[donorBloodGroup]?.includes(requesterBloodGroup) || false;
};