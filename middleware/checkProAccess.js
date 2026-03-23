const pool = require('../db'); // your postgres connection

const checkProAccess = async (req, res, next) => {
    try {
        const userId = req.user.id; // assuming auth middleware sets this

        const result = await pool.query(
            `SELECT * FROM user_subscriptions
             WHERE user_id = $1
             AND status = 'active'
             AND end_date > NOW()`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({
                error: "Pro subscription required"
            });
        }

        next();
    } catch (err) {
        console.error("Pro access check failed:", err);
        res.status(500).json({ error: "Server error" });
    }
};

module.exports = checkProAccess;
