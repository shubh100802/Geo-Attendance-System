const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const uri = 'mongodb+srv://physicscentre:Shubham@physicscentre.5lowv.mongodb.net/?retryWrites=true&w=majority&appName=Physicscentre';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('test'); // or your db name
    const result = await db.collection('students').updateOne(
      { name: "Shubh" },
      { $set: { createdBy: new ObjectId("682cc0832e602b2a9b24f8b0") } }
    );
    console.log(result);
  } finally {
    await client.close();
  }
}
run();
