const mongoose = require('mongoose');
const Package = require('./dist/models/Package.model').Package;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/naturacalm').then(async () => {
  console.log('Connected to MongoDB');

  // Update all packages to SAR currency
  const result = await Package.updateMany(
    {},
    { $set: { currency: 'SAR' } }
  );

  console.log(`✅ Updated ${result.modifiedCount} packages to SAR currency`);

  // Display updated packages
  const packages = await Package.find({});
  console.log('\nUpdated packages:');
  packages.forEach(pkg => {
    console.log(`- ${pkg.name}: ${pkg.price} ${pkg.currency}`);
  });

  mongoose.connection.close();
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
