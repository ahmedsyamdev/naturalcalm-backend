import { connectDatabase, disconnectDatabase } from '../config/database';
import logger from '../config/logger';

// Import models
import Category from '../models/Category.model';
import Track from '../models/Track.model';
import Program from '../models/Program.model';
import Package from '../models/Package.model';
import User from '../models/User.model';
import Coupon from '../models/Coupon.model';
import Notification from '../models/Notification.model';
import Subscription from '../models/Subscription.model';

async function exportData() {
  try {
    await connectDatabase();

    logger.info('Exporting ALL data from MongoDB...');

    // Export categories
    const categories = await Category.find({}).lean();
    logger.info(`Found ${categories.length} categories`);

    // Export tracks
    const tracks = await Track.find({}).lean();
    logger.info(`Found ${tracks.length} tracks`);

    // Export programs
    const programs = await Program.find({}).lean();
    logger.info(`Found ${programs.length} programs`);

    // Export packages
    const packages = await Package.find({}).lean();
    logger.info(`Found ${packages.length} packages`);

    // Export users (without passwords for safety)
    const users = await User.find({}).select('-password').lean();
    logger.info(`Found ${users.length} users`);

    // Export coupons
    const coupons = await Coupon.find({}).lean();
    logger.info(`Found ${coupons.length} coupons`);

    // Export notifications
    const notifications = await Notification.find({}).lean();
    logger.info(`Found ${notifications.length} notifications`);

    // Export subscriptions
    const subscriptions = await Subscription.find({}).lean();
    logger.info(`Found ${subscriptions.length} subscriptions`);

    // Log the data as JSON
    console.log('\n=== CATEGORIES ===');
    console.log(JSON.stringify(categories, null, 2));

    console.log('\n=== TRACKS ===');
    console.log(JSON.stringify(tracks, null, 2));

    console.log('\n=== PROGRAMS ===');
    console.log(JSON.stringify(programs, null, 2));

    console.log('\n=== PACKAGES ===');
    console.log(JSON.stringify(packages, null, 2));

    console.log('\n=== USERS ===');
    console.log(JSON.stringify(users, null, 2));

    console.log('\n=== COUPONS ===');
    console.log(JSON.stringify(coupons, null, 2));

    console.log('\n=== NOTIFICATIONS ===');
    console.log(JSON.stringify(notifications, null, 2));

    console.log('\n=== SUBSCRIPTIONS ===');
    console.log(JSON.stringify(subscriptions, null, 2));

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Error exporting data:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

exportData();
