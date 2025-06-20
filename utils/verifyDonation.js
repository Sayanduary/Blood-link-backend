/**
 * Check if a donation can be verified by a doctor.
 * @param {object} donation - Donation document
 * @param {object} doctor - Doctor user document
 * @returns {boolean}
 */
export const canDoctorVerifyDonation = (donation, doctor) => {
  // Doctor must exist and have role 'doctor'
  if (!doctor || doctor.role !== 'doctor') return false;
  // Donation must be in a state to verify
  if (!donation || donation.status !== 'matched') return false;
  // The doctor should not be the donor or requester
  if (
    String(donation.donor) === String(doctor._id) ||
    String(donation.requester) === String(doctor._id)
  ) {
    return false;
  }
  return true;
};