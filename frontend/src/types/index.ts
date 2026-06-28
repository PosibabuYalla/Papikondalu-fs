// User types
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'AGENT';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

// Package types
export interface Package {
  id: string;
  name: string;
  slug: string;
  category: PackageCategory;
  description: string;
  shortDescription: string;
  duration: string;
  durationDays: number;
  durationNights: number;
  startingPoint: string;
  endingPoint: string;
  price: number;
  discountedPrice?: number;
  capacity: number;
  availableSeats: number;
  itinerary: ItineraryItem[];
  includedServices: string[];
  excludedServices: string[];
  cancellationPolicy: string;
  highlights: string[];
  meetingPoint?: string;
  meetingPointLat?: number;
  meetingPointLng?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  isFeatured: boolean;
  totalRatings: number;
  avgRating: number;
  totalBookings: number;
  images: PackageImage[];
  createdAt: string;
}

export type PackageCategory =
  | 'BOAT_TOUR' | 'ADVENTURE' | 'FAMILY' | 'HONEYMOON'
  | 'GROUP' | 'CORPORATE' | 'WEEKEND' | 'OVERNIGHT';

export interface PackageImage {
  id: string;
  url: string;
  key: string;
  altText?: string;
  isPrimary: boolean;
  order: number;
}

export interface ItineraryItem {
  time?: string;
  day?: number;
  activity?: string;
  activities?: string[];
}

// Booking types
export interface Booking {
  id: string;
  bookingNumber: string;
  userId: string;
  packageId: string;
  travelDate: string;
  numberOfPersons: number;
  totalAmount: number;
  taxAmount: number;
  finalAmount: number;
  status: BookingStatus;
  paymentMode?: string;
  bookedByAgentId?: string;
  agent?: { name: string; email: string };
  specialRequests?: string;
  qrCode?: string;
  ticketUrl?: string;
  cancelledAt?: string;
  cancelReason?: string;
  refundAmount?: number;
  package: Package;
  passengers: Passenger[];
  payment?: Payment;
  createdAt: string;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'REFUNDED';

export interface Passenger {
  id: string;
  name: string;
  age: number;
  gender: string;
  aadhaarNumber?: string;
  emergencyContact?: string;
}

// Payment types
export interface Payment {
  id: string;
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  method?: string;
  paidAt?: string;
  createdAt: string;
}

// Review types
export interface Review {
  id: string;
  userId: string;
  packageId: string;
  rating: number;
  title: string;
  content: string;
  photos: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  isVerified: boolean;
  createdAt: string;
  user: { name: string; avatar?: string };
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}
