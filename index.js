const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
// const admin = require("firebase-admin");
const { MongoClient, MongoRuntimeError } = require('mongodb');

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

//connect mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5okll.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        await client.connect();
        //make database and table collection
        const database = client.db("drone");
        const productCollection = database.collection('product');
        const usersCollection = database.collection('users');
        const cartCollection = database.collection('cart');
        const review = database.collection('reviews');

        //get user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.json(user);
        })

        //post user data
        app.post('/user', async (req, res) => {
            const data = req.body;
            const result = await usersCollection.insertOne(data);
            res.json(result);
        })

        //update or put user. if user already exist ignore 
        app.put('/user', async (req, res) => {
            const data = req.body;
            const filter = { email: data.email };
            const options = { upsert: true };
            const updateDoc = { set: data };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
            console.log(result);

        })

        //make admin api
        app.post('/users/admin', async (req, res) => {
            const email = req?.body?.email;
            const filter = { email: email };
            const updateDoc = { $set: { role: 'admin' } };
            const user = await usersCollection.findOne(filter);
            if (user?.role === 'admin') {
                res.json({ message: "The user already have admin access, no need to make admin again", from: 'alreadyAdmin' });
            } else if (user === null) {
                res.json({ message: "The user not found! check email and try again", from: 'noEmail' });
            } else {
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.json(result);
            }

            console.log(email);
        });

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send("The Drone server running perfectly");
})
app.listen(port, () => {
    console.log("The server is running on port:", port);
})