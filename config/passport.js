const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("../config/db");

passport.use(new GoogleStrategy({
  clientID: "394853156717-1947i2tce9etqbu7foil6upajrljmrpb.apps.googleusercontent.com",
  clientSecret: "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",
  callbackURL: "/api/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {

  const email = profile.emails[0].value;
  const name = profile.displayName;

  let user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) {

    const newUser = await pool.query(
      `INSERT INTO users (name, email, role)
       VALUES ($1,$2,'student')
       RETURNING *`,
      [name, email]
    );

    user = newUser;
  }

  return done(null, user.rows[0]);
}
));

module.exports = passport;