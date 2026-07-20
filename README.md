# NomadNest 🌍✈️ - Backend API

This repository contains the robust Node.js backend for **NomadNest**, a premium, full-stack AI-powered platform tailored for remote workers and digital nomads to discover co-living spaces and connect with like-minded professionals.

## ✨ Key Features

- **🤖 Agentic AI Integration (Powered by Gemini 3.5 Flash)**
  - **AI Concierge (Nestor):** Tool-calling AI endpoint that performs multi-step reasoning, searches the live database for co-living spaces based on user parameters, and provides intelligent suggestions.
  - **AI Listing Copywriter:** Generates professional, search-optimized property descriptions, factoring in amenities, style, and tone specifications.
  - **AI Smart Recommendations:** Provides personalized, weighted property matches with detailed reasoning, using multi-factor analysis on price, location, and features.
- **🔐 Secure & Scalable Architecture**
  - Robust JWT-based authentication system for users, hosts, and admins.
  - Complete integration with Google Auth Library for social login.
  - Granular Role-Based Access Control (RBAC) protecting endpoints.
- **🏡 Core Database Features**
  - Mongoose & MongoDB integration for flexible data storage.
  - Complete CRUD operations for Listings, Reviews, Inquiries, and User Profiles.
  - Advanced querying, filtering, and pagination for fast listing discovery.
- **☁️ Production Ready**
  - Seamless environment separation and decoupled architecture.
  - Pre-configured `vercel.json` for immediate Vercel Serverless deployment.
  - Written entirely in TypeScript for strong type-safety and developer experience.

## 🛠️ Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB & Mongoose
- **Authentication:** JSON Web Tokens (JWT) & Google Auth
- **AI / Machine Learning:** `@google/genai` (Google Gemini API)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB connection string
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/syfulsharif/nomadnest_backend.git
   cd nomadnest_backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   ```
   **Required Environment Variables:**
   - `PORT`: (e.g., 5000)
   - `MONGO_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A secure random string for signing tokens
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `CLIENT_URL`: The URL of your deployed frontend (for CORS setup)

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:5000` (or your configured port).

## 📡 Key API Routes

- **Authentication:**
  - `POST /api/auth/google` - Google Social Login
  - `POST /api/auth/demo` - Auto-login for demo purposes
- **Listings:**
  - `GET /api/listings` - Search, filter, and paginate listings
  - `POST /api/listings` - Create a new listing (Hosts only)
- **Agentic AI:**
  - `POST /api/ai/chat` - Interactive AI Concierge chat endpoint
  - `POST /api/ai/match` - Recommendation engine
  - `POST /api/ai/generate-description` - Listing description writer

