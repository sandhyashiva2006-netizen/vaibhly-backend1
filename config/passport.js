const passport = require("passport");
const GoogleStrategy =
require("passport-google-oauth20").Strategy;

const pool = require("./db");

passport.use(

  new GoogleStrategy(

    {

  clientID:
    process.env.GOOGLE_CLIENT_ID,

  clientSecret:
    process.env.GOOGLE_CLIENT_SECRET,

  callbackURL:
    "https://vaibhly-backend1.onrender.com/api/auth/google/callback",

  proxy:true,

  passReqToCallback:true

},

    async (
  req,
  accessToken,
  refreshToken,
  profile,
  done
) => {

      try {

        const email =
          profile.emails[0].value;

        const name =
          profile.displayName;

const role =
  req.session.oauthRole ||
  "student";

        let user =
          await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
          );

        /* ===== CREATE USER ===== */

        if(!user.rows.length){

          const username =
  name
  .toLowerCase()
  .replace(/[^a-z0-9]/g,"")
  .substring(0,15) +

  Date.now()
  .toString()
  .slice(-4);

          const created =
            await pool.query(
              `
              INSERT INTO users
              (name,email,role,username)
              VALUES($1,$2,$3,$4)
              RETURNING *
              `,
              [name,email,role,username]
            );

          const newUser =
            created.rows[0];

          /* ===== CREATE WALLET ===== */

          await pool.query(
            `
            INSERT INTO user_wallets
            (user_id,coins)
            VALUES($1,0)
            `,
            [newUser.id]
          );

          /* ===== CREATE REFERRAL ===== */

          const referralPrefix =
  name
  .replace(/[^a-zA-Z]/g,"")
  .substring(0,4)
  .toUpperCase() || "VAI";

          await pool.query(
            `
            UPDATE users
            SET referral_code=$1
            WHERE id=$2
            `,
            [referralCode,newUser.id]
          );

          /* ===== GET UPDATED USER ===== */

          user =
            await pool.query(
              `
              SELECT *
              FROM users
              WHERE id=$1
              `,
              [newUser.id]
            );

        }

        return done(
          null,
          user.rows[0]
        );

      } catch(err) {

        console.error(
          "Google auth error:",
          err
        );

        return done(err,null);

      }

    }

  )

);

module.exports = passport;