import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel, ListingModel, ReviewModel, InquiryModel } from './src/db/mongoose.js';

dotenv.config();

const DEFAULT_USERS = [
  {
    id: 'user_1',
    email: 'demo@nomadnest.com',
    name: 'Alex Nomad',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
    role: 'nomad',
    passwordHash: '$2a$10$WpZ6/yNid/hGqfW.p8b9We4D6v5Z8rFz8M7e9uCAtGv6oYp9b6aJy', // hashed 'password123'
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_2',
    email: 'sarah.host@nomadnest.com',
    name: 'Sarah Jenkins',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80',
    role: 'host',
    passwordHash: '$2a$10$WpZ6/yNid/hGqfW.p8b9We4D6v5Z8rFz8M7e9uCAtGv6oYp9b6aJy', // hashed 'password123'
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_3',
    email: 'carlos@nomadnest.com',
    name: 'Carlos Mendez',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    role: 'nomad',
    passwordHash: '$2a$10$WpZ6/yNid/hGqfW.p8b9We4D6v5Z8rFz8M7e9uCAtGv6oYp9b6aJy', // hashed 'password123'
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_LISTINGS = [
  {
    id: 'list_1',
    hostId: 'user_2',
    hostName: 'Sarah Jenkins',
    title: 'Outpost Canggu – Premium Nomad Sanctum',
    shortDescription: 'Coliving sanctuary in the heart of Canggu with 150 Mbps fiber, swimming pool, and ergonomic workspaces.',
    fullDescription: 'Outpost Canggu is a premium co-living space designed from the ground up for remote workers, digital nomads, and creators. Located just 5 minutes from Canggu beach, we offer a perfect balance of deep work and tropical lifestyle. Our high-tech workspaces feature dual-monitor stations, premium ergonomic chairs, phone booths, and private conference rooms. After work hours, enjoy our lush gardens, dive into the refreshing swimming pool, or join our community networking dinners and weekly masterclasses. Each room has air conditioning, a private bathroom, and high-quality premium linens.',
    pricePerMonth: 1200,
    location: 'Canggu, Bali',
    city: 'Canggu',
    country: 'Indonesia',
    category: 'Beachfront',
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&h=500&q=80'
    ],
    amenities: ['150 Mbps Fiber Wifi', 'Dedicated Ergonomic Desk', 'Swimming Pool', 'Community Kitchen', 'Weekly Masterclasses', 'AC', 'Private Bathroom', 'Daily Housekeeping', 'Coffee Bar'],
    capacity: 25,
    wifiSpeedMbps: 150,
    rating: 4.8,
    reviewsCount: 3,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'list_2',
    hostId: 'user_2',
    hostName: 'Sarah Jenkins',
    title: 'Selina Secret Garden – Historic Chiado Loft',
    shortDescription: 'Historic co-living loft in downtown Lisbon with a vibrant rooftop cafe, standing desks, and community community events.',
    fullDescription: 'Immerse yourself in the charming streets of Lisbon at Selina Secret Garden. Located in the trendy Chiado neighborhood, this meticulously restored 18th-century loft combines European history with state-of-the-art nomad infrastructure. Our coworking zone is equipped with adjustable standing desks, external keyboards/monitors, and high-speed enterprise-grade fiber connection. Step outside to find artisan coffee houses, direct tramlines, and breathtaking viewpoints. Meet fellow remote workers at our rooftop sunset mixers, yoga classes, and fado music evenings.',
    pricePerMonth: 1650,
    location: 'Chiado, Lisbon',
    city: 'Lisbon',
    country: 'Portugal',
    category: 'City Co-living',
    images: [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&h=500&q=80'
    ],
    amenities: ['300 Mbps Fiber Wifi', 'Standing Desks', 'Rooftop Lounge', 'Weekly Social Mixers', 'Shared Kitchen', 'Laundry Facilities', 'Coffee Bar', 'Air Conditioning', 'Bicycle Parking'],
    capacity: 18,
    wifiSpeedMbps: 300,
    rating: 4.9,
    reviewsCount: 2,
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_REVIEWS = [
  {
    id: 'rev_1',
    listingId: 'list_1',
    userId: 'user_1',
    userName: 'Alex Nomad',
    userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 5,
    comment: 'Outpost Canggu exceeded all my expectations! The workspace is better than most dedicated co-working offices in Europe, and the community of nomads here is incredibly inspiring. The internet speed was extremely reliable. I will definitely be staying here again on my next Bali stint!',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  }
];

async function seedDatabase() {
  console.log('--- Database Seeding Script ---');
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ No MONGODB_URI found in .env file!');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB.');

    console.log('Clearing existing collections...');
    await UserModel.deleteMany({});
    await ListingModel.deleteMany({});
    await ReviewModel.deleteMany({});
    await InquiryModel.deleteMany({});
    console.log('✅ Collections cleared.');

    console.log('Inserting Users...');
    await UserModel.insertMany(DEFAULT_USERS);
    
    console.log('Inserting Listings...');
    await ListingModel.insertMany(DEFAULT_LISTINGS);
    
    console.log('Inserting Reviews...');
    await ReviewModel.insertMany(DEFAULT_REVIEWS);

    console.log('✅ Seed data inserted successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
    process.exit(0);
  }
}

seedDatabase();
