import userModel from "../models/usermodel.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import razorpay from 'razorpay'
import transactionModel from "../models/transactionModel.js";

// const registerUser = async (req, res)=>{
//     try {
//         const {name, email, password} = req.body;

//         if(!name || !email || !password){
//             return res.json({success:false, message: "Missing Details"})
//         }

//         const salt = await bcrypt.genSalt(10)
//         const hashedPassword = await bcrypt.hash({password, salt})

//         const userData = {
//             name,
//             email, 
//             password: hashedPassword
//         }

//         const newUser = new userModel(userData)
//         const user = await newUser.save()


//         const token = jwt.sign({id: user._id}, process.env.JWT_SECRET)

//         res.json({success: true, token, user: {name: user.name}})

//     } catch (error) {
//         console.log(error)
//         res.json({success: false, message: error.message})
//     }
// }

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check for missing fields
        if (!name || !email || !password) {
            return res.json({ success: false, message: "Missing Details" });
        }

        // Hash the password with bcrypt (10 salt rounds)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Prepare user data
        const userData = {
            name,
            email,
            password: hashedPassword,
        };

        // Save the new user
        const newUser = new userModel(userData);
        const user = await newUser.save();

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "1h",
        });

        // Respond with success
        res.json({ success: true, token, user: { name: user.name } });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

const loginUser = async (req,res)=>{
    try {
        const {email, password} = req.body;
        const user = await userModel.findOne({email})

        if(!user){
            return res.json({success:false, message: "User Does not exist"})
        }
        
        const isMatch = await bcrypt.compare(password, user.password)

        if(isMatch){
            const token = jwt.sign({id: user._id}, process.env.JWT_SECRET)

            res.json({success: true, token, user: {name: user.name}})

        }else{
            return res.json({success:false, message: "Invalid credentials"})
        }

    } catch (error) {
        console.log(error)
        res.json({success: false, message: error.message})
    }
}

const userCredits = async (req, res)=>{
    try {
        const {userID} = req.body

        const user = await userModel.findById(userID)

        res.json({success: true, credits: user.creditBalance, user: {name: user.name}})

    } catch (error) {
        console.log(error)
        res.json({success: false, message: error.message})
    }
}

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRAT,
});

const paymentRazorpay = async(req, res) => {
    try {
        const { userID, planId } = req.body;

        // Validate request body
        if (!userID || !planId) {
            return res.status(400).json({ success: false, message: "Missing Details" });
        }

        // Fetch user data to ensure user exists
        const userData = await userModel.findById(userID);

        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let credits, plan, amount,date;

        // Assign credits and amount based on the planId
        switch (planId) {
            case "Basic":
                plan = "Basic";
                credits = 100;
                amount = 10;
                break;

            case "Advanced":
                plan = "Advanced";
                credits = 500;
                amount = 50;
                break;

            case "Business":
                plan = "Business";
                credits = 5000;
                amount = 250;
                break;

            default:
                return res.status(400).json({ success: false, message: "Invalid planId" });
        }

        date = Date.now()

        // Prepare transaction data
        const transactionData = {
            userID,
            plan,
            amount,
            credits,
            date
        };

        // Save the transaction
        const newTransaction = await transactionModel.create(transactionData);

        // Prepare Razorpay options
        const options = {
            amount: amount * 100, // Convert to smallest currency unit
            currency: process.env.CURRENCY,
            receipt: newTransaction._id,
        };

        // Create Razorpay order
        await razorpayInstance.orders.create(options, (error, order) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ success: false, message: "Razorpay order creation failed" });
            }
            res.json({ success: true, order });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body;

        // Fetch order information from Razorpay
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

        if (orderInfo.status === 'paid') {
            // Retrieve the transaction data using the receipt field
            const transactionData = await transactionModel.findById(orderInfo.receipt);

            if (!transactionData) {
                return res.status(404).json({ success: false, message: 'Transaction not found' });
            }

            // Check if the payment has already been processed
            if (transactionData.payment) {
                return res.status(400).json({ success: false, message: 'Payment already processed' });
            }

            // Retrieve user data
            const userData = await userModel.findById(transactionData.userID);
            if (!userData) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Update the user's credit balance
            const updatedCreditBalance = userData.creditBalance + transactionData.credits;
            await userModel.findByIdAndUpdate(userData._id, { creditBalance: updatedCreditBalance });

            // Mark the transaction as paid
            transactionData.payment = true;
            await transactionData.save(); // Save the updated transaction document

            return res.json({ success: true, message: 'Credits Added' });
        } else {
            return res.status(400).json({ success: false, message: 'Payment not completed' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


export {registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay}