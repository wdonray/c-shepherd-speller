# C-Shepherd Speller

A modern web application for intelligent spelling assistance and language learning tools.

## 🎯 About

C-Shepherd Speller is a Next.js 15 application designed to provide real-time spelling assistance, personalized learning paths, and comprehensive language support with accessibility-first design principles.

### Key Features

- **Real-Time Spelling Check**: Instant feedback and suggestions as you type
- **Personalized Learning**: Adaptive difficulty based on your performance
- **Multi-Language Support**: English variants, Spanish, French, German
- **Accessibility First**: WCAG 2.1 AA compliant with screen reader support
- **Educational Tools**: Word definitions, etymology, and usage examples
- **Progress Tracking**: Visual analytics and improvement insights

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

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
MONGODB_DB_NAME=c-shepherd-speller

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Environment
NODE_ENV=development
```

## 📁 Project Structure

```
c-shepherd-speller/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Dashboard pages
│   │   ├── practice/          # Practice interface
│   │   └── progress/          # Progress tracking
│   ├── components/            # React components
│   │   ├── auth/             # Authentication components
│   │   ├── ui/               # UI components
│   │   └── layout/           # Layout components
│   ├── lib/                  # Utility functions
│   ├── models/               # Database models
│   ├── types/                # TypeScript types
│   └── hooks/                # Custom React hooks
├── docs/                     # Documentation
├── public/                   # Static assets
└── tests/                    # Test files
```

## 📚 Documentation

- **[Implementation Guide](docs/implementation-guide.md)** - Step-by-step development roadmap
- **[App Usage & Product Vision](docs/app-usage-and-product-vision.md)** - Product overview and features
- **[MongoDB Connection Guide](docs/mongodb-connection-guide.md)** - Database setup and configuration
- **[UI Guidelines](docs/ui-guidelines.md)** - Design system and component library
- **[API Route Skeletons](docs/api-route-skeletons.md)** - API structure and patterns
- **[NextAuth Integration](docs/nextauth-integration.md)** - Authentication setup
- **[Security & Compliance](docs/security-and-compliance.md)** - Security best practices

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm test             # Run tests
npm run test:e2e     # Run E2E tests
```

## 🎯 Success Metrics

- **Performance**: < 2s page load time, < 500ms API response
- **Accessibility**: WCAG 2.1 AA compliance
- **User Engagement**: 70% daily active users
- **Learning Outcomes**: 25% improvement in spelling accuracy
- **Technical**: 99.9% uptime, < 1% error rate

## 🛡️ Security & Privacy

- Data encryption in transit and at rest
- GDPR and CCPA compliance
- Regular security audits
- Privacy-first design principles

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the [Implementation Guide](docs/implementation-guide.md) for setup
- Adhere to the [UI Guidelines](docs/ui-guidelines.md) for components
- Write tests for new features
- Ensure accessibility compliance
- Follow TypeScript best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs](docs/) folder for detailed guides
- **Issues**: Create an issue in the repository
- **Email**: support@c-shepherd-speller.com

## 🚧 Status

**Current Status**: 🟡 In Development  
**Version**: 0.1.0  
**Last Updated**: December 2024

---

Built with ❤️ using Next.js, TypeScript, Tailwind CSS, and MongoDB.
