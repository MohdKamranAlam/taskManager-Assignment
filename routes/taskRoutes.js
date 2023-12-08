const express = require('express')
const router = express.Router()
const taskController = require('../controllers/taskController')
const verifyJWT = require('../middleware/verifyJWT')

router.use(verifyJWT)

router.route('/')
    .get(taskController.getAllTasks)
    .post(taskController.createNewTasks)
    .patch(taskController.updateTasks)
    .delete(taskController.deleteTasks)

module.exports = router