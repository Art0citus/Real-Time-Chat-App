import User from "../models/user.model.js";
import Message from "../models/message.model.js";

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
    } catch (error) {
        console.error("Error fetching users for sidebar:", error.message);
        res.status(500).json({ error: "Server error" });
    }

};

export const getMessages = async (req, res) => {
    try {
        const { id: UserToChatId } = req.params;
        const myId = req.user._id;
        const messages = await Message.find({
            $or: [
                { senderId:myId, receiverId: UserToChatId }, 
                { senderId:UserToChatId, receiverId: myId }
            ]
        })
        res.status(200).json(messages);
    } catch (error) {
        console.error("Error getMessage Controller:", error.message);
        res.status(500).json({ error: "Server error" });
    }
};      

export const sendMessage = async (req, res) => {
    try {
        const { id: receiverId } = req.params;
        const senderId = req.user._id;
        const { text, image } = req.body;
        
        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image) 
            imageUrl = uploadResponse.secure_url;

        }
        const   newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
        });
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Error sendMessage Controller:", error.message);
        res.status(500).json({ error: "Server error" });
    }
};
