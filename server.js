'use strict';

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
const GitHubStrategy = require('passport-github').Strategy;
const cookieParser= require('cookie-parser')
const sessionStore= new session.MemoryStore();

const passportSocketIo = require('passport.socketio');



const app = express();
var http = require('http').createServer(app);
const io = require('socket.io')(http);


fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'pug');



app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());




//db and authentication
mongo.connect(process.env.DATABASE, (err, dbo) => {
  if(err) {
    console.log('Database error: ' + err);
  } else {
    //connecting to the cluster
    console.log('Successful database connection');
    
    //connetcing to the database
    const db = dbo.db('test');




    //serialization and app.listen
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


//Strategies
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

//github Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: 'https://boilerplate-advancednode.ahmadali5.repl.co/auth/github/callback'
},
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    //Database logic here with callback containing our user object
    db.collection('socialusers').findAndModify(
  {id: profile.id},
  {},
  {$setOnInsert:{
    id: profile.id,
    username: profile.username,
    name: profile.displayName || 'John Doe',
    photo: profile.photos[0].value || '',
    created_on: new Date(),
    email: profile.email || 'abc@de.com',
    provider: profile.provider || ''
  },$set:{
    last_login: new Date()
  },$inc:{
    login_count: 1
  }},
  {upsert:true, new: true},
  (err, doc) => {
    console.log('back to profile........', doc.value);
    return cb(null, doc.value);
  }
);
  }
));

//medilwares
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
 res.redirect(301, '/');
};



//routing

//github auth routes
app.route('/auth/github')
  .get(passport.authenticate('github'));
      
app.route('/auth/github/callback')
  .get(passport.authenticate('github', { failureRedirect: '/' }), (req,res) => {
              res.redirect('/chat');
    });


app.route('/')
  .get((req, res) => {
  res.render(process.cwd() + '/views/pug/index', {title: 'title: "Home page"', message: 'Please login', showLogin: true, showRegistration: true});
  });

  //chat route
    app.route('/chat')
      .get(ensureAuthenticated, (req, res) => {
        console.log(req.session);
           res.render(process.cwd() + '/views/pug/chat', {user: req.user});
      });


app.route('/login').post(passport.authenticate('local', { failureRedirect: '/' }), (req, res)=>{
 
  res.render(process.cwd() + '/views/pug/profile', {username: req.user.username});
} )  


//profile route
app
 .route('/profile')
 .get(ensureAuthenticated, (req,res) => {
  //  console.log('profile req >>>>>>>>>>>>>>>>>>>>>>>>>>>> \n' );
  //   console.log( req ,'\n');
  //   console.log('profile res >>>>>>>>>>>>>>>>>>>>>>>>>>>> \n' );
  // console.log( res , '\n');
   res.render(process.cwd() + '/views/pug/profile', {username: req.user});
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



//listen
app.listen(process.env.PORT || 3000, () => {
  console.log("Listening on port " + process.env.PORT);
});

///////////////////socket\\\\\\\\\\\\\\\\\\
///socket session
io.use(passportSocketIo.authorize({
  cookieParser: cookieParser,
  key:          'express.sid',
  secret:       process.env.SESSION_SECRET,
  store:        sessionStore
}));

 var currentUsers = 0;
//user connected
io.on('connection', socket => {
  currentUsers ++;
  console.log('user ' + socket.request.user.name + ' connected');
  io.emit('user', {name: socket.request.user.name, currentUsers, connected: true});

  //user disconncted
  socket.on('disconnect', () => {
    console.log('A user has disconnected');
    --currentUsers;
   io.emit('user', {name: socket.request.user.name, currentUsers, connected: false});
  });

  //sending a message
   socket.on('chat message', (message) => {
        const name = socket.request.user.name;
        io.emit('chat message', {name, message});

      });


  //end csocket connection
});





//end listen
  }

  //end db
});