#!/bin/bash

# Lectomate Backend Setup Script
# This script helps set up the backend environment

echo "🚀 Setting up Lectomate Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p uploads

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating environment file..."
    cp .env.example .env
    echo "📝 Please update .env with your configuration:"
    echo "   - Supabase URL and keys"
    echo "   - JWT secret"
    echo "   - OpenAI API key (optional)"
    echo "   - Frontend URL"
else
    echo "✅ Environment file already exists"
fi

# Check if TypeScript compiles
echo "🔍 Checking TypeScript compilation..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

echo "✅ TypeScript compilation successful"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Set up your Supabase database using database/schema.sql"
echo "3. Run 'npm run dev' to start the development server"
echo "4. Visit http://localhost:3001/health to verify the server is running"
echo ""
echo "📚 For more information, see README.md"
