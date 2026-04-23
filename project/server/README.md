# Lectomate Backend API

A comprehensive backend API for the Lectomate AI-powered study assistant. This API handles user authentication, document processing, AI-powered content generation, and all core functionality for the learning platform.

## Features

- **User Authentication**: JWT-based registration and login system
- **Document Upload & Processing**: Support for PDF, DOCX, TXT files with AI-powered content extraction
- **AI Content Generation**: Automatic generation of notes, flashcards, and quizzes using OpenAI
- **Study Tools**: Flashcard system with spaced repetition, quiz system with performance tracking
- **AI Chatbot**: Intelligent tutoring assistant with document context awareness
- **User Analytics**: Comprehensive study statistics and progress tracking
- **Database**: PostgreSQL with Supabase integration

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL via Supabase
- **Authentication**: JWT with bcryptjs
- **AI Integration**: OpenAI API
- **File Processing**: pdf-parse, mammoth
- **File Upload**: Multer
- **Security**: Helmet, CORS, rate limiting

## Prerequisites

- Node.js 18+ 
- PostgreSQL database (Supabase recommended)
- OpenAI API key (optional - fallback responses available)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lectomate/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** in `.env`:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Database Configuration (Supabase)
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=7d

   # OpenAI Configuration (optional)
   OPENAI_API_KEY=your_openai_api_key

   # File Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOAD_DIR=uploads

   # CORS Configuration
   FRONTEND_URL=http://localhost:5173

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

5. **Database Setup**
   - Create a Supabase project
   - Run the SQL schema from `database/schema.sql` in your Supabase SQL editor
   - Update your Supabase credentials in `.env`

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

The server will start on `http://localhost:3001` by default.

## API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication Endpoints

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

### Document Endpoints

#### Upload Document
```http
POST /documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <document_file>
```

#### Get User Documents
```http
GET /documents
Authorization: Bearer <token>
```

#### Delete Document
```http
DELETE /documents/:id
Authorization: Bearer <token>
```

### Notes Endpoints

#### Get All Notes
```http
GET /notes
Authorization: Bearer <token>
```

#### Get Single Note
```http
GET /notes/:id
Authorization: Bearer <token>
```

#### Update Note
```http
PUT /notes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "sections": [...],
  "tags": ["tag1", "tag2"]
}
```

#### Delete Note
```http
DELETE /notes/:id
Authorization: Bearer <token>
```

### Flashcards Endpoints

#### Get All Flashcards
```http
GET /flashcards
Authorization: Bearer <token>
```

#### Create Flashcard
```http
POST /flashcards
Authorization: Bearer <token>
Content-Type: application/json

{
  "noteId": "note-id",
  "front": "What is AI?",
  "back": "Artificial Intelligence is...",
  "difficulty": "medium"
}
```

#### Review Flashcard
```http
POST /flashcards/:id/review
Authorization: Bearer <token>
Content-Type: application/json

{
  "correct": true
}
```

### Quiz Endpoints

#### Get All Quizzes
```http
GET /quizzes
Authorization: Bearer <token>
```

#### Submit Quiz Attempt
```http
POST /quizzes/:id/attempt
Authorization: Bearer <token>
Content-Type: application/json

{
  "answers": ["answer1", "answer2", ...],
  "timeSpent": 300
}
```

### Chat Endpoints

#### Send Message
```http
POST /chat/message
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Explain machine learning"
}
```

#### Get Suggestions
```http
GET /chat/suggestions
Authorization: Bearer <token>
```

### User Profile Endpoints

#### Get Profile
```http
GET /user/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "new@example.com"
}
```

#### Get Statistics
```http
GET /user/stats
Authorization: Bearer <token>
```

## Database Schema

The application uses the following main tables:

- **users**: User accounts and profiles
- **documents**: Uploaded files and processing status
- **notes**: AI-generated study notes
- **flashcards**: Study flashcards with review tracking
- **quizzes**: Generated quizzes and attempts
- **quiz_attempts**: Individual quiz attempts and scores
- **chat_messages**: Chat history (optional)

See `database/schema.sql` for the complete schema definition.

## AI Services

### OpenAI Integration
The API integrates with OpenAI for:
- Document content analysis and summarization
- Flashcard generation
- Quiz question creation
- Chatbot responses

### Fallback Mode
If no OpenAI API key is provided, the system operates in fallback mode with:
- Basic text processing
- Template-based content generation
- Rule-based chatbot responses

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet.js security headers
- Row-level security in database
- Input validation and sanitization

## File Upload Support

### Supported Formats
- PDF (.pdf)
- Microsoft Word (.docx, .doc - limited)
- Plain Text (.txt)
- PowerPoint (.pptx - text extraction only)

### File Size Limits
- Default: 10MB per file
- Configurable via `MAX_FILE_SIZE` environment variable

## Error Handling

The API uses consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "stack": "Error stack (development only)"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## Development

### Project Structure
```
src/
├── config/          # Database configuration
├── middleware/      # Express middleware
├── routes/         # API route handlers
├── services/       # Business logic and AI services
├── types/          # TypeScript type definitions
└── index.ts        # Server entry point
```

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests (when implemented)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `JWT_SECRET` | Yes | JWT signing secret |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `FRONTEND_URL` | No | CORS allowed origin |

## Deployment

### Environment Setup
1. Set production environment variables
2. Build the application: `npm run build`
3. Start the server: `npm start`

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## Monitoring and Logging

- Request logging with Morgan
- Error logging with stack traces
- Health check endpoint at `/health`
- Performance metrics in user statistics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the API documentation above
- Review the error logs for debugging
