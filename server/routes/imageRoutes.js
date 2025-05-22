import express from 'express'
import {generateImage} from '../controllers/imageController.js'
import userAuth from '../middlewares/auth.js'

const imageRouter = express.Router()

imageRouter.post('/generate-image', userAuth , generateImage)

//we provide the userID by middleware so that in this imageRouter we add this middlerware = userAuth

export default imageRouter