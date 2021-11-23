"use strict";
const Mongo = require("./mongo.js");
const Scoresaber = require("./scoresaber.js");


class stats {
    players = 0;
    allPP = 0;
    totalPlayCount = 0;
    totalRankedPlayCount = 0;
}

class Scoreboard {
    _id = "";
    owner = 0;
    isOwner = false;
    isInside = false;
    name = "";
    description = "";
    public = false;
    _players = [];
    players = [];
    warning = "";

    stats = null;


    constructor(document, currentUser) {
        this._id = document._id;
        this.owner = document.owner;
        this.name = document.name;
        this.description = document.description;
        this.public = document.public;
        this._players = document.players;
        this.stats = document.stats;
        if (!this.stats)
            this.stats = new stats();

        if (currentUser && currentUser.id == this.owner) {
            this.isOwner = true;
        }

        if (currentUser && this._players.includes(currentUser.id)) {
            this.isInside = true;
        }
    }

    async getFullPlayerInfo() {
        this.stats = new stats();
        let promises = [];

        this._players.forEach((playerId, i) => {
            console.log(`playerid: ${playerId}`);
            promises.push(Scoresaber.getPlayer(playerId))
        });


        let res = await Promise.allSettled(
            promises
        );
        let updateStats = true;

        res.forEach((promiseResult, i) => {
            if (promiseResult.status == "rejected") {
                updateStats = false;
                this.warning = promiseResult.reason;
                console.log(promiseResult.reason);
                return;
            }
            this.players.push(promiseResult.value)

            this.stats.players++;
            this.stats.allPP += promiseResult.value.playerInfo.pp;
            this.stats.totalPlayCount += promiseResult.value.scoreStats.totalPlayCount;
            this.stats.totalRankedPlayCount += promiseResult.value.scoreStats.rankedPlayCount;
        });

        if (updateStats) {
            await Mongo.updateId("scoreboards", this._id, {
                "$set": {
                    "stats": this.stats
                }
            });
        }

        // sort by global score
        this.players.sort((a, b) => (a.playerInfo.rank < b.playerInfo.rank ? -1 : 1))

        // players with rank 0 are inactive, move those to the end of the array... [(]1,2,3,14,100,500,0,0,0]
        let inactiveAtEnd = this.players.filter((el)=>{return el.playerInfo.rank > 0;}).concat(this.players.filter((el)=>{return el.playerInfo.rank == 0}));

        this.players = inactiveAtEnd;
    }

    async addPlayerByUrl(url) {
        let match = /http(s?):\/\/scoresaber\.com\/u\/(?<playerid>\d+)/.exec(url);
        if (match == null)
            throw "Player not found";
        let playerId = match.groups.playerid;
        console.log(`regex playerid: ${playerId}`);

        try {
            await Scoresaber.getPlayer(playerId);
        } catch (e) {
            console.log(`error while adding new user to scoreboard`);
            console.log(e.response.status);
            console.log(e.response.data);
            throw "Player not found";
        }

        if (this._players.includes(playerId)) {
            console.log(`user was already in scoreboard, ignoring`);
            return;
        }
        console.log(`Player id is okay`);

        await Mongo.updateId("scoreboards", this._id, {
            "$push": {
                "players": playerId
            }
        });

        console.log(`Player added`);
    }

    async removePlayer(playerId) {
        if (!this._players.includes(playerId)) {
            console.log(`player with id: ${playerId} does not exist in scoreboard ${this._id}`);
            return;
        }

        await Mongo.updateId("scoreboards", this._id, {
            "$pull": {
                "players": playerId
            }
        })
    }
    async addPlayer(playerId) {
        if (this._players.includes(playerId)) {
            console.log(`player with id: ${playerId} does already exist in scoreboard ${this._id}`);
            return;
        }

        await Mongo.updateId("scoreboards", this._id, {
            "$push": {
                "players": playerId
            }
        })
    }

}
async function createScoreboard(user, name, isPublic, description) {
    if (!name || name.length == 0)
        throw "invalid name";

    isPublic = isPublic ? true : false;

    if (!description || description.length == "")
        description = "";

    console.log(`name ${name}`);
    console.log(`isPublic ${isPublic}`);
    console.log(`description ${description}`);

    let res = await Mongo.insertOne("scoreboards", {
        name: name,
        description: description,
        owner: user.id,
        public: isPublic,
        players: [
            user.id
        ],
        stats: new stats()
    });

    return res;
}

async function getScoreboard(id, currentUser) {
    let scoreboard = await Mongo.getById("scoreboards", id);

    if (scoreboard == null)
        throw "scoreboard does not exist";

    let _scoreboard = new Scoreboard(scoreboard, currentUser);

    return _scoreboard;
}

async function getUserScoreboards(userId) {
    let scoreboards = await Mongo.findMany("scoreboards", {
        owner: userId
    });

    return scoreboards;
}

async function getLatest(page = 1) {
    let scoreboards = await Mongo.findMany("scoreboards", {}, {
        sort: {
            _id: -1
        },
        limit: page * 2
    });
    return scoreboards;
}

module.exports = {
    getScoreboard,
    getUserScoreboards,
    createScoreboard,
    getLatest
}