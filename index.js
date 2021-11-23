const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const util = require('util');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const SteamStrategy = require('passport-steam').Strategy;
const Mongo = require("./mongo.js");
const Scoreboards = require("./scoreboard.js");
const Config = require("./config.json");

async function main() {
    await Mongo.connect();
    console.log(`Mongodb connected`);

    app.listen(Config.webport,Config.bindip);
}
main();
// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Steam profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

// Use the SteamStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
passport.use(new SteamStrategy({
        returnURL: Config.steamReturnUrl,
        realm: Config.steamRelam,
        apiKey: Config.steamApiKey
    },
    function(identifier, profile, done) {
        // asynchronous verification, for effect...
        process.nextTick(function() {

            // To keep the example simple, the user's Steam profile is returned to
            // represent the logged-in user.  In a typical application, you would want
            // to associate the Steam account with a user record in your database,
            // and return that user instead.
            profile.identifier = identifier;
            return done(null, profile);
        });
    }
));


let app = express();


app.use(bodyParser.urlencoded({
    extended: false
}));

// configure Express
var exphbs = require('express-handlebars');


app.set('views', __dirname + '/views');
app.engine('.hbs', exphbs({
    layoutsDir: __dirname + '/views/',
    extname: '.hbs',
    defaultLayout: "main",
    helpers:{
        inc:function(value,options){
            return parseInt(value)+1;
        }
    }
}));
app.set('view engine', '.hbs');

app.use(session({
    secret: Config.sessionsecret,
    name: Config.sessionname,
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({
        url: Config.mongoconnection
    })
}));

// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());
app.use('/static', express.static('public'));


app.get('/', async function(req, res) {
    console.log(req.user);
    let userScoreboards = null;
    if (req.user)
        userScoreboards = await Scoreboards.getUserScoreboards(req.user.id);

    let latestScoreboards = await Scoreboards.getLatest(1);
    console.log(latestScoreboards);
    res.render('index', {
        user: req.user,
        userScoreboards: userScoreboards,
        latestScoreboards: latestScoreboards
    });
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

// GET /auth/steam
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Steam authentication will involve redirecting
//   the user to steamcommunity.com.  After authenticating, Steam will redirect the
//   user back to this application at /auth/steam/return
app.get('/auth/steam',
    passport.authenticate('steam', {
        failureRedirect: '/'
    }),
    function(req, res) {
        res.redirect('/');
    });

// GET /auth/steam/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/steam/return',
    passport.authenticate('steam', {
        failureRedirect: '/'
    }),
    function(req, res) {
        res.redirect('/');
    });

app.post('/scoreboard/:id/addplayer',
    ensureAuthenticated,
    async function(req, res) {
        console.log(req.params.id);
        console.log(req.body.url);

        try {
            if (!req.body.url || req.body.url.length == 0)
                throw "Player does not exist";

            let scoreboard = await Scoreboards.getScoreboard(req.params.id, req.user);
            if (!scoreboard.isOwner) {
                req.logout();
                res.redirect('/');
                return;
            }
            await scoreboard.addPlayerByUrl(req.body.url);

            res.redirect(`/scoreboard/${scoreboard._id}/`);
        } catch (e) {
            res.render('scoreboard', {
                user: req.user,
                error: e
            });
        }
    });

app.post('/scoreboard/:id/removeplayer',
    ensureAuthenticated,
    async function(req, res) {
        console.log(req.params.id);
        console.log(req.body.player);

        try {
            if (!req.body.player || req.body.player.length == 0) {
                res.redirect('/');
            }

            let scoreboard = await Scoreboards.getScoreboard(req.params.id, req.user);
            if (!scoreboard.isOwner) {
                req.logout();
                res.redirect('/');
                return;
            }
            await scoreboard.removePlayer(req.body.player);

            res.redirect(`/scoreboard/${scoreboard._id}/`);
        } catch (e) {
            res.render('scoreboard', {
                user: req.user,
                error: e
            });
        }
    });

app.post('/scoreboard/:id/removeself',
    ensureAuthenticated,
    async function(req, res) {
        try {
            let scoreboard = await Scoreboards.getScoreboard(req.params.id, req.user);
            if (!scoreboard.isInside) {
                res.redirect(`/scoreboard/${scoreboard._id}/`);
                return;
            }
            await scoreboard.removePlayer(req.user.id);
            res.redirect(`/scoreboard/${scoreboard._id}/`);

        } catch (e) {
            res.render('scoreboard', {
                user: req.user,
                error: e
            });
        }
    });

app.post('/scoreboard/:id/addself',
    ensureAuthenticated,
    async function(req, res) {

        try {
            let scoreboard = await Scoreboards.getScoreboard(req.params.id, req.user);
            if (scoreboard.isInside || !scoreboard.public) {
                res.redirect(`/scoreboard/${scoreboard._id}/`);
                return;
            }
            await scoreboard.addPlayer(req.user.id);
            res.redirect(`/scoreboard/${scoreboard._id}/`);

        } catch (e) {
            res.render('scoreboard', {
                user: req.user,
                error: e
            });
        }
    });

app.get('/scoreboard/new',
    ensureAuthenticated,
    async function(req, res) {
        res.render('new', {
            user: req.user
        });
    });

app.post('/scoreboard/new',
    ensureAuthenticated,
    async function(req, res) {
        try {
            let scoreboardId = await Scoreboards.createScoreboard(req.user, req.body?.name, req.body?.public, req.body?.description);

            res.redirect(`/scoreboard/${scoreboardId}`);
        } catch (e) {
            res.render('new', {
                user: req.user,
                error: e
            });
        }
    });

app.get('/scoreboard/:id',
    async function(req, res) {
        try {
            let scoreboard = await Scoreboards.getScoreboard(req.params.id, req.user);
            await scoreboard.getFullPlayerInfo();
            console.log(scoreboard);
            res.render('scoreboard', {
                user: req.user,
                scoreboard: scoreboard
            });
        } catch (e) {
            res.render('scoreboard', {
                user: req.user,
                error: e
            });
        }
    });


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}
