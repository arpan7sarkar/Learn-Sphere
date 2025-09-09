const router = require("express").Router();
const express = require("express");
const courseRouter = require("./course.route");
const xpRouter = require("./xp.route");
const chatRouter = require("./chat.route");


router.use("/courses", courseRouter);
router.use("/xp", xpRouter);
router.use("/chat", chatRouter);

module.exports = router;

