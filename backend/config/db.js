import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/url-shortener');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Drop legacy unique index on 'id' if it exists in groups collection
    try {
      const db = conn.connection.db;
      const collections = await db.listCollections({ name: 'groups' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('groups').indexes();
        const hasLegacyIdIndex = indexes.some(idx => idx.name === 'id_1' && idx.unique);
        if (hasLegacyIdIndex) {
          console.log('Dropping legacy unique index id_1 from groups...');
          await db.collection('groups').dropIndex('id_1');
          console.log('Successfully dropped legacy index id_1.');
        }
      }
    } catch (indexErr) {
      console.warn('Could not drop index (it might not exist or already dropped):', indexErr.message);
    }
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
