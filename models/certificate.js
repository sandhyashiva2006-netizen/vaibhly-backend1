const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  studentName: String,
  courseName: String,
  issuedAt: { type: Date, default: Date.now },
  qrUrl: String
});

module.exports = mongoose.model("Certificate", certificateSchema);
