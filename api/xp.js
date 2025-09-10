const mongoose = require('mongoose');
const axios = require('axios');
const { jsonrepair } = require('jsonrepair');

// Import models
const XP = require('../Backend/models/xp.js');
const Course = require('../Backend/models/course');

// Database connection
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is not defined in environment variables.");
  }

  const connection = await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  cachedDb = connection;
  return connection;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await connectToDatabase();

    const { action, userId, courseId, chapterIndex, lessonIndex } = req.query;

    if (req.method === 'GET') {
      if (action === 'user' && userId) {
        // Get user XP
        let userXP = await XP.findOne({ userId });
        if (!userXP) {
          userXP = new XP({ userId });
          await userXP.save();
        }
        return res.status(200).json(userXP);
      } else if (action === 'leaderboard') {
        // Get leaderboard
        const { limit = 10 } = req.query;
        const leaderboard = await XP.getLeaderboard(parseInt(limit));
        return res.status(200).json(leaderboard);
      } else if (action === 'rank' && userId) {
        // Get user rank
        const rank = await XP.getUserRank(userId);
        if (rank === null) {
          return res.status(404).json({ message: 'User not found.' });
        }
        return res.status(200).json({ userId, rank });
      }
    } else if (req.method === 'POST') {
      if (action === 'add') {
        // Add XP
        const { userId, amount, source, sourceId } = req.body;
        
        if (!userId || !amount || !source) {
          return res.status(400).json({ message: 'userId, amount, and source are required.' });
        }
        
        let userXP = await XP.findOne({ userId });
        if (!userXP) {
          userXP = new XP({ userId });
        }
        
        const result = userXP.addXP(amount, source, sourceId);
        await userXP.save();
        
        return res.status(200).json({
          message: 'XP added successfully',
          leveledUp: result.leveledUp,
          newLevel: result.newLevel,
          totalXP: userXP.totalXP,
          currentLevel: userXP.currentLevel,
          xpToNextLevel: userXP.xpToNextLevel
        });
      } else if (action === 'achievement') {
        // Add achievement
        const { userId, name, description, xpReward } = req.body;
        
        if (!userId || !name || !description) {
          return res.status(400).json({ message: 'userId, name, and description are required.' });
        }
        
        let userXP = await XP.findOne({ userId });
        if (!userXP) {
          userXP = new XP({ userId });
        }
        
        const achievementAdded = userXP.addAchievement(name, description, xpReward || 0);
        
        if (!achievementAdded) {
          return res.status(400).json({ message: 'Achievement already earned.' });
        }
        
        await userXP.save();
        
        return res.status(200).json({
          message: 'Achievement added successfully',
          achievement: { name, description, xpReward: xpReward || 0 },
          totalXP: userXP.totalXP,
          currentLevel: userXP.currentLevel
        });
      } else if (action === 'quiz-complete') {
        // Complete quiz
        const { userId, courseId, chapterIndex, lessonIndex, score, totalQuestions, xpReward = 15 } = req.body;
        
        if (!userId || !courseId || chapterIndex === undefined || lessonIndex === undefined || score === undefined || !totalQuestions) {
          return res.status(400).json({ message: 'userId, courseId, chapterIndex, lessonIndex, score, and totalQuestions are required.' });
        }
        
        const percentage = Math.round((score / totalQuestions) * 100);
        const passed = percentage >= 50;
        
        const course = await Course.findOne({ _id: courseId, ownerId: userId });
        if (!course) {
          return res.status(404).json({ message: 'Course not found.' });
        }
        
        const lesson = course.chapters[chapterIndex].lessons[lessonIndex];
        lesson.attempts += 1;
        lesson.quizScore = percentage;
        lesson.quizPassed = passed;
        
        if (passed) {
          lesson.completed = true;
          
          const chapterCompleted = course.updateChapterCompletion(chapterIndex);
          if (chapterCompleted && chapterIndex + 1 < course.chapters.length) {
            course.chapters[chapterIndex + 1].unlocked = true;
          }
          
          let userXP = await XP.findOne({ userId });
          if (!userXP) {
            userXP = new XP({ userId });
          }
          
          let finalXP = xpReward;
          if (percentage === 100) {
            finalXP += 10;
          } else if (percentage >= 90) {
            finalXP += 5;
          }
          
          if (chapterCompleted) {
            finalXP += 25;
          }
          
          const result = userXP.addXP(finalXP, 'quiz_completion', `${courseId}_${chapterIndex}_${lessonIndex}`);
          await userXP.save();
          await course.save();
          
          return res.status(200).json({
            message: chapterCompleted ? 'Chapter completed! Next chapter unlocked.' : 'Quiz passed! Next lesson unlocked.',
            passed: true,
            score,
            totalQuestions,
            percentage,
            xpEarned: finalXP,
            leveledUp: result.leveledUp,
            newLevel: result.newLevel,
            totalXP: userXP.totalXP,
            currentLevel: userXP.currentLevel,
            attempts: lesson.attempts,
            chapterCompleted,
            isLastLessonInChapter: lessonIndex === course.chapters[chapterIndex].lessons.length - 1
          });
        } else {
          await course.save();
          
          return res.status(200).json({
            message: `You need 50% to unlock the next lesson. You scored ${percentage}%. Try again!`,
            passed: false,
            score,
            totalQuestions,
            percentage,
            xpEarned: 0,
            attempts: lesson.attempts,
            requiredPercentage: 50
          });
        }
      } else if (action === 'quiz-regenerate') {
        // Regenerate quiz
        const { userId, courseId, chapterIndex, lessonIndex } = req.body;
        
        if (!userId || !courseId || chapterIndex === undefined || lessonIndex === undefined) {
          return res.status(400).json({ message: 'userId, courseId, chapterIndex, and lessonIndex are required.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
          return res.status(500).json({ message: 'API Key not configured on server.' });
        }

        const course = await Course.findOne({ _id: courseId, ownerId: userId });
        if (!course) {
          return res.status(404).json({ message: 'Course not found.' });
        }

        const lesson = course.chapters[chapterIndex].lessons[lessonIndex];
        if (!lesson) {
          return res.status(404).json({ message: 'Lesson not found.' });
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `
        Generate a new quiz for the lesson titled "${lesson.title}".
        
        Lesson content: "${lesson.content}"
        
        First, ensure that the lesson content for "${lesson.title}" is at least 300 words long. If it is shorter, expand or elaborate the content to make it at least 300 words while staying relevant and accurate.
        
        Then, create 5 different multiple-choice questions based on this lesson content. Make sure these are NEW questions, different from any previous attempts.
        
        Return ONLY a JSON object in this exact format:
        {
          "questions": [
            {
              "question": "Question text here?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctAnswer": "Option A"
            }
          ]
        }
        
        Make the questions challenging but fair, testing understanding of the key concepts.
        `;

        const response = await axios.post(API_URL, {
          contents: [{ parts: [{ text: prompt }] }]
        });

        let rawText = response.data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json|```/g, '').trim();

        let newQuizData;
        try {
          newQuizData = JSON.parse(rawText);
        } catch (parseError) {
          try {
            const repairedJson = jsonrepair(rawText);
            newQuizData = JSON.parse(repairedJson);
          } catch (repairError) {
            return res.status(500).json({ message: 'Failed to generate valid quiz questions.' });
          }
        }

        course.chapters[chapterIndex].lessons[lessonIndex].quiz = {
          title: lesson.quiz.title,
          questions: newQuizData.questions
        };

        await course.save();

        return res.status(200).json({ 
          message: 'New quiz questions generated successfully',
          quiz: course.chapters[chapterIndex].lessons[lessonIndex].quiz
        });
      } else if (action === 'lesson-complete') {
        // Complete lesson
        const { userId, lessonId, courseId, xpReward = 10 } = req.body;
        
        if (!userId || !lessonId) {
          return res.status(400).json({ message: 'userId and lessonId are required.' });
        }
        
        let userXP = await XP.findOne({ userId });
        if (!userXP) {
          userXP = new XP({ userId });
        }
        
        const result = userXP.addXP(xpReward, 'lesson_completion', lessonId);
        
        const streakContinued = userXP.updateStreak();
        if (streakContinued && userXP.streak.current > 1) {
          const bonusXP = Math.min(userXP.streak.current * 2, 20);
          userXP.addXP(bonusXP, 'streak_bonus');
        }
        
        await userXP.save();
        
        return res.status(200).json({
          message: 'Lesson completed successfully',
          xpEarned: xpReward,
          leveledUp: result.leveledUp,
          newLevel: result.newLevel,
          totalXP: userXP.totalXP,
          currentLevel: userXP.currentLevel,
          streak: userXP.streak.current
        });
      } else if (action === 'streak' && userId) {
        // Update streak
        let userXP = await XP.findOne({ userId });
        if (!userXP) {
          userXP = new XP({ userId });
        }
        
        const streakContinued = userXP.updateStreak();
        
        if (streakContinued && userXP.streak.current > 1) {
          const bonusXP = Math.min(userXP.streak.current * 5, 50);
          userXP.addXP(bonusXP, 'streak_bonus');
        }
        
        await userXP.save();
        
        return res.status(200).json({
          message: 'Streak updated successfully',
          streakContinued,
          currentStreak: userXP.streak.current,
          longestStreak: userXP.streak.longest
        });
      }
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('XP API Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
