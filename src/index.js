const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
//session is used for not getting log out on referesh
const session = require("express-session");

const session_secret = "movefinder";
const emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const app = express();
app.use(express.json()); //added body key to req
app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(
  session({
    secret: session_secret,
    cookie: { maxAge: 1 * 60 * 60 * 1000 },
  })
); //add a property called session to req

//CONNECT
const db = mongoose.createConnection("mongodb://localhost:27017/MoveFinder", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//SCHEMA
//Name email id password confirm password
const userSchema = new mongoose.Schema({
  userName: String,
  emailId: String,
  password: String,
});

const searchHistorySchema = new mongoose.Schema({
  searchData: String,
  creationTime: Date,
  userId: mongoose.Schema.Types.ObjectId,
});

const watchHistorySchema = new mongoose.Schema({
  watchData: String,
  creationTime: Date,
  userId: mongoose.Schema.Types.ObjectId,
});

const watchLaterSchema = new mongoose.Schema({
  watchLaterData: String,
  creationTime: Date,
  userId: mongoose.Schema.Types.ObjectId,
});

//MODELS
const userModel = db.model("user", userSchema);
const searchHistoryModel = db.model("searchHistory", searchHistorySchema);
const watchHistoryModel = db.model("watchHistory", watchHistorySchema);
const watchLaterModel = db.model("watchLater", watchLaterSchema);

//SIGNUP APIS
const isNullOrUndefined = (val) => val === null || val === undefined;
const SALT = 5;

app.post("/signup", async (req, res) => {
  const { userName, password, emailId } = req.body;

  console.log(emailRegexp.test(emailId));
  console.log(emailId);

  const existingUser = await userModel.findOne({ userName });
  if (isNullOrUndefined(existingUser) && emailRegexp.test(emailId)) {
    //allow signup

    const hashedPwd = bcrypt.hashSync(password, SALT);
    const newUser = new userModel({ userName, password: hashedPwd, emailId });
    await newUser.save();
    req.session.userId = newUser._id; //will save data in session
    res.status(201).send({ success: "Signed Up" });
  } else {
    //already exist
    // if (!emailRegexp.test(emailId)) {
    //   res.status(400).send({ err: "Invalid Email" });
    // }
    res.status(400).send({
      err: `UserName ${userName} already exists. Please choose another.`,
    });
  }
});

//LOGIN
app.post("/login", async (req, res) => {
  const { userName, password } = req.body;
  const existingUser = await userModel.findOne({
    userName,
  });

  if (isNullOrUndefined(existingUser)) {
    res.status(401).send({ err: "UserName does not exist." });
  } else {
    const hashedPwd = existingUser.password;
    if (bcrypt.compareSync(password, hashedPwd)) {
      req.session.userId = existingUser._id;
      res.status(200).send({ success: "Logged in" });
    } else {
      res.status(401).send({ err: "Password is incorrect." });
    }
  }
});
// const AuthMiddleware = async (req, res, next) => {
//   const userName = req.headers["x-username"];
//   const password = req.headers["x-password"];
//   if (isNullOrUndefined(userName) || isNullOrUndefined(password)) {
//     res.status(401).send({ err: "username/passord incorrect" });
//   } else {
//     const existingUser = await userModel.findOne({
//       userName,
//     });
//     if (isNullOrUndefined(existingUser)) {
//       res.status(401).send({ err: "UserName does not exist." });
//     } else {
//       const hashedPwd = existingUser.password;
//       if (bcrypt.compareSync(password, hashedPwd)) {
//         req.user = existingUser;
//         next();
//       } else {
//         res.status(401).send({ err: "Password is incorrect" });
//       }
//     }
//   }
// };
const AuthMiddleware = async (req, res, next) => {
  if (isNullOrUndefined(req.session) || isNullOrUndefined(req.session.userId)) {
    res.status(401).send({ err: "Not logged in." });
  } else {
    next();
  }
};

app.get("/searchHistory", AuthMiddleware, async (req, res) => {
  const allSearchHistory = await searchHistoryModel.find({
    userId: req.session.userId,
  });
  res.send(allSearchHistory);
});

app.get("/watchHistory", AuthMiddleware, async (req, res) => {
  const allWatchHistory = await watchHistoryModel.find({
    userId: req.session.userId,
  });
  res.send(allWatchHistory);
});

app.get("/watchLater", AuthMiddleware, async (req, res) => {
  const allWatchLater = await watchLaterModel.find({
    userId: req.session.userId,
  });
  res.send(allWatchLater);
});

//POST REQUEST
app.post("/searchHistory", AuthMiddleware, async (req, res) => {
  const searchHistory = req.body;
  searchHistory.creationTime = new Date();
  searchHistory.userId = req.session.userId;
  const newSearchHistory = new searchHistoryModel(searchHistory);
  await newSearchHistory.save();
  res.status(201).send(newSearchHistory);
});

app.post("/watchHistory", AuthMiddleware, async (req, res) => {
  const watchHistory = req.body;
  watchHistory.creationTime = new Date();
  watchHistory.userId = req.session.userId;
  const newWatchHistory = new watchHistoryModel(watchHistory);
  await newWatchHistory.save();
  res.status(201).send(newWatchHistory);
});

app.post("/watchLater", AuthMiddleware, async (req, res) => {
  const watchLater = req.body;
  watchLater.creationTime = new Date();
  watchLater.userId = req.session.userId;
  const newWatchLater = new searchHistoryModel(watchLater);
  await newWatchLater.save();
  res.status(201).send(newWatchLater);
});

//PUT REQUEST
app.put("/searchHistory/:id", AuthMiddleware, async (req, res) => {
  const { searchData } = req.body;
  const id = req.params.id;

  try {
    const searchHistory = await searchHistoryModel.findOne({
      _id: id,
      userId: req.session.userId,
    });
    if (isNullOrUndefined(searchHistory)) {
      res.sendStatus(404);
    } else {
      searchHistory.searchData = searchData;
      await searchHistory.save();
      res.send(searchHistory);
    }
  } catch (e) {
    res.sendStatus(404);
  }
});
//DELETE REQUEST
app.delete("/searchHistory/:id", AuthMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    await searchHistoryModel.deleteOne({ _id: id, userId: req.session.userId });
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(404);
  }
});

app.delete("/watchHistory/:id", AuthMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    await watchHistoryModel.deleteOne({ _id: id, userId: req.session.userId });
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(404);
  }
});

app.delete("/watchLater/:id", AuthMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    await watchLaterModel.deleteOne({ _id: id, userId: req.session.userId });
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(404);
  }
});

app.get("/logout", (req, res) => {
  if (!isNullOrUndefined(req.session)) {
    //destroy session
    req.session.destroy(() => {
      res.sendStatus(200);
    });
  } else {
    res.sendStatus(200);
  }
});

//browser need to figure out someone
app.get("/userinfo", AuthMiddleware, async (req, res) => {
  const user = await userModel.findById(req.session.userId);
  // const user = await userModel.findById(req.session.userId);
  res.send({ userName: user.userName, emailId: user.emailId });
});

app.listen(9999);
