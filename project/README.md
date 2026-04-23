# 🎓 Lectomate - AI-Powered Study Assistant

A comprehensive learning platform that transforms your study materials into interactive learning experiences using AI technology.

## ✨ **Features**

### 📚 **Document Processing**
- Upload PDF, DOCX, TXT, PPT files
- AI-powered content extraction
- Automatic note generation
- Smart summarization

### 🎯 **Study Tools**
- **Interactive Notes**: Organized, searchable, editable
- **Smart Flashcards**: Spaced repetition system
- **Auto-generated Quizzes**: Test your knowledge
- **AI Chatbot**: Get instant help with your materials

### 👤 **User Experience**
- Modern, responsive interface
- Progress tracking and analytics
- Personalized study recommendations
- Study streak gamification

## 🚀 **Quick Start**

### **Option 1: Automatic Startup (Windows)**
```bash
# Double-click this file or run:
start.bat
```

### **Option 2: Manual Startup**

**Backend:**
```bash
cd server
node simple-server.js
```

**Frontend:**
```bash
npm run dev
```

**Then visit:** `http://localhost:5173`

## 📋 **System Requirements**

- **Node.js** 18+ 
- **npm** or yarn
- **Modern web browser**
- **4GB+ RAM recommended**

## 🛠️ **Technology Stack**

### **Frontend**
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Vite** for development

### **Backend**
- **Node.js** with Express
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Multer** for file uploads
- **In-memory database** (easily upgradeable to Supabase)

### **AI Integration**
- **OpenAI API** ready (optional)
- **Fallback AI responses** included
- **Document processing pipeline**

## 📁 **Project Structure**

```
lectomate/
├── 📁 src/                    # Frontend source
│   ├── 📁 components/         # React components
│   ├── 📁 context/           # User context & state
│   └── 📁 types/             # TypeScript definitions
├── 📁 server/                 # Backend source
│   ├── 📁 src/
│   │   ├── 📁 config/         # Database configuration
│   │   ├── 📁 middleware/     # Express middleware
│   │   ├── 📁 routes/         # API endpoints
│   │   └── 📁 services/       # Business logic
│   └── 📄 simple-server.js    # Main server file
├── 📄 start.bat              # Windows startup script
└── 📄 README.md              # This file
```

## 🔧 **Configuration**

### **Environment Variables**
Create `server/.env`:
```env
JWT_SECRET=your_jwt_secret_here
PORT=3001
```

### **Database Options**
1. **In-memory** (default) - Perfect for development
2. **Supabase** - For production (instructions in docs)
3. **Any SQL database** - Easy to adapt

## 📚 **Usage Guide**

### **1. Create Account**
- Click "Get Started"
- Fill in your details
- Verify email (optional)

### **2. Upload Documents**
- Navigate to "Upload Documents"
- Drag & drop files or click to browse
- Wait for AI processing

### **3. Study with Generated Content**
- **Notes**: Review AI-generated summaries
- **Flashcards**: Test your recall
- **Quizzes**: Assess your understanding
- **Chat**: Ask questions about your materials

### **4. Track Progress**
- Visit "Profile" to see statistics
- Monitor study streak
- View performance analytics

## 🎯 **API Endpoints**

### **Authentication**
```
POST /api/auth/register    - Create new user
POST /api/auth/login      - User login
GET  /api/auth/me         - Get current user
```

### **Documents**
```
POST /api/documents/upload - Upload file
GET  /api/documents       - List documents
DELETE /api/documents/:id  - Delete document
```

### **Study Content**
```
GET    /api/notes         - Get user notes
POST   /api/notes         - Create note
PUT    /api/notes/:id     - Update note
DELETE /api/notes/:id     - Delete note

GET    /api/flashcards    - Get flashcards
POST   /api/flashcards    - Create flashcard
PUT    /api/flashcards/:id - Update flashcard

GET    /api/quizzes       - Get quizzes
POST   /api/quizzes       - Create quiz
POST   /api/quizzes/:id/attempt - Submit quiz attempt
```

## 🔒 **Security Features**

- **JWT Authentication** with secure tokens
- **Password Hashing** with bcrypt
- **CORS Protection** for API security
- **Input Validation** on all endpoints
- **Rate Limiting** for abuse prevention

## 🎨 **UI/UX Features**

- **Responsive Design** - Works on all devices
- **Dark Mode Ready** - Easy to implement
- **Loading States** - Smooth user experience
- **Error Handling** - User-friendly messages
- **Progress Tracking** - Visual feedback

## 🚀 **Deployment**

### **Development**
```bash
npm run dev  # Frontend
node simple-server.js  # Backend
```

### **Production**
```bash
# Build frontend
npm run build

# Start backend
NODE_ENV=production node simple-server.js

# Serve with nginx or similar
```

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch
3. Make your changes
4. Test thoroughly
5. Submit pull request

## 📄 **License**

MIT License - feel free to use for personal or commercial projects

## 🆘 **Troubleshooting**

### **Common Issues**

**Backend not starting:**
```bash
# Check Node.js version
node --version  # Should be 18+

# Install dependencies
cd server && npm install

# Check port availability
netstat -an | findstr :3001
```

**Frontend blank page:**
```bash
# Clear cache
npm run dev -- --force

# Check for errors in browser console
```

**Registration failing:**
- Ensure backend is running
- Check network tab in browser
- Verify CORS settings

### **Getting Help**

1. Check browser console for errors
2. Verify both servers are running
3. Review this README
4. Check `FINAL_SETUP_GUIDE.md`

## 🎉 **What's Next?**

### **Planned Features**
- [ ] Real Supabase integration
- [ ] OpenAI GPT-4 integration
- [ ] Advanced analytics dashboard
- [ ] Study groups collaboration
- [ ] Mobile app version
- [ ] Offline mode support

### **Customization**
- Easy to add new features
- Modular component architecture
- Scalable backend design
- Customizable AI responses

---

## 📞 **Support**

🎉 **Your AI-powered study assistant is ready!**

Start by running `start.bat` and visit `http://localhost:5173`

Happy studying! 📚✨
