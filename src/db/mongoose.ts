import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomadnest';

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  avatarUrl: { type: String },
  passwordHash: { type: String, required: true },
  createdAt: { type: String }
});

const listingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  hostId: { type: String, required: true },
  hostName: { type: String, required: true },
  title: { type: String, required: true },
  shortDescription: { type: String, required: true },
  fullDescription: { type: String, required: true },
  pricePerMonth: { type: Number, required: true },
  location: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  category: { type: String, required: true },
  images: [{ type: String }],
  amenities: [{ type: String }],
  capacity: { type: Number },
  wifiSpeedMbps: { type: Number },
  rating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  createdAt: { type: String }
});

const reviewSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  listingId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  createdAt: { type: String }
});

const inquirySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  listingId: { type: String, required: true },
  listingTitle: { type: String, required: true },
  listingImage: { type: String, required: true },
  pricePerMonth: { type: Number, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  startDate: { type: String, required: true },
  durationMonths: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  message: { type: String },
  createdAt: { type: String }
});

const contactMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  subject: { type: String },
  message: { type: String },
  createdAt: { type: String }
});

export const UserModel = mongoose.model('User', userSchema);
export const ListingModel = mongoose.model('Listing', listingSchema);
export const ReviewModel = mongoose.model('Review', reviewSchema);
export const InquiryModel = mongoose.model('Inquiry', inquirySchema);
export const ContactMessageModel = mongoose.model('ContactMessage', contactMessageSchema);
