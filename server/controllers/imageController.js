import axios from "axios";
import FormData from "form-data";
import userModel from "../models/userModel.js";

export const generateImage = async (req, res) => {
    try {
        // Extract userID and prompt from request body
        const { userID, prompt } = req.body;

        // Check if userID or prompt is missing
        if (!userID || !prompt) {
            return res.json({
                success: false,
                message: "Missing userID or prompt",
            });
        }

        // Fetch user from the database
        const user = await userModel.findById(userID);

        // If user does not exist
        if (!user) {
            return res.json({
                success: false,
                message: "User not found",
            });
        }

        // Check user's credit balance
        if (user.creditBalance <= 0) {
            return res.json({
                success: false,
                message: "Insufficient Credit Balance",
                creditBalance: user.creditBalance,
            });
        }

        // Prepare form data for API call
        const formData = new FormData();
        formData.append("prompt", prompt);

        // Call external API for image generation
        const { data } = await axios.post(
            "https://clipdrop-api.co/text-to-image/v1",
            formData,
            {
                headers: {
                    "x-api-key": process.env.CLIPDROP_API,
                },
                responseType: "arraybuffer",
            }
        );

        // Convert response image to base64
        const base64Image = Buffer.from(data, "binary").toString("base64");
        const resultImage = `data:image/png;base64,${base64Image}`;

        // Deduct 1 credit from the user's balance
        const updatedCreditBalance = user.creditBalance - 1;
        await userModel.findByIdAndUpdate(user._id, { creditBalance: updatedCreditBalance });

        // Respond with the generated image and updated credit balance
        return res.json({
            success: true,
            message: "Image Generated Successfully",
            creditBalance: updatedCreditBalance,
            resultImage,
        });

    } catch (error) {
        // Log the error and return an error response
        console.error("Error generating image:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};
