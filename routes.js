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


//routering

//github auth routes
app.route('/auth/github')
  .get(passport.authenticate('github'));
      
app.route('/auth/github/callback')
  .get(passport.authenticate('github', { failureRedirect: '/' }), (req,res) => {
              res.redirect('/profile');
    });


app.route('/')
  .get((req, res) => {
  res.render(process.cwd() + '/views/pug/index', {title: 'title: "Home page"', message: 'Please login', showLogin: true, showRegistration: true});
  });


app.route('/login').post(passport.authenticate('local', { failureRedirect: '/' }), (req, res)=>{
  res.render(process.cwd() + '/views/pug/profile', {username: req.user.username});
} )  


//profile route
app
 .route('/profile')
 .get(ensureAuthenticated, (req,res) => {
   console.log('/profile >>>>>',req.user);
   res.render(process.cwd() + '/views/pug/profile', {username: req.user.username});
 });

//logout route
app.route('/logout')
  .get((req, res) => {
    req.logout();
    res.redirect('/');
});

//register route
app.route('/register')
  .post((req, res, next) => {
    db.collection('users').findOne({ username: req.body.username }, function(err, user) {
      if (err) {
        next(err);
      } else if (user) {
        res.redirect('/');
      } else {
        var hash = bcrypt.hashSync(req.body.password, 12); 
        db.collection('users').insertOne({
          username: req.body.username,
          password: hash
        },
          (err, doc) => {
            if (err) {
              res.redirect('/');
            } else {
              next(null, user);
            }
          }
        )
      }
    })
  },
    passport.authenticate('local', { failureRedirect: '/' }),
    (req, res, next) => {
      res.render(process.cwd() + '/views/pug/profile', {username: req.user.username});
    }
  );

  
//404 route
app.use((req, res, next) => {
  res.status(404)
    .type('text')
    .send('Not Found');
});


//end exports
}