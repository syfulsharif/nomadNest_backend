import { db } from './src/db/db.js';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';
import cors from 'cors';
import { User, Listing, Review, BookingInquiry, ChatMessage, UserPreferences } from './src/types.js';

dotenv.config();

const app = express();

db.connect();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nomadnest_secret_jwt_key_2026';

app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Initialize Gemini SDK safely
let ai: GoogleGenAI | null = null;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini API initialized successfully.');
  } catch (error) {
    console.error('Error initializing Gemini API:', error);
  }
} else {
  console.warn('GEMINI_API_KEY is not configured or holds placeholder. Gemini features will run in fallback simulation mode.');
}

// Custom Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
};

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// Register User
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const existingUser = await db.getUserByEmail(email);
  if (existingUser) {
    res.status(400).json({ error: 'Email already registered' });
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const newUser: User = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      name,
      email,
      role: role === 'host' ? 'host' : 'nomad',
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      createdAt: new Date().toISOString()
    };

    await db.addUser(newUser, passwordHash);

    // Create JWT Token
    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.status(201).json({ user: newUser, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login User
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await db.getUserByEmail(email);
  if (!user) {
    res.status(400).json({ error: 'Invalid credentials' });
    return;
  }

  const hash = await db.getPasswordHashForUser(user.id);
  if (!hash) {
    res.status(400).json({ error: 'Invalid credentials' });
    return;
  }

  try {
    const isMatch = await bcrypt.compare(password, hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    // Create JWT Token
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});


// Google Social Login
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req: Request, res: Response) => {
  const { credential, email, name, avatarUrl } = req.body;
  // Fallback to accepting basic info if no google client id is set for the project
  let userEmail = email;
  let userName = name;
  let userAvatar = avatarUrl;
  
  if (credential && process.env.GOOGLE_CLIENT_ID) {
    try {
      const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID, 
      });
      const payload = ticket.getPayload();
      userEmail = payload?.email;
      userName = payload?.name;
      userAvatar = payload?.picture;
    } catch (e) {
      res.status(401).json({ error: 'Invalid Google token' });
      return;
    }
  }
  
  if (!userEmail) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  
  let user = await db.getUserByEmail(userEmail);
  if (!user) {
    user = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      name: userName || 'Google User',
      email: userEmail,
      role: 'nomad',
      avatarUrl: userAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(userName || 'Google User')}`,
      createdAt: new Date().toISOString()
    };
    await db.addUser(user, 'social-login-no-password');
  }
  
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ user, token });
});

// Logout User
app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Me endpoint
app.get('/api/auth/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// Demo account auto-login
app.post('/api/auth/demo', async (req: Request, res: Response) => {
  try {
    const demoUser = await db.getUserByEmail('demo@nomadnest.com');
    if (!demoUser) {
      res.status(404).json({ error: 'Demo account not initialized' });
      return;
    }

    const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.json({ user: demoUser, token });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in as Demo user' });
  }
});

// ==========================================
// 2. LISTINGS ENDPOINTS
// ==========================================

// Get Listings with pagination, filtering & search
app.get('/api/listings', async (req: Request, res: Response) => {
  const search = (req.query.search as string || '').toLowerCase();
  const category = req.query.category as string || '';
  const minPrice = parseInt(req.query.minPrice as string || '0', 10);
  const maxPrice = parseInt(req.query.maxPrice as string || '999999', 10);
  const minRating = parseFloat(req.query.minRating as string || '0');
  const sortBy = req.query.sortBy as string || 'newest';
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '8', 10);

  let filteredListings = await db.getListings();

  // Keyword search (title, shortDescription, location, city, country)
  if (search) {
    filteredListings = filteredListings.filter(l => 
      l.title.toLowerCase().includes(search) ||
      l.shortDescription.toLowerCase().includes(search) ||
      l.location.toLowerCase().includes(search) ||
      l.city.toLowerCase().includes(search) ||
      l.country.toLowerCase().includes(search)
    );
  }

  // Category filter
  if (category && category !== 'All') {
    filteredListings = filteredListings.filter(l => l.category === category);
  }

  // Price range filter
  filteredListings = filteredListings.filter(l => l.pricePerMonth >= minPrice && l.pricePerMonth <= maxPrice);

  // Rating filter
  if (minRating > 0) {
    filteredListings = filteredListings.filter(l => l.rating >= minRating);
  }

  // Sorting
  if (sortBy === 'price_asc') {
    filteredListings.sort((a, b) => a.pricePerMonth - b.pricePerMonth);
  } else if (sortBy === 'price_desc') {
    filteredListings.sort((a, b) => b.pricePerMonth - a.pricePerMonth);
  } else if (sortBy === 'rating') {
    filteredListings.sort((a, b) => b.rating - a.rating);
  } else { // 'newest'
    filteredListings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Pagination
  const totalCount = filteredListings.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + pageSize);

  res.json({
    listings: paginatedListings,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page
  });
});

// Get single listing with reviews
app.get('/api/listings/:id', async (req: Request, res: Response) => {
  const listing = await db.getListingById(req.params.id);
  if (!listing) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }

  const reviews = await db.getReviewsForListing(listing.id);
  res.json({ listing, reviews });
});

// Create new listing (Protected)
app.post('/api/listings', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user || user.role !== 'host') {
    res.status(403).json({ error: 'Only hosts can publish listings' });
    return;
  }

  const { title, shortDescription, fullDescription, pricePerMonth, location, city, country, category, images, amenities, capacity, wifiSpeedMbps } = req.body;

  if (!title || !shortDescription || !fullDescription || !pricePerMonth || !location || !city || !country || !category) {
    res.status(400).json({ error: 'Missing required listing fields' });
    return;
  }

  const imageArray = Array.isArray(images) && images.length > 0 
    ? images 
    : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&h=500&q=80'];

  const newListing: Listing = {
    id: 'list_' + Math.random().toString(36).substring(2, 9),
    hostId: user.id,
    hostName: user.name,
    title,
    shortDescription,
    fullDescription,
    pricePerMonth: Number(pricePerMonth),
    location,
    city,
    country,
    category,
    images: imageArray,
    amenities: Array.isArray(amenities) ? amenities : ['High-Speed Wifi'],
    capacity: Number(capacity || 2),
    wifiSpeedMbps: Number(wifiSpeedMbps || 100),
    rating: 5.0,
    reviewsCount: 0,
    createdAt: new Date().toISOString()
  };

  await db.addListing(newListing);
  res.status(201).json(newListing);
});

// Delete listing (Protected)
app.delete('/api/listings/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const listingId = req.params.id;

  const listing = await db.getListingById(listingId);
  if (!listing) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }

  // Ensure only the host who created it (or an admin) can delete it
  if (!user || (user.id !== listing.hostId && user.role !== 'admin')) {
    res.status(403).json({ error: 'Unauthorized to delete this listing' });
    return;
  }

  const deleted = await db.deleteListing(listingId);
  if (deleted) {
    res.json({ success: true, message: 'Listing deleted successfully' });
  } else {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// ==========================================
// 3. REVIEWS ENDPOINTS
// ==========================================

// Add Review (Protected)
app.post('/api/reviews', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { listingId, rating, comment } = req.body;

  if (!user) {
    res.status(401).json({ error: 'Auth required' });
    return;
  }

  if (!listingId || !rating || !comment) {
    res.status(400).json({ error: 'Listing ID, rating, and comment are required' });
    return;
  }

  const listing = await db.getListingById(listingId);
  if (!listing) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }

  const newReview: Review = {
    id: 'rev_' + Math.random().toString(36).substring(2, 9),
    listingId,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatarUrl,
    rating: Number(rating),
    comment,
    createdAt: new Date().toISOString()
  };

  await db.addReview(newReview);
  res.status(201).json(newReview);
});

// ==========================================
// 4. INQUIRIES ENDPOINTS
// ==========================================

// Create booking inquiry (Protected)
app.post('/api/inquiries', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { listingId, startDate, durationMonths, message } = req.body;

  if (!user) {
    res.status(401).json({ error: 'Auth required' });
    return;
  }

  if (!listingId || !startDate || !durationMonths) {
    res.status(400).json({ error: 'Listing ID, start date, and duration are required' });
    return;
  }

  const listing = await db.getListingById(listingId);
  if (!listing) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }

  const newInquiry: BookingInquiry = {
    id: 'inq_' + Math.random().toString(36).substring(2, 9),
    listingId,
    listingTitle: listing.title,
    listingImage: listing.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=120&h=80&q=80',
    pricePerMonth: listing.pricePerMonth,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    startDate,
    durationMonths: Number(durationMonths),
    status: 'pending',
    message,
    createdAt: new Date().toISOString()
  };

  await db.addInquiry(newInquiry);
  res.status(201).json(newInquiry);
});

// Get user inquiries (Protected)
app.get('/api/inquiries', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Auth required' });
    return;
  }

  if (user.role === 'host') {
    const inquiries = await db.getInquiriesForHost(user.id);
    res.json({ inquiries });
  } else {
    const inquiries = await db.getInquiriesForUser(user.id);
    res.json({ inquiries });
  }
});

// Update inquiry status (Protected, Host only)
app.post('/api/inquiries/:id/status', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { status } = req.body;

  if (!user || user.role !== 'host') {
    res.status(403).json({ error: 'Only hosts can manage inquiry statuses' });
    return;
  }

  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({ error: 'Status must be approved or rejected' });
    return;
  }

  const success = await db.updateInquiryStatus(req.params.id, status);
  if (success) {
    res.json({ success: true, message: `Inquiry status updated to ${status}` });
  } else {
    res.status(404).json({ error: 'Inquiry not found' });
  }
});

// ==========================================
// 5. CONTACT ENDPOINT
// ==========================================
app.post('/api/contact', async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    res.status(400).json({ error: 'Name, email, and message are required' });
    return;
  }

  await db.addContactMessage({ name, email, subject, message });
  res.json({ success: true, message: 'Message recorded successfully. We will contact you soon.' });
});

// ==========================================
// 6. AGENTIC AI ENDPOINTS (PART 2)
// ==========================================

// A. AI SMART RECOMMENDATION ENGINE (Property Matching)
app.post('/api/ai/match', async (req: Request, res: Response) => {
  const { preferences, historyIds, currentListingId } = req.body;

  const userPrefs: UserPreferences = preferences || {
    budget: 1500,
    location: '',
    durationMonths: 1,
    needsWifi: true,
    allowsPets: false
  };

  const listings = await db.getListings();

  // If Gemini API is available, do real multi-step structured reasoning matching
  if (ai) {
    try {
      const candidatesText = listings.map(l => ({
        id: l.id,
        title: l.title,
        price: l.pricePerMonth,
        location: l.location,
        category: l.category,
        wifiSpeedMbps: l.wifiSpeedMbps,
        amenities: l.amenities,
        capacity: l.capacity,
        rating: l.rating
      }));

      const systemPrompt = `You are the core intelligence matching engine of NomadNest.
