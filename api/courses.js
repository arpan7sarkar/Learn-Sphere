const mongoose = require("mongoose");
const cors = require("cors");
const { jsonrepair } = require("jsonrepair");
const {
  GoogleGenAI,
  Type,
  Chat,
  GenerateContentResponse,
} = require("@google/genai");

// Import models and schema
const Course = require("../Backend/models/course");
const courseGenerationSchema = require("../Backend/schema/courseGenSchema");

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

    if (req.method === 'GET') {
      const { userId } = req.query;
      if (!userId) {
        return res
          .status(400)
          .json({ message: "userId query parameter is required." });
      }
      
      const courses = await Course.find({ ownerId: userId }).sort({
        createdAt: -1,
      });

      // Include computed unlock status for each chapter and lesson
      const coursesWithUnlocks = courses.map((courseDoc) => {
        const course = courseDoc.toObject();
        course.chapters = course.chapters.map((chapter, chapterIndex) => ({
          ...chapter,
          unlocked: courseDoc.isChapterUnlocked(chapterIndex),
          lessons: chapter.lessons.map((lesson, lessonIndex) => ({
            ...lesson,
            unlocked: courseDoc.isLessonUnlocked(chapterIndex, lessonIndex),
          })),
        }));
        return course;
      });

      res.status(200).json(coursesWithUnlocks);
    } else if (req.method === 'POST') {
      const { topic, level, userId } = req.body;
      
      if (!topic || !level || !userId) {
        return res
          .status(400)
          .json({ message: "Topic, level, and userId are required." });
      }
      
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        return res
          .status(500)
          .json({ message: "API Key not configured on server." });
      }
      
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const prompt = `
        You are an expert instructional designer. A user wants a course on the topic: "${topic}" at a "${level}" level.
        Generate a comprehensive, structured course plan tailored to that difficulty level. Add quizzes to each lesson and include a relevant royalty-free image URL based on the specific ${topic}.
        The output MUST be a single, valid JSON object and nothing else.You must have to create at least 5+ chapters and each chapter must have at least 3 lessons.

        The JSON object must have the following structure:
        {
          "title": "Course Title",
          "description": "A short, engaging description of the course.",
          "level": "${level}",
          "imageUrl": "A royalty-free image URL relevant to the course topic (use Unsplash or similar, based on the course title)",
          "chapters": [
            {
              "title": "Chapter 1 Title",
              "lessons": [
                {
                  "title": "Lesson 1.1 Title",
                  "content": "The educational content for this lesson in detailed HTML format with headings, paragraphs, and lists.",
                  "xp": 10,
                  "quiz": {
                    "title": "Quiz title",
                    "questions": [
                      {
                        "question": "Sample question?",
                        "options": ["Option A", "Option B", "Option C", "Option D"],
                        "correctAnswer": "Option A"
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }

        MUST FOllow these guidelines:
        - At least 5-7 chapters.
        - Each chapter must have at least 4+ lessons.
        - Each lesson must have at least 200+ words of HTML content.
        - Each lesson must include a quiz with 3-5 multiple-choice questions.
        - The imageUrl should be a relevant royalty-free image link from Unsplash, using the course title as the search keyword.
      `;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: courseGenerationSchema,
        },
      });

      let rawText = response.text;
      
      // Clean up the response text
      rawText = rawText.replace(/```json|```/g, "").trim();
      rawText = rawText.replace(/^\s*[\r\n]/gm, "");
      rawText = rawText.replace(/,\s*}/g, "}");
      rawText = rawText.replace(/,\s*]/g, "]");

      let generatedCourseData;
      try {
        generatedCourseData = JSON.parse(rawText);
      } catch (err) {
        try {
          const repairedJson = jsonrepair(rawText);
          generatedCourseData = JSON.parse(repairedJson);
        } catch (repairErr) {
          return res.status(500).json({
            message: "AI generated malformed course data. Please try again with a different topic or level.",
            details: "JSON parsing failed even after repair attempts",
          });
        }
      }

      // Validate and normalize data
      if (!generatedCourseData || !generatedCourseData.chapters || !Array.isArray(generatedCourseData.chapters)) {
        return res.status(500).json({
          message: "Generated course data is malformed. Please try again.",
        });
      }

      generatedCourseData.chapters.forEach((chapter) => {
        if (chapter.lessons && Array.isArray(chapter.lessons)) {
          chapter.lessons.forEach((lesson) => {
            if (lesson.quiz && lesson.quiz.questions && Array.isArray(lesson.quiz.questions)) {
              if (!lesson.quiz.title) {
                lesson.quiz.title = `Quiz for ${lesson.title}`;
              }
              lesson.quiz.questions.forEach((q) => {
                if (q.answer && !q.correctAnswer) {
                  q.correctAnswer = q.answer;
                }
              });
            }
          });
        }
      });

      // Ensure imageUrl is set
      if (!generatedCourseData.imageUrl) {
        const searchQuery = encodeURIComponent(generatedCourseData.title || topic);
        generatedCourseData.imageUrl = `https://source.unsplash.com/800x600/?${searchQuery}`;
      }

      // Add ownerId and unlock first chapter
      generatedCourseData.ownerId = userId;
      if (Array.isArray(generatedCourseData.chapters) && generatedCourseData.chapters.length > 0) {
        generatedCourseData.chapters = generatedCourseData.chapters.map((ch, idx) => ({
          ...ch,
          unlocked: idx === 0 ? true : false,
        }));
      }

      const newCourse = new Course(generatedCourseData);
      const savedCourse = await newCourse.save();

      res.status(201).json(savedCourse);
    } else if (req.method === 'DELETE') {
      const { courseId } = req.query;
      const { userId } = req.query;

      if (!userId) {
        return res
          .status(400)
          .json({ message: "userId query parameter is required." });
      }

      const deletedCourse = await Course.findOneAndDelete({
        _id: courseId,
        ownerId: userId,
      });

      if (!deletedCourse) {
        return res
          .status(404)
          .json({ message: "Course not found or not authorized to delete." });
      }

      res.status(200).json({ message: "Course deleted successfully.", courseId });
    } else {
      res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
