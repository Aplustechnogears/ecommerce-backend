const { MongoClient } = require('mongodb');

const connect_to_mongo = async () => {
    try {
        let mongoClient = new MongoClient(process.env.MONGO_URI);
        await mongoClient.connect();
        console.log('Successfully connected to Mongo App!');
        global.central_app_conn = await mongoClient.db(process.env.MONGO_DB_NAME);
    } catch (error) {
        console.log(' connection to Mongo App failed');
    }
}

module.exports = { connect_to_mongo };