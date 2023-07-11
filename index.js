const express = require("express");
const app = express();
// dotenv
require("dotenv").config();

// jwt
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 7000;

/*______________ payment part-1 _________________________*/
// This is your test secret API key.
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

/*______________ payment part end-1 _______________________*/

// middle ware
const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// jwt middle ware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log(req.headers);
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "un-authorization access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(403)
        .send({ error: true, message: "un-authorization access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hnh2r40.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    // collection
    const menuCollection = client.db("summerCamp").collection("menu");
    const selectedCollection = client.db("summerCamp").collection("carts");
    // payment Collection
    const paymentCollection = client.db("summerCamp").collection("payments");
    //  users Collection
    const usersCollection = client.db("summerCamp").collection("users");
    //  feedback collection
    const feedbackCollection = client.db("summerCamp").collection("feedback");

    // menu api
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    // selected api(select)
    app.post("/selected", async (req, res) => {
      const data = req.body;
      const result = await selectedCollection.insertOne(data);
      res.send(result);
    });

    // email Query Api
    app.get("/selected", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }

      const query = { email: email };
      const result = await selectedCollection.find(query).toArray();
      res.send(result);
    });
    // Delete
    app.delete("/selected/delete/:ID", async (req, res) => {
      const id = req.params.ID;
      const filter = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(filter);
      res.send(result);
    });

    /*______________ payment part-2 start _________________________*/
    // Intent Payment(payment part-1)
    app.post("/create-payment-intent", async (req, res) => {
      // const { items } = req.body;
      const { price } = req.body;
      const amount = price * 100;
      console.log(price, amount);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(paymentIntent);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    /*______________ payment part-2 end _________________________*/

    /*______________ payment part-3 start _________________________*/
    //payment Collection api(To send data in server)
    app.post("/payments", async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await paymentCollection.insertOne(data);
      // delete after payment
      const query = {
        _id: { $in: data.selectedItems.map((Id) => new ObjectId(Id)) },
      };
      const deletedResult = await selectedCollection.deleteOne(query);
      res.send({ result, deletedResult });
    });
    /*______________ payment part-3 end _________________________*/

    // PAYMENT HISTORY api
    app.get("/paymentHistory", async (req, res) => {
      // const result = await paymentCollection.find().toArray();
      // res.send(result);

      // For ascending and Descending
      const sort = req.query.sort;
      
      const query = {};

      const options = {
        // sort returned documents in ascending order by title (A->Z)
        // sort: { price: -1 },

        sort: {
          price: sort === "asc" ? 1 : -1,
        },
      };
      

      const result = await paymentCollection.find(query, options).toArray();
      console.log(result);
      res.send(result);
    });

    // users api(for making admin)
    app.post("/users", async (req, res) => {
      const data = req.body;
      /*_________________________*/
      // google signIn
      const query = { email: data.email };
      const existingUser = await usersCollection.findOne(query);
      console.log("existing user", existingUser);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      /*_________________________*/
      const result = await usersCollection.insertOne(data);
      res.send(result);
    });

    // to Get all users & secure
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // admin api
    app.patch("/users/admin/:ID", async (req, res) => {
      const id = req.params.ID;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // email is admin or not
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // instructor api
    app.patch("/users/instructor/:ID", async (req, res) => {
      const id = req.params.ID;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // email is instructor or not
    app.get("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // Delete(Users)
    app.delete("/users/delete/:ID", async (req, res) => {
      const id = req.params.ID;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    // AddClasses in Menu component(send data to mongodb)
    app.post("/menu", async (req, res) => {
      const newItem = req.body; // newItem coming from client
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });
    // Feedback api
    app.post("/feedback", async (req, res) => {
      const newItem = req.body; // newItem coming from client
      const result = await feedbackCollection.insertOne(newItem);
      res.send(result);
    });
    app.get("/receiveFeedback", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Summer Camp is Running");
});

app.listen(port, () => {
  console.log(`summerCamp port= ${port}`);
});
