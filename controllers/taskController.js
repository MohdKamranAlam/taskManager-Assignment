const Note = require('../models/Task');
const User = require('../models/User');
const redisClient = require('../config/redisClient'); 

const cacheKey = 'tasks';

const invalidateCache = async () => {
    await redisClient.del(cacheKey);
};

// @desc Get all notes
// @route GET /notes
// @access Private
const getAllTasks = async (req, res) => {
    try {

        // Check if tasks are in cache
        const cachedTasks = await redisClient.get(cacheKey);
        if (cachedTasks) {
            return res.json(JSON.parse(cachedTasks));
        }
        // If not in cache, fetch tasks from MongoDB
        const notes = await Note.find().lean();
        if (!notes.length) {
            return res.status(400).json({ message: 'No notes found' });
        }

        // Add username to each note before sending the response
        const notesWithUser = await Promise.all(notes.map(async (note) => {
            const user = await User.findById(note.user).lean().exec();
            return { ...note, username: user?.username || 'Unknown' };
        }));
        // Cache the results
        await redisClient.set(cacheKey, JSON.stringify(notesWithUser), { EX: 60 }); // Cache for 60 seconds

        res.json(notesWithUser);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc Create new note
// @route POST /notes
// @access Private
const createNewTasks = async (req, res) => {
    try {
        const { user, title, text } = req.body;

        // Confirm data
        if (!user || !title || !text) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check for duplicate title
        const duplicate = await Note.findOne({ title }).collation({ locale: 'en', strength: 2 }).lean().exec();

        if (duplicate) {
            return res.status(409).json({ message: 'Duplicate note title' });
        }

        // Create and store the new note
        const note = await Note.create({ user, title, text });

        await invalidateCache();
        if (note) {
            return res.status(201).json({ message: 'New note created' });
        } else {
            return res.status(400).json({ message: 'Invalid note data received' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc Update a note
// @route PATCH /notes
// @access Private
const updateTasks = async (req, res) => {
    try {
        const { id, user, title, text, completed } = req.body;

        // Confirm data
        if (!id || !user || !title || !text || typeof completed !== 'boolean') {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Confirm note exists to update
        const note = await Note.findById(id).exec();

        if (!note) {
            return res.status(400).json({ message: 'Note not found' });
        }

        // Check for duplicate title
        const duplicate = await Note.findOne({ title }).collation({ locale: 'en', strength: 2 }).lean().exec();

        // Allow renaming of the original note
        if (duplicate && duplicate?._id.toString() !== id) {
            return res.status(409).json({ message: 'Duplicate note title' });
        }

        note.user = user;
        note.title = title;
        note.text = text;
        note.completed = completed;

        const updatedNote = await note.save();

        await invalidateCache();
        res.json(`'${updatedNote.title}' updated`);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc Delete a note
// @route DELETE /notes
// @access Private
const deleteTasks = async (req, res) => {
    try {
        const { id } = req.body;

        // Confirm data
        if (!id) {
            return res.status(400).json({ message: 'Note ID required' });
        }

        // Confirm note exists to delete
        const note = await Note.findById(id).exec();

        if (!note) {
            return res.status(400).json({ message: 'Note not found' });
        }

        const result = await note.deleteOne();

        const reply = `Note '${result.title}' with ID ${result._id} deleted`;

        await invalidateCache();
        res.json(reply);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getAllTasks,
    createNewTasks,
    updateTasks,
    deleteTasks
};
