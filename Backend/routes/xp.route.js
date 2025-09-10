const express = require('express');
const router = express.Router();
const XP = require('../models/xp.js'); // Assuming the model is in ../models/xp.model.js

router.get('/xp/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let userXP = await XP.findOne({ userId });
        
        // Create new XP record if user doesn't exist
        if (!userXP) {
            userXP = new XP({ userId });
            await userXP.save();
        }
        
        res.status(200).json(userXP);
    } catch (error) {
        console.error('Error fetching user XP:', error.message);
        res.status(500).json({ message: 'Failed to fetch user XP data.' });
    }
});

router.post('/xp/add', async (req, res) => {
    try {
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
        
        res.status(200).json({
            message: 'XP added successfully',
            leveledUp: result.leveledUp,
            newLevel: result.newLevel,
            totalXP: userXP.totalXP,
            currentLevel: userXP.currentLevel,
            xpToNextLevel: userXP.xpToNextLevel
        });
    } catch (error) {
        console.error('Error adding XP:', error.message);
        res.status(500).json({ message: 'Failed to add XP.' });
    }
});

router.post('/xp/achievement', async (req, res) => {
    try {
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
        
        res.status(200).json({
            message: 'Achievement added successfully',
            achievement: { name, description, xpReward: xpReward || 0 },
            totalXP: userXP.totalXP,
            currentLevel: userXP.currentLevel
        });
    } catch (error) {
        console.error('Error adding achievement:', error.message);
        res.status(500).json({ message: 'Failed to add achievement.' });
    }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const leaderboard = await XP.getLeaderboard(parseInt(limit));
        
        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error.message);
        res.status(500).json({ message: 'Failed to fetch leaderboard.' });
    }
});

// Get user rank
router.get('/xp/rank/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const rank = await XP.getUserRank(userId);
        
        if (rank === null) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        res.status(200).json({ userId, rank });
    } catch (error) {
        console.error('Error fetching user rank:', error.message);
        res.status(500).json({ message: 'Failed to fetch user rank.' });
    }
});

router.post('/quiz/complete', async (req, res) => {
    try {
        const { userId, courseId, chapterIndex, lessonIndex, score, totalQuestions, xpReward = 15 } = req.body;
        
        if (!userId || !courseId || chapterIndex === undefined || lessonIndex === undefined || score === undefined || !totalQuestions) {
            return res.status(400).json({ message: 'userId, courseId, chapterIndex, lessonIndex, score, and totalQuestions are required.' });
        }
        
        // Calculate percentage
        const percentage = Math.round((score / totalQuestions) * 100);
        const passed = percentage >= 50;
        
        // Find and update the course
        const course = await Course.findOne({ _id: courseId, ownerId: userId });
        if (!course) {
            return res.status(404).json({ message: 'Course not found.' });
        }
        
        // Update lesson quiz data
        const lesson = course.chapters[chapterIndex].lessons[lessonIndex];
        lesson.attempts += 1;
        lesson.quizScore = percentage;
        lesson.quizPassed = passed;
        
        if (passed) {
            lesson.completed = true;
            
            // Check and update chapter completion
            const chapterCompleted = course.updateChapterCompletion(chapterIndex);
            
            // Add XP for quiz completion
            let userXP = await XP.findOne({ userId });
            if (!userXP) {
                userXP = new XP({ userId });
            }
            
            let finalXP = xpReward;
            if (percentage === 100) {
                finalXP += 10; // Perfect score bonus
            } else if (percentage >= 90) {
                finalXP += 5; // Excellent score bonus
            }
            
            // Bonus XP for completing a chapter
            if (chapterCompleted) {
                finalXP += 25; // Chapter completion bonus
            }
            
            const result = userXP.addXP(finalXP, 'quiz_completion', `${courseId}_${chapterIndex}_${lessonIndex}`);
            await userXP.save();
            
            await course.save();
            
            res.status(200).json({
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
            
            res.status(200).json({
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
    } catch (error) {
        console.error('Error completing quiz:', error.message);
        res.status(500).json({ message: 'Failed to complete quiz.' });
    }
});

router.post('/quiz/regenerate', async (req, res) => {
    try {
        const { userId, courseId, chapterIndex, lessonIndex } = req.body;
        
        if (!userId || !courseId || chapterIndex === undefined || lessonIndex === undefined) {
            return res.status(400).json({ message: 'userId, courseId, chapterIndex, and lessonIndex are required.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ message: 'API Key not configured on server.' });
        }

        // Find the course and lesson
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
                console.error("Failed to parse quiz JSON:", rawText);
                return res.status(500).json({ message: 'Failed to generate valid quiz questions.' });
            }
        }

        // Update the lesson's quiz with new questions
        course.chapters[chapterIndex].lessons[lessonIndex].quiz = {
            title: lesson.quiz.title,
            questions: newQuizData.questions
        };

        await course.save();

        res.status(200).json({ 
            message: 'New quiz questions generated successfully',
            quiz: course.chapters[chapterIndex].lessons[lessonIndex].quiz
        });

    } catch (error) {
        console.error('Error regenerating quiz:', error);
        res.status(500).json({ message: 'Failed to regenerate quiz questions.' });
    }
});


router.post('/lesson/complete', async (req, res) => {
    try {
        const { userId, lessonId, courseId, xpReward = 10 } = req.body;
        
        if (!userId || !lessonId) {
            return res.status(400).json({ message: 'userId and lessonId are required.' });
        }
        
        // Add XP for lesson completion
        let userXP = await XP.findOne({ userId });
        if (!userXP) {
            userXP = new XP({ userId });
        }
        
        const result = userXP.addXP(xpReward, 'lesson_completion', lessonId);
        
        // Update streak
        const streakContinued = userXP.updateStreak();
        if (streakContinued && userXP.streak.current > 1) {
            const bonusXP = Math.min(userXP.streak.current * 2, 20);
            userXP.addXP(bonusXP, 'streak_bonus');
        }
        
        await userXP.save();
        
        res.status(200).json({
            message: 'Lesson completed successfully',
            xpEarned: xpReward,
            leveledUp: result.leveledUp,
            newLevel: result.newLevel,
            totalXP: userXP.totalXP,
            currentLevel: userXP.currentLevel,
            streak: userXP.streak.current
        });
    } catch (error) {
        console.error('Error completing lesson:', error.message);
        res.status(500).json({ message: 'Failed to complete lesson.' });
    }
});

router.post('/xp/streak/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        let userXP = await XP.findOne({ userId });
        if (!userXP) {
            userXP = new XP({ userId });
        }
        
        const streakContinued = userXP.updateStreak();
        
        // Add streak bonus XP if streak continued
        if (streakContinued && userXP.streak.current > 1) {
            const bonusXP = Math.min(userXP.streak.current * 5, 50); // Max 50 XP bonus
            userXP.addXP(bonusXP, 'streak_bonus');
        }
        
        await userXP.save();
        
        res.status(200).json({
            message: 'Streak updated successfully',
            streakContinued,
            currentStreak: userXP.streak.current,
            longestStreak: userXP.streak.longest
        });
    } catch (error) {
        console.error('Error updating streak:', error.message);
        res.status(500).json({ message: 'Failed to update streak.' });
    }
});
module.exports = router;
