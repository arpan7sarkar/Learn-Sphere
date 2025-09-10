# LearnSphere - Vercel Deployment Guide

This guide will help you deploy LearnSphere to Vercel for production use.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a MongoDB database at [mongodb.com/atlas](https://www.mongodb.com/atlas)
3. **Google AI API Key**: Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. **Clerk Account**: Set up authentication at [clerk.com](https://clerk.com)

## Environment Variables Setup

### Required Environment Variables for Vercel

Set these in your Vercel dashboard under Project Settings > Environment Variables:

```bash
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/learnsphere?retryWrites=true&w=majority

# AI API
GEMINI_API_KEY=your_gemini_api_key_here

# Authentication (Frontend)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here

# Node Environment
NODE_ENV=production
```

### Local Development Environment Variables

Create `.env` files for local development:

#### Root `.env` file:
```bash
MONGO_URI=mongodb://localhost:27017/learnsphere
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
```

#### Frontend `.env` file:
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
VITE_API_BASE_URL=/api
```

## Deployment Steps

### 1. Connect Repository to Vercel

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your repository
5. Configure the project settings:
   - **Framework Preset**: Other
   - **Root Directory**: Leave empty (uses root)
   - **Build Command**: `cd Frontend && npm run build`
   - **Output Directory**: `Frontend/dist`
   - **Install Command**: `cd Frontend && npm install`

### 2. Configure Environment Variables

In your Vercel project dashboard:

1. Go to Settings > Environment Variables
2. Add all the required environment variables listed above
3. Make sure to set them for Production, Preview, and Development environments

### 3. Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Your app will be available at `https://your-project-name.vercel.app`

## Project Structure

```
LearnSphere/
├── api/                    # Serverless API functions
│   ├── courses.js         # Course management endpoints
│   ├── chat.js           # AI chat functionality
│   └── xp.js             # XP and quiz management
├── Frontend/              # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── config/       # API configuration
│   │   └── ...
│   ├── dist/             # Build output (generated)
│   └── package.json
├── Backend/               # Original backend (for reference)
│   ├── models/           # MongoDB models
│   ├── routes/           # Express routes (migrated to /api)
│   └── ...
├── vercel.json           # Vercel configuration
└── package.json          # Root package.json
```

## API Endpoints

The following serverless functions are available:

### Courses API (`/api/courses`)
- `GET /api/courses?userId={userId}` - Get user's courses
- `POST /api/courses` - Generate new course
- `DELETE /api/courses?courseId={courseId}&userId={userId}` - Delete course

### XP API (`/api/xp`)
- `GET /api/xp?action=user&userId={userId}` - Get user XP
- `POST /api/xp?action=quiz-complete` - Complete quiz
- `POST /api/xp?action=lesson-complete` - Complete lesson
- `POST /api/xp?action=quiz-regenerate` - Regenerate quiz questions

### Chat API (`/api/chat`)
- `POST /api/chat` - Send message to AI tutor

## Database Setup

### MongoDB Atlas Configuration

1. Create a new cluster in MongoDB Atlas
2. Create a database user with read/write permissions
3. Whitelist Vercel's IP addresses (or use 0.0.0.0/0 for all IPs)
4. Get your connection string and add it to `MONGO_URI`

### Database Collections

The app uses these MongoDB collections:
- `courses` - Course data and progress
- `xps` - User XP and achievement data

## Authentication Setup

### Clerk Configuration

1. Create a new application in Clerk
2. Configure your domain in Clerk dashboard
3. Add your Vercel domain to allowed origins
4. Copy the publishable key to `VITE_CLERK_PUBLISHABLE_KEY`

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are listed in `Frontend/package.json`
   - Ensure environment variables are set correctly
   - Check build logs for specific errors

2. **API Errors**
   - Verify MongoDB connection string
   - Check that Gemini API key is valid
   - Ensure serverless functions have correct permissions

3. **Authentication Issues**
   - Verify Clerk publishable key
   - Check domain configuration in Clerk dashboard
   - Ensure CORS is properly configured

### Performance Optimization

1. **Cold Start Reduction**
   - Serverless functions may have cold starts
   - Consider upgrading to Vercel Pro for better performance

2. **Database Optimization**
   - Use MongoDB indexes for better query performance
   - Consider connection pooling for high traffic

## Monitoring and Maintenance

### Vercel Analytics
- Enable Vercel Analytics for performance monitoring
- Monitor function execution times and errors

### Database Monitoring
- Use MongoDB Atlas monitoring tools
- Set up alerts for high usage or errors

### Regular Updates
- Keep dependencies updated
- Monitor API usage limits (Gemini API)
- Regular database backups

## Security Considerations

1. **Environment Variables**
   - Never commit API keys to version control
   - Use Vercel's secure environment variable storage

2. **Database Security**
   - Use strong database passwords
   - Regularly rotate credentials
   - Monitor for unusual access patterns

3. **API Rate Limiting**
   - Consider implementing rate limiting for API endpoints
   - Monitor for abuse or unusual usage patterns

## Support

For deployment issues:
1. Check Vercel deployment logs
2. Review MongoDB Atlas logs
3. Verify all environment variables are set correctly
4. Check API key permissions and quotas

## Cost Considerations

### Vercel
- Free tier includes 100GB bandwidth and 100 serverless function executions per day
- Pro plan recommended for production use

### MongoDB Atlas
- Free tier includes 512MB storage
- Paid plans start at $9/month for production use

### Google AI (Gemini)
- Check current pricing at [Google AI pricing](https://ai.google.dev/pricing)
- Monitor usage to avoid unexpected costs
