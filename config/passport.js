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
  req.query.state ||
  "student";

        let user =
          await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
          );

/* ===== UPDATE ROLE IF DIFFERENT ===== */

if(user.rows.length){

  const existingUser =
    user.rows[0];

  if(existingUser.role !== role){

    await pool.query(
      `
      UPDATE users
      SET role=$1
      WHERE id=$2
      `,
      [role, existingUser.id]
    );

    user =
      await pool.query(
        `
        SELECT *
        FROM users
        WHERE id=$1
        `,
        [existingUser.id]
      );

  }

}

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
(name,email,password,role,username)
VALUES($1,$2,$3,$4,$5)
RETURNING *
              `,
              [
  name,
  email,
  "GOOGLE_AUTH_USER",
  role,
  username
]
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

const referralCode =

  referralPrefix +

  Math.floor(
    1000 + Math.random()*9000
  ) +

  newUser.id;

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