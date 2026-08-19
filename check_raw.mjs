const { MongoClient, ObjectId, BSON } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('commission_tracker');
  const sales = await db.collection('sales').find({}, { projection: { customerName: 1, directRecruiter: 1 } }).toArray();
  for (const s of sales) {
    const dr = s.directRecruiter;
    console.log(`Sale: ${s.customerName}`);
    console.log(`  directRecruiter value: ${dr}`);
    console.log(`  type constructor: ${dr && dr.constructor && dr.constructor.name}`);
    console.log(`  instanceof ObjectId: ${dr instanceof ObjectId}`);
    console.log(`  typeof: ${typeof dr}`);
  }

  // Now try to query with ObjectId filter
  const testId = new ObjectId('6a42d7f2da0202206d38ae23');
  const found = await db.collection('sales').countDocuments({ directRecruiter: testId });
  console.log(`\nCount matching directRecruiter ObjectId: ${found}`);
  
  // Also try string filter
  const foundStr = await db.collection('sales').countDocuments({ directRecruiter: '6a42d7f2da0202206d38ae23' });
  console.log(`Count matching directRecruiter string: ${foundStr}`);
  
  await client.close();
}
run().catch(console.error);
