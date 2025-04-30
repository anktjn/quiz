# PDF Quiz Generator

A modern web application that automatically generates quizzes from PDF documents using AI. Upload your study materials, research papers, or books, and get interactive quizzes to test your knowledge.

## 🚀 Technology Stack

- **Frontend**: React 18 with Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with DaisyUI components for a responsive, modern UI
- **Animation**: Framer Motion for smooth, engaging UI transitions
- **Authentication**: Supabase Authentication for secure user management
- **Database & Storage**: Supabase for storing user data, PDFs, and generated quizzes
- **AI Integration**: OpenAI API for intelligent quiz generation from PDF content
- **PDF Processing**: PDF.js and PDF-lib for extracting and manipulating PDF content

## ✨ Key Features

- **PDF Upload & Management**: Upload, organize, and manage your PDF documents
- **AI-Powered Quiz Generation**: Automatically create relevant quiz questions from PDF content
- **Real-Time Progress Tracking**: Monitor quiz generation progress with live updates
- **Book Cover Detection**: Automatic fetching of book covers for a visual document library
- **Background Processing**: Efficient handling of large documents through chunked processing
- **User Dashboard**: Track your quiz history, scores, and document library
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## 🏗️ Architecture

The application follows a component-based architecture with:

- **Services Layer**: Handles external API communication (OpenAI, Supabase)
- **Utils Layer**: Contains utility functions for PDF processing, quiz generation, etc.
- **Components Layer**: Reusable UI components following modern React patterns
- **State Management**: Uses React's built-in hooks (useState, useEffect) for state

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔑 Environment Variables

The application requires the following environment variables:

- `VITE_OPENAI_API_KEY`: Your OpenAI API key
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## 🔄 Workflow

1. Users log in via Supabase Authentication
2. Upload PDFs to Supabase Storage
3. The app extracts text content from PDFs
4. Text is sent to OpenAI API in manageable chunks
5. AI generates relevant quiz questions based on content
6. Users take the quiz and receive immediate feedback
7. Quiz results are saved to the user's profile

## 📚 Database Schema

The application uses Supabase with the following main tables:
- `pdfs`: Stores metadata about uploaded PDFs
- `quizzes`: Contains generated quiz data
- `quiz_attempts`: Tracks user attempts and scores

## 🧩 Component Structure

- **Dashboard**: Main user interface showing PDF library
- **Quiz**: Interactive quiz component with question navigation
- **Results**: Displays quiz outcomes with score analysis
- **UploadModal**: Handles PDF uploads with validation
- **BookCard**: Visual representation of PDF documents

## 📋 Future Enhancements

- Expanded quiz types (multiple choice, true/false, fill-in-the-blank)
- Collaborative study groups
- Enhanced analytics on learning progress
- Mobile app versions