Your task is to analyze a digital nomad's workspace & housing preferences against a set of real co-living listings.
You must compute a match score (0-100) for EACH listing based on budget, location relevance, and nomad amenities (high wifi speeds, workspace setups, community features).
For each listing, write a crisp 1-sentence explanation of why it is matching or where it falls short.
Return the results in STRICT JSON format as a list of recommendation items.
JSON Schema:
{
  "recommendations": [
    {
      "listingId": "STRING",
      "matchScore": NUMBER,
      "reason": "STRING"
    }
  ]
}`;

      const userPrompt = `USER PREFERENCES:
- Budget Limit: $${userPrefs.budget}/month
- Desired Location: "${userPrefs.location}"
- Stay Duration: ${userPrefs.durationMonths} month(s)
- High-Speed Wifi Required: ${userPrefs.needsWifi ? 'Yes' : 'No'}
- Pets Allowed Required: ${userPrefs.allowsPets ? 'Yes' : 'No'}
${currentListingId ? `- CURRENTLY VIEWING PROPERTY ID: "${currentListingId}" (highly prioritize similar options or related features)` : ''}
${userPrefs.categoryPreference ? `- Category Preference: "${userPrefs.categoryPreference}"` : ''}
${historyIds && historyIds.length > 0 ? `- Interaction History: User recently viewed listings [${historyIds.join(', ')}] (understand their interests)` : ''}

