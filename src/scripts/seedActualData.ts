import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import logger from '../config/logger';

// Import models
import Category from '../models/Category.model';
import Track from '../models/Track.model';
import Program from '../models/Program.model';
import Package from '../models/Package.model';
import User from '../models/User.model';
import Coupon from '../models/Coupon.model';

// Actual data from your MongoDB - replace localhost URLs with your production URLs
const BASE_URL = process.env.API_URL || 'https://api.naturalcalm.site';

// Categories
const categoriesData = [
  {
    name: "التأمل",
    nameEn: "Meditation",
    icon: `${BASE_URL}/uploads/images/track/18a80d77-f184-4cf9-84ae-89af7ee51856.webp`,
    color: "from-blue-100 to-blue-50",
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop",
    description: "جلسات تأمل مهدئة لتصفية الذهن والاسترخاء العميق",
    displayOrder: 1,
    isActive: true
  },
  {
    name: "المسارات",
    nameEn: "Programs",
    icon: `${BASE_URL}/uploads/images/track/f043a89b-df37-4ad4-8923-639e082b6a91.webp`,
    color: "from-purple-100 to-purple-50",
    imageUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&h=400&fit=crop",
    description: "برامج متكاملة لرحلة استرخاء منظمة",
    displayOrder: 2,
    isActive: true
  },
  {
    name: "التنويم الايحائي",
    nameEn: "Hypnosis",
    icon: `${BASE_URL}/uploads/images/track/f282908e-0b1e-4565-8290-788afdda3e55.webp`,
    color: "from-indigo-100 to-indigo-50",
    imageUrl: "https://images.unsplash.com/photo-1516450137517-162bfbeb8dba?w=400&h=400&fit=crop",
    description: "جلسات تنويم إيحائي للنوم العميق والاسترخاء",
    displayOrder: 3,
    isActive: true
  },
  {
    name: "الطبيعة",
    nameEn: "Nature",
    icon: `${BASE_URL}/uploads/images/track/b74bfbf5-895e-40cc-a9f9-89603d8def62.webp`,
    color: "from-green-100 to-green-50",
    imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop",
    description: "أصوات الطبيعة الهادئة والمريحة",
    displayOrder: 4,
    isActive: true
  },
  {
    name: "الاسترخاء",
    nameEn: "Relaxation",
    icon: `${BASE_URL}/uploads/images/track/5a6d9caa-67c9-4b3d-a8da-f1a397fc6c19.webp`,
    color: "from-teal-100 to-teal-50",
    imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=400&fit=crop",
    description: "موسيقى وأصوات للاسترخاء والهدوء",
    displayOrder: 5,
    isActive: true
  }
];

