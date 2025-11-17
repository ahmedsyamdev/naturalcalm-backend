const mongoose = require('mongoose');
const Package = require('./dist/models/Package.model').Package;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/naturacalm').then(async () => {
  // Update premium package (1 year = 365 days)
  await Package.updateOne(
    { type: 'premium' },
    { $set: { durationInDays: 365 } }
  );

  // Update basic package (1 month = 30 days)
  await Package.updateOne(
    { type: 'basic' },
    { $set: { durationInDays: 30 } }
  );

  console.log('✅ Updated packages with durationInDays field');

  const packages = await Package.find({});
  console.log('\nCurrent packages:');
  packages.forEach(pkg => {
    console.log(`- ${pkg.type}: ${pkg.durationInDays} days`);
  });

  mongoose.connection.close();
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