CANDIDATE CO-LIVING SPACES:
${JSON.stringify(candidatesText, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    listingId: { type: Type.STRING },
                    matchScore: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  },
                  required: ['listingId', 'matchScore', 'reason']
                }
              }
            },
            required: ['recommendations']
          }
        }
      });

      const responseText = response.text || '';
      const parsed = JSON.parse(responseText.trim());
      
      // Sort recommendations by score descending
      const recommendations = parsed.recommendations || [];
      recommendations.sort((a: any, b: any) => b.matchScore - a.matchScore);

      res.json({ recommendations });
      return;
    } catch (error) {
      console.error('Gemini Recommendation API error, running fallback matching logic:', error);
    }
  }

  // FALLBACK SIMULATION (When API Key is missing or fails)
  // Perform lightweight algorithmic matching
  const recommendations = listings.map(l => {
    let score = 80; // base score

    // Budget matching
    if (l.pricePerMonth <= userPrefs.budget) {
      score += 10;
    } else {
      const excess = l.pricePerMonth - userPrefs.budget;
      score -= Math.min(30, Math.floor(excess / 20));
    }

    // Location matching
    if (userPrefs.location) {
      const locLower = userPrefs.location.toLowerCase();
      if (l.location.toLowerCase().includes(locLower) || l.city.toLowerCase().includes(locLower) || l.country.toLowerCase().includes(locLower)) {
        score += 15;
      }
    }

    // Wifi check
    if (userPrefs.needsWifi && l.wifiSpeedMbps >= 100) {
      score += 5;
    }

    // Pet check
    if (userPrefs.allowsPets && l.amenities.some(a => a.toLowerCase().includes('pet'))) {
      score += 10;
    }

    // Category Preference matching
    if (userPrefs.categoryPreference && l.category === userPrefs.categoryPreference) {
      score += 12;
    }

    // Cap score at 100, floor at 10
    score = Math.max(15, Math.min(98, score));

    // Simple reasons
    let reason = `Matches your preference for premium work-friendly facilities with speed-tested ${l.wifiSpeedMbps} Mbps fiber.`;
    if (l.pricePerMonth > userPrefs.budget) {
      reason = `Slightly above your $${userPrefs.budget} budget, but offers exceptional ${l.wifiSpeedMbps} Mbps fiber and premium workspaces.`;
    } else if (userPrefs.location && l.location.toLowerCase().includes(userPrefs.location.toLowerCase())) {
      reason = `Perfect match for your target destination of ${l.city}, boasting a top-rated ${l.rating} rating and extensive amenities.`;
    }

    return {
      listingId: l.id,
      matchScore: score,
      reason
    };
  });

  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  res.json({ recommendations: recommendations.slice(0, 5) });
});

