const express = require('express');
const router = express.Router();
const XP = require('../models/xp.model'); // Assuming the model is in ../models/xp.model.js

router.get('/:userId', async (req, res) => {
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

router.post('/add', async (req, res) => {
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

app.post('/api/xp/achievement', async (req, res) => {
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
router.get('/api/leaderboard', async (req, res) => {
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
router.get('/api/xp/rank/:userId', async (req, res) => {
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
module.exports = {router};
