export const validAadhaar1 = '234567890124';
export const validAadhaar2 = '345678901238';

export const mockSedProfile = {
  id: 'profile-sed-e2e',
  name: 'Govinda Family',
  pilgrims: [
    {
      id: 'p1',
      firstName: 'Srinivasa',
      lastName: 'Rao',
      fullName: 'Srinivasa Rao',
      age: 45,
      gender: 'Male',
      idType: 'Aadhaar',
      idNumber: validAadhaar1,
      mobile: '9876543210',
      country: 'India',
    },
  ],
  general: {
    mobile: '9876543210',
    email: 'srinivasa.e2e@example.com',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    country: 'India',
    pinCode: '517501',
  },
  selectedPilgrims: {
    'special-entry-darshan-300': ['p1'],
  },
};

export const mockHomamProfile = {
  id: 'profile-homam-e2e',
  name: 'Dampatulu Homam Group',
  pilgrims: [
    {
      id: 'h1',
      firstName: 'Venkata',
      lastName: 'Sharma',
      fullName: 'Venkata Sharma',
      age: 50,
      gender: 'Male',
      idType: 'Aadhaar',
      idNumber: validAadhaar1,
      mobile: '9876543210',
      country: 'India',
    },
    {
      id: 'h2',
      firstName: 'Padmavathi',
      lastName: 'Sharma',
      fullName: 'Padmavathi Sharma',
      age: 46,
      gender: 'Female',
      idType: 'Aadhaar',
      idNumber: validAadhaar2,
      mobile: '9876543210',
      country: 'India',
    },
  ],
  general: {
    gothram: 'Kashyapa',
    mobile: '9876543210',
    email: 'dampatulu.e2e@example.com',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    country: 'India',
    pinCode: '517501',
  },
  selectedPilgrims: {
    'sri-srinivasa-divyanugraha-homam': ['h1', 'h2'],
  },
};

export const mockSrivariSevaProfile = {
  id: 'profile-srivari-e2e',
  name: 'Srivari Sevak Profile',
  pilgrims: [
    {
      id: 's1',
      firstName: 'Govind',
      lastName: 'Kumar',
      fullName: 'Govind Kumar',
      age: 35,
      gender: 'Male',
      dateOfBirth: '1991-05-15',
      idType: 'Aadhaar',
      idNumber: validAadhaar1,
      mobile: '9876543210',
      address: 'Street 4, Sector 2',
      srivariSeva: {
        doorNumber: '12-3-4',
        street: 'Sannidhi Street',
        district: 'Chittoor',
      },
    },
  ],
  general: {
    doorNumber: '12-3-4',
    street: 'Sannidhi Street',
    district: 'Chittoor',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    pinCode: '517501',
  },
  selectedPilgrims: {
    'srivari-seva': ['s1'],
  },
};