// B. AI CHAT ASSISTANT (Persistent, context-aware, tool calling)
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { message, history } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const listings = await db.getListings();

  // If Gemini API is available, use it with a tool / function definition
  if (ai) {
    try {
      // Define a custom search listings function
      const searchListingsTool = {
        name: 'searchListings',
        description: 'Searches the NomadNest co-living space catalog for listings matching location, max price, category, or amenities.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING, description: 'Optional city or country name (e.g., Lisbon, Bali, Medellin)' },
            maxPrice: { type: Type.NUMBER, description: 'Optional maximum price per month' },
            category: { type: Type.STRING, description: 'Optional category: Beachfront, City Co-living, Mountain Retreat, Rural Escape, Creative Space' },
            query: { type: Type.STRING, description: 'General keyword query (e.g., wifi speed, surfboard, yoga, recording booth)' }
          }
        }
      };

      // Construct messages for Chat API or standard GenerateContent with history
      const formattedHistory = (history || []).map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      // Append new user prompt
      const contents = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] }
      ];

      const systemInstruction = `You are "Nestor", the highly intelligent NomadNest in-app AI Concierge.
You guide remote workers and digital nomads in finding their ideal furnished co-living rentals, answering site navigation queries, and recommending cities.
You have access to a search tool called "searchListings" to query the live listing database.
If the user asks for properties in a location, cheap places, or with certain amenities (like pets allowed, recording studio, or beach access), you MUST call the searchListings tool first to get accurate records. Do not make up properties.
Keep your tone incredibly friendly, objective, worldly, and helpful. Always offer 2-3 short, highly clickable follow-up suggestions (as separate fields in your final response) to guide their search.

CRITICAL: Since this is an interactive chat, your final text response should be friendly and in markdown formatting.
If you call the searchListings tool, the system will execute it and return the database output, then you can craft your final text response summarizing those listings.

YOUR CURRENT KNOWLEDGE OF NOMADNEST CAPABILITIES:
- Users can log in using standard or Demo login.
- Users can post listings on Add Listing page (hosts only).
- Users can manage their own listings on Manage Listings page.
- Users can request bookings on any listing details page.
- There is a Smart recommendation rail on Explore and Details page.`;

      const initialResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [searchListingsTool] }],
          toolConfig: { includeServerSideToolInvocations: true }
        }
      });

      // Check if Gemini wants to call the tool
      const functionCalls = initialResponse.functionCalls;
      let toolExecutionResult: any = null;
      let executedListings: Listing[] = [];

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'searchListings') {
          const args = (call.args as any) || {};
          
          // Execute Search Listings tool over local database
          let results = await db.getListings();

          if (args.location) {
            const loc = args.location.toLowerCase();
            results = results.filter(l => l.location.toLowerCase().includes(loc) || l.city.toLowerCase().includes(loc) || l.country.toLowerCase().includes(loc));
          }
          if (args.maxPrice) {
            results = results.filter(l => l.pricePerMonth <= args.maxPrice);
          }
          if (args.category) {
            results = results.filter(l => l.category.toLowerCase() === args.category.toLowerCase());
          }
          if (args.query) {
            const q = args.query.toLowerCase();
            results = results.filter(l => 
              l.title.toLowerCase().includes(q) || 
              l.shortDescription.toLowerCase().includes(q) || 
              l.fullDescription.toLowerCase().includes(q) ||
              l.amenities.some(a => a.toLowerCase().includes(q))
            );
          }

          executedListings = results;
          toolExecutionResult = {
            searchOutput: results.map(r => ({
              id: r.id,
              title: r.title,
              location: r.location,
              price: r.pricePerMonth,
              category: r.category,
              wifi: r.wifiSpeedMbps,
              amenities: r.amenities
            }))
          };

          // Send the tool results back to Gemini for the final turn response
          const toolResponsePart = {
            functionResponse: {
              name: 'searchListings',
              response: toolExecutionResult,
              id: call.id
            }
          };

          const contentsWithTool = [
            ...contents,
            initialResponse.candidates?.[0]?.content, // includes the model's tool call part
            { role: 'user', parts: [toolResponsePart] }
          ];

          const finalResponse = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: contentsWithTool,
            config: { systemInstruction }
          });

          // Extract suggestions structure via a mini structured turn or manual parsing
          const finalPrompt = `Based on your previous message: "${finalResponse.text}". Please provide 2-3 short, engaging suggested follow-up questions a digital nomad might ask.
Return them as a simple JSON string under the format:
{ "suggestions": ["suggestion 1", "suggestion 2"] }`;

          const suggestionsResponse = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: finalPrompt,
            config: { responseMimeType: 'application/json' }
          });

          let suggestions = ['Show me oceanfront spaces', 'What is the cheapest co-living?', 'Tell me about Canggu'];
          try {
            const parsedSuggestions = JSON.parse(suggestionsResponse.text?.trim() || '{}');
            if (parsedSuggestions.suggestions) {
              suggestions = parsedSuggestions.suggestions;
            }
          } catch (e) {
            // fallback
          }

          res.json({
            text: finalResponse.text || "I've searched our co-living listings and compiled the best options for you.",
            suggestions,
            searchResults: executedListings
          });
          return;
        }
      }

      // No tool call needed, just a direct text turn
      const directText = initialResponse.text || '';
      
      // Get suggestions for the direct text
      const finalPrompt = `Based on your response: "${directText}". Provide 2-3 short, engaging suggested follow-up questions a digital nomad might ask next.
Return them in STRICT JSON under format: { "suggestions": ["suggestion 1", "suggestion 2"] }`;

      const suggestionsResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: finalPrompt,
        config: { responseMimeType: 'application/json' }
      });

      let suggestions = ['Tell me more about Outpost Canggu', 'Show me listings in Tuscany', 'How do I add a listing?'];
      try {
        const parsedSuggestions = JSON.parse(suggestionsResponse.text?.trim() || '{}');
        if (parsedSuggestions.suggestions) {
          suggestions = parsedSuggestions.suggestions;
        }
      } catch (e) {}

      res.json({
        text: directText,
        suggestions,
        searchResults: []
      });
      return;
    } catch (error) {
      console.error('Gemini Chat Assistant error, running fallback chat response:', error);
    }
  }

  // FALLBACK SIMULATION (When API Key is missing or fails)
  const query = message.toLowerCase();
  let text = '';
  let suggestions: string[] = [];
  let searchResults: Listing[] = [];

  if (query.includes('canggu') || query.includes('bali') || query.includes('outpost')) {
    text = `🌴 **Outpost Canggu** is our absolute premium co-living space in Bali! It features extreme **150 Mbps fiber wifi**, a refreshing swimming pool, high-tech ergonomic desks, and private calling booths. \n\nIt is priced at **$1200/month** and is just 5 minutes from Canggu beach. Would you like me to guide you to place a booking inquiry?`;
    searchResults = [listings[0]];
    suggestions = ['How do I book Outpost Canggu?', 'Show me other Beachfront spaces', 'What is the weather like in Canggu?'];
  } else if (query.includes('lisbon') || query.includes('portugal') || query.includes('selina')) {
    text = `🇵🇹 **Selina Secret Garden** is highly recommended for city lovers! Centered in Chiado, Lisbon, this gorgeous loft has **300 Mbps fiber wifi**, adjustable standing desks, and a lively sunset social mixer program.\n\nIt is priced at **$1650/month**.`;
    searchResults = [listings[1]];
    suggestions = ['Show other City Co-living', 'Show me cheaper listings', 'What amenities are included in Lisbon?'];
  } else if (query.includes('cheap') || query.includes('budget') || query.includes('medellin')) {
    const sorted = [...listings].sort((a,b) => a.pricePerMonth - b.pricePerMonth);
    text = `💰 Here are our most budget-friendly nomad-spaces! \n\n1. **El Poblado Oasis** in Medellin, Colombia (**$1100/month**) - Andes views & premium call pods.\n2. **The Surf House** in Costa Rica (**$1150/month**) - Starlink backing & beachfront jungle feel.\n3. **Outpost Canggu** in Bali (**$1200/month**) - Beachfront paradise.`;
    searchResults = sorted.slice(0, 3);
    suggestions = ['Tell me about El Poblado Oasis', 'Show me places with high wifi speeds', 'Search for Tuscany mill'];
  } else if (query.includes('pet') || query.includes('dog') || query.includes('cat')) {
    const petListings = listings.filter(l => l.amenities.some(a => a.toLowerCase().includes('pet')));
    text = `🐾 Finding pet-friendly spaces is super easy on NomadNest! \n\nHere are properties that explicitly welcome pets:\n\n- **The Green Mill** (Tuscany, Italy - $1400/month)\n- **The Surf House** (Santa Teresa, Costa Rica - $1150/month)\n\nBoth feature extensive gardens or outdoor trails!`;
    searchResults = petListings;
    suggestions = ['Show details for Tuscan Mill', 'Tell me about Costa Rica Surf House', 'Show all Beachfront listings'];
  } else {
    text = `Hello there! I am **Nestor**, your NomadNest AI Concierge. ✈️\n\nI can help you search our premium listings, match co-living spaces to your budget, and guide you around the platform. \n\nWhat kind of remote-working setup are you looking for today? (e.g. *beachfront in Bali*, *cheap city lofts*, *pet-friendly countryside retreat*)`;
    suggestions = ['Show beachfront listings', 'What are the cheapest spaces?', 'Show me Lisbon co-living'];
  }

  res.json({ text, suggestions, searchResults });
});