// Tracks - will be mapped to category IDs after creation
const tracksData = [
  {
    title: "همس النجوم",
    description: "رحلة هادئة مع همسات النجوم في سماء الليل الصافية",
    durationSeconds: 38,
    level: "مبتدأ",
    categoryName: "الاسترخاء",
    relaxationType: "استرخاء مسائي",
    imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=400&fit=crop",
    audioUrl: `${BASE_URL}/uploads/audio/audio-1762300869230-z1bqv7.mpeg`,
    playCount: 11799,
    isPremium: false,
    contentAccess: "basic",
    isActive: true,
    tags: ["استرخاء", "نوم", "ليل"]
  },
  {
    title: "شاطئ الغروب الهادئ",
    description: "استمع لأمواج البحر الهادئة وقت الغروب",
    durationSeconds: 930,
    level: "مبتدأ",
    categoryName: "الطبيعة",
    relaxationType: "استرخاء صباحي",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop",
    audioUrl: `${BASE_URL}/uploads/audio/audio-1762295031921-xrq2zf.mpeg`,
    playCount: 8433,
    isPremium: true,
    contentAccess: "free",
    isActive: true,
    tags: ["بحر", "طبيعة", "أمواج"]
  },
  {
    title: "رحلة داخلية",
    description: "تأمل عميق لاستكشاف الذات الداخلية والسلام النفسي",
    durationSeconds: 1500,
    level: "متوسط",
    categoryName: "التأمل",
    imageUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=400&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    playCount: 8085,
    isPremium: true,
    isActive: true,
    tags: ["تأمل", "عميق", "سلام"]
  },
  {
    title: "أثير السلام",
    description: "موسيقى هادئة تنقلك إلى عالم من السكينة والطمأنينة",
    durationSeconds: 1125,
    level: "مبتدأ",
    categoryName: "الاسترخاء",
    relaxationType: "استرخاء مسائي",
    imageUrl: "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=400&h=400&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    playCount: 21031,
    isPremium: false,
    contentAccess: "free",
    isActive: true,
    tags: ["موسيقى", "هدوء", "سكينة"]
  },
  {
    title: "مطر الربيع الخفيف",
    description: "صوت المطر الخفيف مع نسمات الربيع المنعشة",
    durationSeconds: 1800,
    level: "مبتدأ",
    categoryName: "الطبيعة",
    imageUrl: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&h=400&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    playCount: 20906,
    isPremium: true,
    contentAccess: "free",
    isActive: true,
    tags: ["مطر", "طبيعة", "ربيع"]
  },
  {
    title: "نوم عميق",
    description: "جلسة تنويم إيحائي للوصول إلى نوم عميق ومريح",
    durationSeconds: 2700,
    level: "متقدم",
    categoryName: "التنويم الايحائي",
    imageUrl: "https://images.unsplash.com/photo-1511295742362-92c96b1cf484?w=400&h=400&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    playCount: 20792,
    isPremium: true,
    contentAccess: "free",
    isActive: true,
    tags: ["نوم", "تنويم", "عميق"]
  },
  {
    title: "هديل حمام السلام",
    description: "صوت هديل الحمام في صباح هادئ ومشرق",
    durationSeconds: 1350,
    level: "مبتدأ",
    categoryName: "الطبيعة",
    imageUrl: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400&h=400&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    playCount: 10680,
    isPremium: false,
    contentAccess: "free",
    isActive: true,
    tags: ["طيور", "صباح", "طبيعة"]
  },
  {
    title: "دفء المدفأة",
    description: "صوت تكتكة الحطب في المدفأة لشتاء دافئ ومريح",
    durationSeconds: 2100,
    level: "مبتدأ",
    categoryName: "الاسترخاء",
    relaxationType: "استرخاء مسائي",
    imageUrl: "https://images.unsplash.com/photo-1548979723-e0e9a0b8e04d?w=400&h=400&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    playCount: 18002,
    isPremium: false,
    contentAccess: "free",
    isActive: true,
    tags: ["شتاء", "دفء", "هدوء"]
  },
  {
    title: "هدوء الحديقة الخضراء",
    description: "هدوء الحديقة الخضراء",
    durationSeconds: 38,
    level: "مبتدأ",
    categoryName: "الطبيعة",
    relaxationType: "استرخاء صباحي",
    imageUrl: `${BASE_URL}/uploads/images/track/ec8c01f3-c516-4c0b-94fd-2eedb05fa1f0.webp`,
    audioUrl: `${BASE_URL}/uploads/audio/audio-1762295857133-zlpc68.mpeg`,
    playCount: 16,
    isPremium: true,
    contentAccess: "premium",
    isActive: true,
    tags: []
  }
];

// Programs - will be mapped to category and track IDs after creation
const programsData = [
  {
    title: "واحة السكينة",
    description: "برنامج متكامل لمدة 14 يوم للوصول إلى السكينة والهدوء الداخلي",
    level: "مبتدأ",
    categoryName: "الاسترخاء",
    thumbnailUrl: `${BASE_URL}/uploads/images/track/f923a7f4-6ef9-4c3e-973a-d525226ac01f.webp`,
    thumbnailImages: [
      `${BASE_URL}/uploads/images/track/f923a7f4-6ef9-4c3e-973a-d525226ac01f.webp`
    ],
    trackTitles: ["هدوء الحديقة الخضراء", "هديل حمام السلام"],
    playCount: 5312,
    isPremium: false,
    contentAccess: "basic",
    isFeatured: true,
    isActive: true
  },
  {
    title: "رحلة التأمل العميق",
    description: "برنامج متقدم لمدة 10 أيام لتعميق ممارسة التأمل والوصول للسلام الداخلي",
    level: "متقدم",
    categoryName: "التأمل",
    thumbnailUrl: "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=200&h=100&fit=crop",
    thumbnailImages: [
      "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=200&h=100&fit=crop",
      "https://images.unsplash.com/photo-1516450137517-162bfbeb8dba?w=100&h=100&fit=crop"
    ],
    trackTitles: ["هدوء الحديقة الخضراء"],
    playCount: 6546,
    isPremium: false,
    contentAccess: "basic",
    isFeatured: true,
    isActive: true
  },
  {
    title: "أصوات الطبيعة الشافية",
    description: "برنامج لمدة 12 يوم مع أجمل أصوات الطبيعة للاسترخاء والشفاء",
    level: "متوسط",
    categoryName: "الطبيعة",
    thumbnailUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=200&h=100&fit=crop",
    thumbnailImages: [
      "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=200&h=100&fit=crop",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop"
    ],
    trackTitles: ["هدوء الحديقة الخضراء", "مطر الربيع الخفيف"],
    playCount: 7816,
    isPremium: true,
    contentAccess: "premium",
    isFeatured: true,
    isActive: true
  }
];

