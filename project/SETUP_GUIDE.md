# Lectomate Setup Guide

This guide will help you set up the complete Lectomate application with the backend and frontend working together.

## 🚀 Quick Setup

### 1. Backend Setup

```bash
cd server
npm install
cp .env.example .env
```

**Configure your `.env` file:**
```env
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_key_here

# Optional (for AI features)
OPENAI_API_KEY=your_openai_api_key

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

**Database Setup:**
1. Create a Supabase project at https://supabase.com
2. Run the SQL from `server/database/schema.sql` in your Supabase SQL editor
3. Update your Supabase credentials in the `.env` file

**Start Backend Server:**
```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### 2. Frontend Setup

The frontend is already configured to work with the backend. Just start it:

```bash
cd ..
npm run dev
```

The frontend will run on `http://localhost:5173`

### 3. Test the Application

1. **Open your browser** and go to `http://localhost:5173`
2. **Create an account** by clicking "Get Started"
3. **Upload a PDF document** to test the document processing
4. **Check the generated notes** in the Notes section

## 🔧 What's Fixed

### ✅ User Authentication Issue
- **Problem**: Created user data didn't match logged-in user
- **Solution**: Connected frontend to real backend API
- **Result**: User authentication now works with real database

### ✅ PDF Content Extraction Issue  
- **Problem**: Static text was showing instead of actual PDF content
- **Solution**: Implemented real file upload and processing
- **Result**: PDF files are now processed with actual content extraction

## 📋 Features Working

- ✅ User registration and login
- ✅ Real document upload with progress tracking
- ✅ PDF content extraction and AI processing
- ✅ Dynamic note generation from uploaded files
- ✅ Flashcard creation from document content
- ✅ Quiz generation from study materials
- ✅ AI chatbot with document context
- ✅ User statistics and progress tracking

## 🛠️ Troubleshooting

### Backend Not Starting
```bash
# Check if port 3001 is available
netstat -an | findstr :3001

# Kill any process using port 3001
taskkill /PID <PID> /F
```

### Database Connection Issues
1. Verify your Supabase URL and keys in `.env`
2. Make sure you ran the SQL schema in Supabase
3. Check that Row Level Security is enabled

### File Upload Issues
1. Check that the `uploads` directory exists in `server/`
2. Verify file size is under 10MB
3. Make sure backend server is running

### Frontend Connection Issues
1. Ensure backend is running on `http://localhost:3001`
2. Check browser console for CORS errors
3. Verify JWT token is stored in localStorage

## 🎯 Next Steps

1. **Add OpenAI API Key** for better AI content generation
2. **Upload your study materials** to test the full workflow
3. **Explore all features**: notes, flashcards, quizzes, chat
4. **Check user statistics** to track your learning progress

## 📞 Support

If you encounter issues:

1. **Check the console** - Both frontend and backend show detailed error logs
2. **Verify environment variables** - Make sure all required variables are set
3. **Test API endpoints** - Visit `http://localhost:3001/health` to check backend status

## 🎉 You're All Set!

Your Lectomate application is now fully functional with:
- Real user authentication
- Actual PDF content processing  
- AI-powered study tools
- Complete backend integration

Happy studying! 📚✨
