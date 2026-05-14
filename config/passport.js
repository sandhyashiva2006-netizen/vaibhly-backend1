const passport = require("passport");
const GoogleStrategy =
require("passport-google-oauth20").Strategy;

const pool = require("./db");

passport.use(
new GoogleStrategy(
{
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,

  callbackURL:
"https://vaibhly-backend1.onrender.com/api/auth/google/callback"

},
async (accessToken, refreshToken, profile, done)=>{

 try{

   const email = profile.emails[0].value;
   const name = profile.displayName;

   let user = await pool.query(
     "SELECT * FROM users WHERE email=$1",
     [email]
   );

   if(!user.rows.length){

     const username =
name.toLowerCase().replace(/\s+/g,"") +
Math.floor(1000 + Math.random()*9000);

const created = await pool.query(
  `
  INSERT INTO users
  (name,email,role,username)
  VALUES($1,$2,'student',$3)
  RETURNING *
  `,
  [name,email,username]
);

const newUser = created.rows[0];

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

const referralCode =
name.substring(0,4).toUpperCase() +
Math.floor(1000 + Math.random()*9000) +
newUser.id;

await pool.query(
  `
  UPDATE users
  SET referral_code=$1
  WHERE id=$2
  `,
  [referralCode,newUser.id]
);

user = {
  rows:[{
    ...newUser,
    referral_code:referralCode
  }]
};

    
   }

   return done(null, user.rows[0]);

 }catch(err){
   return done(err,null);
 }

})
);

module.exports = passport;