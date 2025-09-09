const express = require("express");
const router = express.Router();
const Course = require("../models/course"); // Assuming your Course model is in ../models/course.js
router.get("/api/courses", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ message: "userId query parameter is required." });
    }
    const courses = await Course.find({ ownerId: userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error.message);
    res.status(500).json({ message: "Failed to fetch courses." });
  }
});
module.exports={router};