// Packages
const packagesData = [
  {
    name: "الاشتراك المتميز",
    nameEn: "Premium Subscription",
    type: "premium",
    price: 20,
    currency: "SAR",
    periodType: "year",
    periodCount: 1,
    durationInDays: 365,
    discountPercentage: 40,
    features: [
      "وصول غير محدود لجميع المحتويات",
      "محتوى حصري متقدم",
      "بدون إعلانات",
      "تحميل الجلسات للاستماع بدون إنترنت",
      "إحصائيات تقدم مفصلة",
      "برامج مخصصة"
    ],
    isActive: true,
    displayOrder: 1
  },
  {
    name: "الباقة الأساسية",
    nameEn: "Basic Package",
    type: "basic",
    price: 12,
    currency: "SAR",
    periodType: "month",
    periodCount: 1,
    durationInDays: 30,
    discountPercentage: 20,
    features: [
      "وصول للمحتوى الأساسي",
      "جلسات يومية جديدة",
      "إحصائيات بسيطة",
      "دعم فني"
    ],
    isActive: true,
    displayOrder: 2
  }
];

// Users data
const usersData = [
  {
    name: "المسؤول",
    phone: "+201234567890",
    email: "admin@naturacalm.com",
    password: "Admin@123",
    role: "admin",
    isVerified: true,
    subscription: {
      status: "expired",
      autoRenew: true
    }
  },
  {
    name: "نهال أحمد",
    phone: "+201111111111",
    password: "Test@123",
    role: "user",
    isVerified: true
  },
  {
    name: "أحمد محمود",
    phone: "+201222222222",
    password: "Test@123",
    role: "user",
    isVerified: true
  },
  {
    name: "فاطمة خالد",
    phone: "+201333333333",
    password: "Test@123",
    role: "user",
    isVerified: true
  },
  {
    name: "سارة عبدالله",
    phone: "+201444444444",
    password: "Test@123",
    role: "user",
    isVerified: true
  }
];

// Coupons data
const couponsData = [
  {
    code: "SAVE5",
    discountType: "fixed",
    discountValue: 50,
    maxUses: 100,
    usedCount: 0,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    isActive: true,
    applicablePackages: [] // Will be updated with basic package ID
  },
  {
    code: "WELCOME20",
    discountType: "percentage",
    discountValue: 20,
    maxUses: 100,
    usedCount: 0,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    isActive: true,
    applicablePackages: [] // Applies to all
  },
  {
    code: "PREMIUM50",
    discountType: "percentage",
    discountValue: 50,
    maxUses: 100,
    usedCount: 0,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    isActive: true,
    applicablePackages: [] // Will be updated with basic package ID
  }
];

// Production protection
function checkEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceFlag = process.argv.includes('--force');

  if (isProduction && !forceFlag) {
    logger.warn('⚠️  WARNING: You are trying to seed the database in PRODUCTION!');
    logger.warn('⚠️  This will delete ALL existing data.');
    logger.warn('⚠️  If you really want to do this, run: npm run seed:actual -- --force');
    process.exit(1);
  }

  if (isProduction && forceFlag) {
    logger.warn('⚠️  WARNING: Seeding production database with --force flag!');
  }
}

// Clear collections
async function clearCollections() {
  logger.info('🗑️  Clearing collections...');

  await Category.deleteMany({});
  await Track.deleteMany({});
  await Program.deleteMany({});
  await Package.deleteMany({});
  await User.deleteMany({});
  await Coupon.deleteMany({});

  logger.info('✅ Collections cleared');
}

// Seed categories
async function seedCategories() {
  logger.info('📁 Seeding categories...');

  const categories = await Category.insertMany(categoriesData);
  logger.info(`✅ Created ${categories.length} categories`);

  // Create map for easy lookup
  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  categories.forEach(cat => {
    categoryMap.set(cat.name, cat._id as mongoose.Types.ObjectId);
  });

  return categoryMap;
}

// Seed tracks
async function seedTracks(categoryMap: Map<string, mongoose.Types.ObjectId>) {
  logger.info('🎵 Seeding tracks...');

  const tracksToInsert = tracksData.map(track => {
    const { categoryName, ...trackData } = track;
    return {
      ...trackData,
      category: categoryMap.get(categoryName)
    };
  });

  const tracks = await Track.insertMany(tracksToInsert);
  logger.info(`✅ Created ${tracks.length} tracks`);

  // Create map for easy lookup
  const trackMap = new Map<string, mongoose.Types.ObjectId>();
  tracks.forEach(track => {
    trackMap.set(track.title, track._id as mongoose.Types.ObjectId);
  });

  return trackMap;
}

