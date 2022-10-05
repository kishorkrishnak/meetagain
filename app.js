const path = require("path");
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const flash = require("connect-flash");
require("dotenv").config();
const session = require("express-session");
const { ensureAuthenticated } = require("./config/auth.js");
const nodemailer = require("nodemailer");
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    userFindAndModify: false,
  });
};
connectDB();
let credSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});
let User = mongoose.model("User", credSchema);
let submitSchema = new mongoose.Schema({
  realname: String,
  platform: String,
  username: String,
  contactemail: String,
  discordid: String,
  note: String,
});
let Submit = mongoose.model("Submit", submitSchema);
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "meetagainsite@gmail.com",
    pass: "kishorx123",
  },
});
const LocalStrategy = require("passport-local").Strategy;
const passport = require("passport");
const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 3000;
app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
  })
);
// passport middleware
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});
app.listen(PORT, () => {
  console.log("server started");
});
app.get("/", (req, res) => {
  res.render("index");
});
app.get("/contact", (req, res) => {
  res.render("contact");
});
app.post("/contact", (req, res) => {
  res.render("contactthanks");
});
app.get("/submitpage", (req, res) => {
  res.render("submitpage");
});
app.post("/submitpage", (req, res) => {
  var submit_instance = new Submit({
    realname: req.body.name,
    platform: req.body.platform,
    username: req.body.username.toLowerCase().trim(),
    contactemail: req.body.contactemail,
    discordid: req.body.discord,
    note: req.body.message,
  });
  submit_instance
    .save()
    .then((submit) => {
      req.flash("success_msg", "You are now registered and can login");
      res.render("submitthanks");
    })
    .catch((err) => console.log(err));
});
app.get("/signin", (req, res) => {
  if (req.user) {
    res.render("dashboard");
  } else {
    res.render("signinpage");
  }
});
app.get("/login", (req, res) => {
  if (req.user) {
    res.render("dashboard");
  } else {
    res.render("signinpage");
  }
});
app.post("/signup", (req, res) => {
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const password2 = req.body.password2;
  let errors = [];
  if (!username || !email || !password || !password2) {
    errors.push({ msg: "Please fill in all fields" });
  } else if (password !== password2) {
    errors.push({ msg: "Passwords do not match" });
  } else if (password.length < 6) {
    errors.push({ msg: "Password should be atleast 6 characters" });
  }
  if (errors.length > 0) {
    res.render("signinpage", { errors, username, email, password, password2 });
  } else {
    //validation succesfull
    User.findOne({ email: email }).then((user) => {
      if (user) {
        errors.push({ msg: "Email is already registered" });
        res.render("signinpage", {
          errors,
          username,
          email,
          password,
          password2,
        });
      } else {
        var user_instance = new User({
          username: username,
          email: email,
          password: password,
        });
        //hash passwords
        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(user_instance.password, salt, (err, hash) => {
            if (err) throw err;
            user_instance.password = hash;
            user_instance
              .save()
              .then((user) => {
                req.flash(
                  "success_msg",
                  "You are now registered and can login"
                );
                res.redirect("/signin");
              })
              .catch((err) => console.log(err));
          });
        });
      }
    });
  }
});
passport.use(
  new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
    User.findOne({ email: email })
      .then((user) => {
        if (!user) {
          return done(null, false, { message: "User not found!Try again" });
        }
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) throw err;
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Password incorrect" });
          }
        });
      })
      .catch((err) => console.log(err));
  })
);
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});
app.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })(req, res, next);
});
app.get("/dashboard", ensureAuthenticated, (req, res) => {
  res.render("dashboard", {
    user_name: req.user.username,
  });
});
app.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "You are logged out");
  res.redirect("/");
});
const truncateEmail = (submits) => {
  submits.forEach((submit) => {
    let truncatedcontactemail = submit.contactemail.substring(0, 3);
    let asterixcount = submit.contactemail.substring(
      3,
      submit.contactemail.indexOf("@")
    ).length;
    for (let i = 0; i < asterixcount; i++) {
      truncatedcontactemail += "*";
    }
    truncatedcontactemail += "@gmail.com";
    submit.contactemail = truncatedcontactemail;
  });
};
app.post("/search", async (req, res) => {
  let searchquery = req.body.usersearch.toLowerCase().trim();

  await Submit.find({
    $or: [
      {
        realname: {
          $regex: searchquery,
        },
      },
      {
        username: {
          $regex: searchquery,
        },
      },
      {
        contactemail: {
          $regex: searchquery,
        },
      },
      {
        discordid: {
          $regex: searchquery,
        },
      },
      {
        note: {
          $regex: searchquery,
        },
      },
    ],
  })
    .then((submits) => {
      truncateEmail(submits);
      if (submits.length > 0) {
        res.render("results", { submits });
      } else {
        res.render("notfound");
      }
    })
    .catch((err) => {
      console.log(err);
      res.render("notfound");
    });
});
