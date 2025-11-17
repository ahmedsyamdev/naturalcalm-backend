import { connectDatabase, disconnectDatabase } from '../config/database';
import logger from '../config/logger';
import fs from 'fs';
import path from 'path';

// Import models
import Category from '../models/Category.model';
import Track from '../models/Track.model';
import Program from '../models/Program.model';
import Package from '../models/Package.model';

async function exportData() {
  try {
    await connectDatabase();

    logger.info('Exporting existing data from MongoDB...');

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

    // Log the data as JSON
    console.log('\n=== CATEGORIES ===');
    console.log(JSON.stringify(categories, null, 2));

    console.log('\n=== TRACKS ===');
    console.log(JSON.stringify(tracks, null, 2));

    console.log('\n=== PROGRAMS ===');
    console.log(JSON.stringify(programs, null, 2));

    console.log('\n=== PACKAGES ===');
    console.log(JSON.stringify(packages, null, 2));

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Error exporting data:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

exportData();
