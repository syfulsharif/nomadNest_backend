import { UserModel, ListingModel, ReviewModel, InquiryModel, ContactMessageModel, connectDB } from './mongoose.js';
import { User, Listing, Review, BookingInquiry } from '../types.js';

class MongoDatabase {
  constructor() {}

  async connect() {
    await connectDB();
  }

  // Users CRUD
  async getUsers(): Promise<User[]> {
    const users = await UserModel.find().lean();
    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as 'nomad' | 'host' | 'admin',
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt
    }));
  }

  async getUserById(id: string): Promise<User | undefined> {
    const u = await UserModel.findOne({ id }).lean();
    if (!u) return undefined;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as 'nomad' | 'host' | 'admin',
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const u = await UserModel.findOne({ email: new RegExp(`^${email}$`, 'i') }).lean();
    if (!u) return undefined;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as 'nomad' | 'host' | 'admin',
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt
    };
  }

  async getPasswordHashForUser(userId: string): Promise<string | undefined> {
    const u = await UserModel.findOne({ id: userId }).lean();
    return u?.passwordHash;
  }

  async addUser(user: User, passwordHash: string): Promise<User> {
    const newUser = new UserModel({
      ...user,
      passwordHash
    });
    await newUser.save();
    return user;
  }

  // Listings CRUD
  async getListings(): Promise<Listing[]> {
    const listings = await ListingModel.find().lean();
    return listings as Listing[];
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    const l = await ListingModel.findOne({ id }).lean();
    return l ? (l as Listing) : undefined;
  }

  async addListing(listing: Listing): Promise<Listing> {
    const newListing = new ListingModel(listing);
    await newListing.save();
    return listing;
  }

  async deleteListing(id: string): Promise<boolean> {
    const result = await ListingModel.deleteOne({ id });
    await ReviewModel.deleteMany({ listingId: id });
    await InquiryModel.deleteMany({ listingId: id });
    return result.deletedCount > 0;
  }

  async updateListing(listing: Listing): Promise<Listing | undefined> {
    const result = await ListingModel.findOneAndUpdate({ id: listing.id }, listing, { new: true }).lean();
    return result ? (result as Listing) : undefined;
  }

  // Reviews CRUD
  async getReviews(): Promise<Review[]> {
    const reviews = await ReviewModel.find().lean();
    return reviews as Review[];
  }

  async getReviewsForListing(listingId: string): Promise<Review[]> {
    const reviews = await ReviewModel.find({ listingId }).lean();
    return reviews as Review[];
  }

  async addReview(review: Review): Promise<Review> {
    const newReview = new ReviewModel(review);
    await newReview.save();
    
    // Recalculate listing rating & reviewsCount
    const relatedReviews = await ReviewModel.find({ listingId: review.listingId }).lean();
    const totalRating = relatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const reviewsCount = relatedReviews.length;
    const rating = parseFloat((totalRating / reviewsCount).toFixed(2));
    
    await ListingModel.updateOne({ id: review.listingId }, { reviewsCount, rating });
    
    return review;
  }

  // Booking Inquiries CRUD
  async getInquiries(): Promise<BookingInquiry[]> {
    const inquiries = await InquiryModel.find().lean();
    return inquiries as unknown as BookingInquiry[];
  }

  async getInquiriesForUser(userId: string): Promise<BookingInquiry[]> {
    const inquiries = await InquiryModel.find({ userId }).lean();
    return inquiries as unknown as BookingInquiry[];
  }

  async getInquiriesForHost(hostId: string): Promise<BookingInquiry[]> {
    const hostListings = await ListingModel.find({ hostId }, { id: 1 }).lean();
    const listingIds = hostListings.map(l => l.id);
    const inquiries = await InquiryModel.find({ listingId: { $in: listingIds } }).lean();
    return inquiries as unknown as BookingInquiry[];
  }

  async addInquiry(inquiry: BookingInquiry): Promise<BookingInquiry> {
    const newInquiry = new InquiryModel(inquiry);
    await newInquiry.save();
    return inquiry;
  }

  async updateInquiryStatus(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
    const result = await InquiryModel.updateOne({ id }, { status });
    return result.modifiedCount > 0;
  }

  // Contact Messages
  async addContactMessage(message: any) {
    const newMessage = new ContactMessageModel({
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      ...message,
      createdAt: new Date().toISOString()
    });
    await newMessage.save();
  }
}

export const db = new MongoDatabase();
