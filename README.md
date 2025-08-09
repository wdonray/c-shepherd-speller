# C-Shepherd Speller

A simple web application for managing personal spelling data with Google OAuth authentication.

## 🎯 About

C-Shepherd Speller is a Next.js 15 application designed for teachers to help children learn spelling. It allows teachers to manage spelling data including words, sounds, and spelling patterns for their students. The app features Google OAuth authentication for teachers and stores educational data in MongoDB.

### Current Features

- **Google OAuth Authentication**: Secure sign-in for teachers using Google accounts
- **Spelling Data Management**: Add, remove, and organize words, sounds, and spelling patterns for students
- **Teacher Dashboard**: Manage multiple spelling lists and educational content
- **Simple Interface**: Clean, responsive UI built with Tailwind CSS for classroom use
- **MongoDB Storage**: Persistent storage of educational data and student progress

## 🚀 Quick Start

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- MongoDB (local or Atlas)
- Google OAuth credentials

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd c-shepherd-speller

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Setup

Create a `.env.local` file in the root directory:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-here

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/c-shepherd-speller

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000/api/auth/callback/google` to authorized redirect URIs
6. Copy Client ID and Client Secret to your `.env.local`

## 📁 Project Structure

```
c-shepherd-speller/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/         # NextAuth authentication
│   │   │   └── users/        # User data management
│   │   ├── auth/              # Authentication pages
│   │   │   ├── signin/       # Sign in page
│   │   │   ├── signout/      # Sign out page
│   │   │   ├── error/        # Error handling
│   │   │   └── verify-request/ # Email verification
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   └── globals.css       # Global styles
│   ├── components/            # React components
│   │   ├── providers/        # Context providers
│   │   │   └── SessionProvider.tsx
│   │   └── SpellingManager.tsx # Main spelling management component
│   ├── hooks/                # Custom React hooks
│   │   └── useAuth.ts        # Authentication hook
│   ├── lib/                  # Utility functions
│   │   ├── db-utils.ts       # Database operations
│   │   ├── mongodb.ts        # MongoDB connection
│   │   └── mongodb-adapter.ts # NextAuth MongoDB adapter
│   ├── models/               # Database models
│   │   └── User.ts           # User schema
│   ├── types/                # TypeScript types
│   │   └── next-auth.d.ts    # NextAuth type extensions
│   └── middleware.ts         # Next.js middleware
├── scripts/                   # Utility scripts
│   └── test-db.mjs          # Database connection test
├── public/                   # Static assets
└── package.json              # Dependencies and scripts
```

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint (oxlint)
npm run lint:fix     # Fix ESLint errors
npm run test-db      # Test MongoDB connection
```

## 🗄️ Database Schema

### User Model

```typescript
interface User {
  email: string;           // Unique email (from Google OAuth)
  name: string;            // Display name (from Google OAuth)
  image?: string;          // Profile image URL (from Google OAuth)
  words: string[];         // User's word list
  sounds: string[];        # User's sound list
  spelling: string[];      # User's spelling patterns
  lastActive: Date;        # Last activity timestamp
  createdAt: Date;         # Account creation date
  updatedAt: Date;         # Last update date
}
```

## 🔐 Authentication

The application uses NextAuth.js with Google OAuth provider for teacher authentication:

- **Provider**: Google OAuth 2.0
- **Session Strategy**: JWT
- **Database Adapter**: MongoDB
- **Protected Routes**: All spelling management features require teacher authentication

## 📱 API Endpoints

### Authentication

- `GET/POST /api/auth/*` - NextAuth.js authentication routes

### Teacher Data

- `GET /api/users/[id]/spelling` - Retrieve teacher's spelling data for students
- `PUT /api/users/[id]/spelling` - Update teacher's spelling data for students

## 🎨 UI Components

- **SpellingManager**: Main component for teachers to manage spelling data for students
- **SessionProvider**: Wraps the app with authentication context
- **Responsive Design**: Built with Tailwind CSS for classroom and mobile use

## 🧪 Testing

```bash
# Test database connection
npm run test-db
```

## 🚧 Current Status

**Current Status**: 🟡 Basic Implementation Complete  
**Version**: 0.1.0  
**Last Updated**: December 2024

### What's Implemented

- ✅ Google OAuth authentication for teachers
- ✅ Teacher dashboard for managing spelling data (words, sounds, spelling patterns)
- ✅ MongoDB integration for storing educational content
- ✅ Basic UI for classroom spelling management
- ✅ API endpoints for CRUD operations on spelling data

### What's Not Yet Implemented

- ❌ Student accounts and progress tracking
- ❌ Interactive spelling exercises and games
- ❌ Multi-language support for diverse classrooms
- ❌ Assessment and quiz tools
- ❌ Student performance analytics
- ❌ Classroom management features
- ❌ Accessibility features for special needs students

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Ensure proper error handling
- Add tests for new features
- Follow the existing code structure

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Create an issue in the repository
- **Documentation**: Check the code comments and TypeScript types

## 🔮 Future Roadmap

- Student accounts and progress tracking
- Interactive spelling exercises and games
- Multi-language support for diverse classrooms
- Assessment and quiz tools for spelling tests
- Student performance analytics and reports
- Classroom management and student grouping
- Accessibility features for special needs students
- Mobile app for students to practice spelling
- Integration with educational standards and curricula

---

Built with ❤️ for educators using Next.js 15, TypeScript, Tailwind CSS, MongoDB, and NextAuth.js.
