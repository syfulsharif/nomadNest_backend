/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'nomad' | 'host' | 'admin';
  createdAt: string;
}

export interface Listing {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  pricePerMonth: number;
  location: string;
  city: string;
  country: string;
  category: 'Beachfront' | 'City Co-living' | 'Mountain Retreat' | 'Rural Escape' | 'Creative Space';
  images: string[];
  amenities: string[];
  capacity: number;
  wifiSpeedMbps: number;
  rating: number;
  reviewsCount: number;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface Review {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface BookingInquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  pricePerMonth: number;
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  durationMonths: number;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestions?: string[];
  searchResults?: Listing[];
}

export interface UserPreferences {
  budget: number;
  location: string;
  durationMonths: number;
  needsWifi: boolean;
  allowsPets: boolean;
  categoryPreference?: string;
}

export interface RecommendationResult {
  listingId: string;
  matchScore: number;
  reason: string;
}