// Seed programs
async function seedPrograms(
  categoryMap: Map<string, mongoose.Types.ObjectId>,
  trackMap: Map<string, mongoose.Types.ObjectId>
) {
  logger.info('📚 Seeding programs...');

  const programsToInsert = programsData.map(program => {
    const { categoryName, trackTitles, ...programData } = program;
    return {
      ...programData,
      category: categoryMap.get(categoryName),
      tracks: trackTitles.map((title, index) => ({
        trackId: trackMap.get(title),
        order: index + 1
      }))
    };
  });

  const programs = await Program.insertMany(programsToInsert);
  logger.info(`✅ Created ${programs.length} programs`);

  return programs;
}

// Seed packages
async function seedPackages() {
  logger.info('📦 Seeding packages...');

  const packages = await Package.insertMany(packagesData);
  logger.info(`✅ Created ${packages.length} packages`);

  // Create map for easy lookup
  const packageMap = new Map<string, mongoose.Types.ObjectId>();
  packages.forEach(pkg => {
    packageMap.set(pkg.type, pkg._id as mongoose.Types.ObjectId);
  });

  return packageMap;
}

// Seed users
async function seedUsers() {
  logger.info('👤 Seeding users...');

  const users = [];
  for (const userData of usersData) {
    const user = await User.create(userData);
    users.push(user);
  }

  logger.info(`✅ Created ${users.length} users`);
  return users;
}

// Seed coupons
async function seedCoupons(packageMap: Map<string, mongoose.Types.ObjectId>) {
  logger.info('🎟️  Seeding coupons...');

  const basicPackageId = packageMap.get('basic');

  const couponsToInsert = couponsData.map(coupon => {
    // SAVE5 and PREMIUM50 apply to basic package only
    if (coupon.code === 'SAVE5' || coupon.code === 'PREMIUM50') {
      return {
        ...coupon,
        applicablePackages: basicPackageId ? [basicPackageId] : []
      };
    }
    return coupon;
  });

  const coupons = await Coupon.insertMany(couponsToInsert);
  logger.info(`✅ Created ${coupons.length} coupons`);

  return coupons;
}

// Main seed function
async function seedActualData() {
  try {
    checkEnvironment();

    await connectDatabase();

    // Clear if --clear flag provided
    if (process.argv.includes('--clear')) {
      await clearCollections();
    }

    logger.info('🌱 Seeding actual data...');
    logger.info(`📍 Base URL: ${BASE_URL}`);

    const categoryMap = await seedCategories();
    const trackMap = await seedTracks(categoryMap);
    await seedPrograms(categoryMap, trackMap);
    const packageMap = await seedPackages();
    await seedUsers();
    await seedCoupons(packageMap);

    logger.info('');
    logger.info('✅ ========================================');
    logger.info('✅ Actual data seeded successfully!');
    logger.info('✅ ========================================');
    logger.info('');
    logger.info('📊 Summary:');
    logger.info(`   - ${categoriesData.length} categories`);
    logger.info(`   - ${tracksData.length} tracks`);
    logger.info(`   - ${programsData.length} programs`);
    logger.info(`   - ${packagesData.length} packages`);
    logger.info(`   - ${usersData.length} users`);
    logger.info(`   - ${couponsData.length} coupons`);
    logger.info('');
    logger.info('👤 Admin Credentials:');
    logger.info('   Phone: +201234567890');
    logger.info('   Email: admin@naturacalm.com');
    logger.info('   Password: Admin@123');
    logger.info('');
    logger.info('👥 Test Users (Password: Test@123):');
    logger.info('   - نهال أحمد: +201111111111');
    logger.info('   - أحمد محمود: +201222222222');
    logger.info('   - فاطمة خالد: +201333333333');
    logger.info('   - سارة عبدالله: +201444444444');
    logger.info('');
    logger.info('🎟️  Coupon Codes:');
    logger.info('   - SAVE5: 50 SAR off (basic package)');
    logger.info('   - WELCOME20: 20% off (all packages)');
    logger.info('   - PREMIUM50: 50% off (basic package)');
    logger.info('');
    logger.info('⚠️  NOTE: Some URLs point to uploaded files.');
    logger.info('   Make sure these files exist in your production storage.');
    logger.info('');

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding actual data:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

seedActualData();
