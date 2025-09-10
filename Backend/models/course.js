const  mongoose = require('mongoose');

// Define nested schemas to maintain structure / Readbility

const QuizQuestionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true },
}, { _id: false });

const QuizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    questions: [QuizQuestionSchema],
}, { _id: false });

const LessonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    xp: { type: Number, required: true },
    quiz: QuizSchema, // Optional quiz
}, { _id: false });

const ChapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    lessons: [LessonSchema],
}, { _id: false });

// Root schema for Course
const CourseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    level: { type: String, required: true },
    imageUrl: { type: String, required: true },
    chapters: [ChapterSchema],
    ownerId: { type: String, required: true },
}, { timestamps: true });

const Course = mongoose.model('Course', CourseSchema);

module.exports = Course;