// C. AI CONTENT GENERATOR (Add Listing description auto-writer)
app.post('/api/ai/generate-description', async (req: Request, res: Response) => {
  const { category, city, country, amenities, style, length, keywords } = req.body;

  const styleChoice = style || 'modern';
  const lenChoice = length || 'Standard Descriptive';
  const keywordString = keywords || '';
  const amenityList = Array.isArray(amenities) ? amenities : [];

  const systemPrompt = `You are a professional copywriter specializing in digital nomad co-living spaces and premium real-estate descriptions.
Your job is to generate a compelling, search-optimized property listing matching the user's specs: category, location, style guidelines, amenities, and optional custom bullet points.
You must return a Title, a Short Description (maximum 120 characters, suitable for listing card search grids), and a Full Workspace Description.
Ensure the tone is professional, adventurous, and inspiring. Mention ergonomic workspace features, internet speeds, and community aspects based on the amenities provided.
The output length should strictly adhere to: ${lenChoice}.
Return the output in STRICT JSON format:
{
  "title": "STRING",
  "shortDescription": "STRING (under 120 characters)",
  "fullDescription": "STRING (comprehensive, markdown formatted with paragraphs and bullet points)"
}`;

  const userPrompt = `INPUT SPECIFICATIONS:
- Category: ${category || 'City Co-living'}
- Location: ${city || 'Lisbon'}, ${country || 'Portugal'}
- Design/Atmosphere Style: ${styleChoice}
- Target Description Length & Style: ${lenChoice}
- Included Amenities: ${amenityList.join(', ')}
- Custom Host Keywords/Bullet Points: "${keywordString}"`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              shortDescription: { type: Type.STRING },
              fullDescription: { type: Type.STRING }
            },
            required: ['title', 'shortDescription', 'fullDescription']
          }
        }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      res.json(parsed);
      return;
    } catch (err) {
      console.error('Gemini Description Generator failed, running fallback:', err);
    }
  }

  // Fallback description generator
  const generatedTitle = `Spectacular ${styleChoice.charAt(0).toUpperCase() + styleChoice.slice(1)} ${category} in ${city}`;
  const generatedShortDescription = `A beautifully verified ${styleChoice} workspace in ${city}, ${country} equipped with ${amenityList.slice(0, 3).join(', ')}.`;
  
  let generatedFullDescription = `Welcome to our exquisite co-living haven located in the heart of ${city}, ${country}! Designed specifically for digital nomads, remote workers, and creative professionals who seek the ultimate balance between deep work and rich leisure.

### The Space & Work Environment
This ${styleChoice} property features premium ergonomics to guarantee maximum productivity. Stay connected with blazing-fast high-speed internet, and enjoy our custom workstations equipped with high-quality seating. 
${keywordString ? `\n*Host Highlights:* ${keywordString}\n` : ''}
### Amenities & Community
- **Work-focused:** Enjoy access to dedicated areas including ${amenityList.join(', ')}.
- **Relaxation:** Unwind after deep-work sprints and connect with our thriving community of international remote professionals.
- **Location:** Nestled in a premium zone of ${city}, you are steps away from delicious local restaurants, vibrant cafes, and inspiring cultural landmarks.

Join a supportive global network of entrepreneurs and creators today!`;

  if (lenChoice === 'Short & Punchy') {
    generatedFullDescription = `Experience the ultimate digital nomad lifestyle in ${city}, ${country}. This premium ${styleChoice} ${category} is fully equipped with ${amenityList.join(', ')}. Perfect for high-output builders and creators looking for a focus-oriented community. Includes ultra-fast internet and ergonomic desks. Book your spot today!`;
  }

  res.json({
    title: generatedTitle,
    shortDescription: generatedShortDescription.substring(0, 120),
    fullDescription: generatedFullDescription
  });
});

// ==========================================
// 7. SERVING THE FRONTEND & VITE INTEGRATION
// ==========================================

async function startServer() {
  app.get('/', (req, res) => {
    res.json({ message: 'NomadNest Backend API Running' });
  });

  // Only listen if not running on Vercel Serverless
  if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`NomadNest Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

// Export the Express API for Vercel deployment
export default app;
