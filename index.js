const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const admin = require("firebase-admin");
const ObjectId = require('mongodb').ObjectId;
const { MongoClient, MongoRuntimeError } = require('mongodb');

const port = process.env.PORT || 5000;

// firebase token authorization
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// const serviceAccount = require('./drone-45254-firebase-adminsdk-gw3mu-2afdeb4a3e.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors());
app.use(express.json());

//connect mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5okll.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//verify token function
async function verifyToken(req, res, next) {
    if (req?.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}
// database connect and operation
async function run() {
    try {
        await client.connect();
        //make database and table collection
        const database = client.db("drone");
        const productCollection = database.collection('product');
        const usersCollection = database.collection('users');
        const cartCollection = database.collection('cart');
        const reviewCollection = database.collection('reviews');

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
            const updateDoc = { $set: data };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);

        })

        //get user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.json(user);
        })

        //make admin api
        app.post('/users/admin', verifyToken, async (req, res) => {
            const email = req?.body?.email;
            const requester = req?.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount?.role === 'admin') {
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
                }
            }
            else {
                res.status(403).json({ message: 'you do not have to permision to make admin this user!' })
            }

        });

        //get single product api
        app.get('/product/:id', async (req, res) => {
            const id = req?.params?.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.json(result);
        })

        //add new order
        app.post('/add-order', async (req, res) => {
            const data = req.body;
            const result = await cartCollection.insertOne(data);
            res.json(result);
        })

        //get orders
        app.get('/orders', async (req, res) => {
            const user = req?.query?.email;
            const query = { email: user };
            if (user) {
                const result = await cartCollection.find(query).sort({ _id: -1 }).toArray();
                res.json(result);
            } else {
                const result = await cartCollection.find({}).sort({ _id: -1 }).toArray();
                res.json(result);
            }
        })

        //update orders status
        app.put('/order', async (req, res) => {
            const id = req?.query?.id;
            const status = req?.query?.status;
            const filter = { _id: ObjectId(id) };
            let newStatus = '';
            if (status === "pending") {
                newStatus = "shipped";
            } else {
                newStatus = "pending";
            }
            const updateDoc = { $set: { status: newStatus } }
            const result = await cartCollection.updateOne(filter, updateDoc);
            res.json(result);
        })

        //delete order
        app.delete('/order/:id', async (req, res) => {
            const id = req?.params?.id;
            const query = { _id: ObjectId(id) }
            const result = await cartCollection.deleteOne(query);
            res.json(result);
        })

        //add review
        app.post('/add-review', async (req, res) => {
            const data = req.body;
            const result = await reviewCollection.insertOne(data);
            res.json(result);
        })

        //get all review
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find({}).sort({ _id: -1 }).toArray();
            res.json(result);
        })

        //add product api
        app.post('/add-product', async (req, res) => {
            const data = req.body;
            const result = await productCollection.insertOne(data);
            res.json(result);
        })

        //get all products , also limit call
        app.get('/products', async (req, res) => {
            const qty = req.query?.limit;
            //check if api bring any limit value or not
            if (qty) {
                const result = await productCollection.find({}).sort({ _id: -1 }).limit(parseInt(qty)).toArray();
                res.json(result);
            } else {
                const result = await productCollection.find({}).sort({ _id: -1 }).toArray();
                res.json(result);
            }
        })

        //Delete product 
        app.delete('/product/:id', async (req, res) => {
            const id = req?.params?.id;
            const query = { _id: ObjectId(id) }
            const result = await productCollection.deleteOne(query);
            res.json(result);
        })

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