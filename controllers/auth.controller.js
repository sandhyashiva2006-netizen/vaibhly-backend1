const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
try {
const { name, email, password, referral } = req.body;

let user = await User.findOne({ email });
if (user) return res.status(400).json({ error: "User already exists" });

const hashed = await bcrypt.hash(password, 10);

user = await User.create({
name,
email,
password: hashed
});

res.json({ success: true });

} catch (err) {
res.status(500).json({ error: "Registration failed" });
}
};

exports.login = async (req, res) => {
try {
const { email, password } = req.body;

const user = await User.findOne({ email });
if (!user) return res.status(400).json({ error: "Invalid credentials" });

const match = await bcrypt.compare(password, user.password);
if (!match) return res.status(400).json({ error: "Invalid credentials" });

const token = jwt.sign(
{ id: user._id, role: user.role },
"SECRET_KEY",
{ expiresIn: "7d" }
);

res.json({ token });

} catch (err) {
res.status(500).json({ error: "Login failed" });
}
};