const MongoClient = require('mongodb').MongoClient;
const Mongo = require('mongodb');
const Config = require("./config.json");

let client = null;
let db = null;

async function connect() {
    client = await MongoClient.connect(Config.mongoconnection);
    db = client.db();
}

async function insertOne(collection, document) {
    let res = await db.collection(collection).insertOne(document);

    console.log(`added new document id: ${res.insertedId}`);

    return res.insertedId;
}

async function getById(collection, id) {
    let o_id = new Mongo.ObjectID(id);
    let res = await db.collection(collection).findOne({
        "_id": o_id
    })
    return res;
}

async function findMany(collection, query, options) {

    let cursor = await db.collection(collection).find(query);
    if (options?.sort)
        cursor = cursor.sort(options.sort);

    if (options?.limit)
        cursor = cursor.limit(options.limit);

    let res = cursor.toArray();
    return res;
}


async function updateId(collection, id, query) {
    let o_id = new Mongo.ObjectID(id);
    await db.collection(collection).update({
        "_id": o_id
    }, query)
}


module.exports = {
    connect,
    insertOne,
    getById,
    findMany,
    updateId
}