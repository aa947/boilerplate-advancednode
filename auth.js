const express     = require('express');
const bodyParser  = require('body-parser');
const fccTesting  = require('./freeCodeCamp/fcctesting.js');
const pug = require('pug');
const passport = require('passport');
const session = require('express-session');
require('dotenv').config();
const ObjectID = require('mongodb').ObjectID;
const mongo = require('mongodb').MongoClient;
const LocalStrategy = require('passport-local');
const bcrypt = require('bcrypt');

module.exports = function (app, db) {


passport.serializeUser((user, done) => {
  done(null, user._id);
});
passport.deserializeUser((id, done) => {
  db.collection('users').findOne(
    {_id: new ObjectID(id)},
      (err, doc) => {
        done(null, done);
      }
  );
});



passport.use(new LocalStrategy(
  function(username, password, done) {
    db.collection('users').findOne({ username: username }, function (err, user) {
      console.log('User '+ username +' attempted to log in.');
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      if (!bcrypt.compareSync(password, user.password)) { return done(null, false); }
      return done(null, user);
    });
  }
));



//medilwares
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
 res.redirect(301, '/');
};


}