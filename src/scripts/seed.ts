import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import logger from '../config/logger';

// Import models
import Category from '../models/Category.model';
import Track from '../models/Track.model';
import Program from '../models/Program.model';
import Package from '../models/Package.model';
import User from '../models/User.model';
import UserFavorite from '../models/UserFavorite.model';
import UserProgram from '../models/UserProgram.model';
import ListeningSession from '../models/ListeningSession.model';
import Notification from '../models/Notification.model';
import Coupon from '../models/Coupon.model';
import Subscription from '../models/Subscription.model';

// Image URLs from frontend mockData
const categoryImages = {
  "التأمل": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop",
  "المسارات": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&h=400&fit=crop",
  "التنويم الايحائي": "https://images.unsplash.com/photo-1516450137517-162bfbeb8dba?w=400&h=400&fit=crop",
  "الطبيعة": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop",
  "الاسترخاء": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=400&fit=crop"
};

const trackImages = [
  "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1511295742362-92c96b1cf484?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1548979723-e0e9a0b8e04d?w=400&h=400&fit=crop"
];

const programImages = {
  program1: [
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=100&fit=crop",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop"
  ],
  program2: [
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=200&h=100&fit=crop",
    "https://images.unsplash.com/photo-1516450137517-162bfbeb8dba?w=100&h=100&fit=crop"
  ],
  program3: [
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=200&h=100&fit=crop",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop"
  ]
};

// Placeholder audio URL
const AUDIO_PLACEHOLDER = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

// Production protection
function checkEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceFlag = process.argv.includes('--force');

  if (isProduction && !forceFlag) {
    logger.warn('⚠️  WARNING: You are trying to seed the database in PRODUCTION!');
    logger.warn('⚠️  This will delete ALL existing data.');
    logger.warn('⚠️  If you really want to do this, run: npm run seed -- --force');
    process.exit(1);
  }

  if (isProduction && forceFlag) {
    logger.warn('⚠️  WARNING: Seeding production database with --force flag!');
  }
}

// Clear database function
async function clearDatabase() {
  logger.info('🗑️  Clearing database...');

  await Category.deleteMany({});
  await Track.deleteMany({});
  await Program.deleteMany({});
  await Package.deleteMany({});
  await User.deleteMany({});
  await UserFavorite.deleteMany({});
  await UserProgram.deleteMany({});
  await ListeningSession.deleteMany({});
  await Notification.deleteMany({});
  await Coupon.deleteMany({});
  await Subscription.deleteMany({});

  logger.info('✅ Database cleared');
}

// Seed categories
async function seedCategories() {
  logger.info('📁 Seeding categories...');

  const categories = [
    {
      name: "التأمل",
      nameEn: "Meditation",
      icon: "🧘",
      color: "from-blue-100 to-blue-50",
      imageUrl: categoryImages["التأمل"],
      description: "جلسات تأمل مهدئة لتصفية الذهن والاسترخاء العميق",
      displayOrder: 1,
      isActive: true
    },
    {
      name: "المسارات",
      nameEn: "Programs",
      icon: "🎯",
      color: "from-purple-100 to-purple-50",
      imageUrl: categoryImages["المسارات"],
      description: "برامج متكاملة لرحلة استرخاء منظمة",
      displayOrder: 2,
      isActive: true
    },
    {
      name: "التنويم الايحائي",
      nameEn: "Hypnosis",
      icon: "🧠",
      color: "from-indigo-100 to-indigo-50",
      imageUrl: categoryImages["التنويم الايحائي"],
      description: "جلسات تنويم إيحائي للنوم العميق والاسترخاء",
      displayOrder: 3,
      isActive: true
    },
    {
      name: "الطبيعة",
      nameEn: "Nature",
      icon: "🌿",
      color: "from-green-100 to-green-50",
      imageUrl: categoryImages["الطبيعة"],
      description: "أصوات الطبيعة الهادئة والمريحة",
      displayOrder: 4,
      isActive: true
    },
    {
      name: "الاسترخاء",
      nameEn: "Relaxation",
      icon: "🌙",
      color: "from-teal-100 to-teal-50",
      imageUrl: categoryImages["الاسترخاء"],
      description: "موسيقى وأصوات للاسترخاء والهدوء",
      displayOrder: 5,
      isActive: true
    }
  ];

  const createdCategories = await Category.insertMany(categories);
  logger.info(`✅ Created ${createdCategories.length} categories`);

  return createdCategories;
}

// Seed tracks
async function seedTracks(categoryMap: Map<string, mongoose.Types.ObjectId>) {
  logger.info('🎵 Seeding tracks...');

  const tracks = [
    {
      title: "همس النجوم",
      description: "رحلة هادئة مع همسات النجوم في سماء الليل الصافية",
      durationSeconds: 1200, // 20 minutes
      level: "مبتدأ",
      category: categoryMap.get("الاسترخاء"),
      relaxationType: "استرخاء مسائي",
      imageUrl: trackImages[0],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 15000) + 10000,
      isPremium: false,
      isActive: true,
      tags: ["استرخاء", "نوم", "ليل"]
    },
    {
      title: "شاطئ الغروب الهادئ",
      description: "استمع لأمواج البحر الهادئة وقت الغروب",
      durationSeconds: 930, // 15.5 minutes
      level: "مبتدأ",
      category: categoryMap.get("الطبيعة"),
      relaxationType: "استرخاء صباحي",
      imageUrl: trackImages[1],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 20000) + 5000,
      isPremium: false,
      isActive: true,
      tags: ["بحر", "طبيعة", "أمواج"]
    },
    {
      title: "رحلة داخلية",
      description: "تأمل عميق لاستكشاف الذات الداخلية والسلام النفسي",
      durationSeconds: 1500, // 25 minutes
      level: "متوسط",
      category: categoryMap.get("التأمل"),
      imageUrl: trackImages[2],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 12000) + 8000,
      isPremium: true,
      isActive: true,
      tags: ["تأمل", "عميق", "سلام"]
    },
    {
      title: "أثير السلام",
      description: "موسيقى هادئة تنقلك إلى عالم من السكينة والطمأنينة",
      durationSeconds: 1125, // 18.75 minutes
      level: "مبتدأ",
      category: categoryMap.get("الاسترخاء"),
      relaxationType: "استرخاء مسائي",
      imageUrl: trackImages[3],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 18000) + 7000,
      isPremium: false,
      isActive: true,
      tags: ["موسيقى", "هدوء", "سكينة"]
    },
    {
      title: "مطر الربيع الخفيف",
      description: "صوت المطر الخفيف مع نسمات الربيع المنعشة",
      durationSeconds: 1800, // 30 minutes
      level: "مبتدأ",
      category: categoryMap.get("الطبيعة"),
      imageUrl: trackImages[4],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 25000) + 5000,
      isPremium: true,
      isActive: true,
      tags: ["مطر", "طبيعة", "ربيع"]
    },
    {
      title: "نوم عميق",
      description: "جلسة تنويم إيحائي للوصول إلى نوم عميق ومريح",
      durationSeconds: 2700, // 45 minutes
      level: "متقدم",
      category: categoryMap.get("التنويم الايحائي"),
      imageUrl: trackImages[5],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 15000) + 10000,
      isPremium: true,
      isActive: true,
      tags: ["نوم", "تنويم", "عميق"]
    },
    {
      title: "هديل حمام السلام",
      description: "صوت هديل الحمام في صباح هادئ ومشرق",
      durationSeconds: 1350, // 22.5 minutes
      level: "مبتدأ",
      category: categoryMap.get("الطبيعة"),
      imageUrl: trackImages[6],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 10000) + 5000,
      isPremium: false,
      isActive: true,
      tags: ["طيور", "صباح", "طبيعة"]
    },
    {
      title: "دفء المدفأة",
      description: "صوت تكتكة الحطب في المدفأة لشتاء دافئ ومريح",
      durationSeconds: 2100, // 35 minutes
      level: "مبتدأ",
      category: categoryMap.get("الاسترخاء"),
      relaxationType: "استرخاء مسائي",
      imageUrl: trackImages[7],
      audioUrl: AUDIO_PLACEHOLDER,
      playCount: Math.floor(Math.random() * 13000) + 7000,
      isPremium: false,
      isActive: true,
      tags: ["شتاء", "دفء", "هدوء"]
    }
  ];

  const createdTracks = await Track.insertMany(tracks);
  logger.info(`✅ Created ${createdTracks.length} tracks`);

  return createdTracks;
}

// Seed programs
async function seedPrograms(
  categoryMap: Map<string, mongoose.Types.ObjectId>,
  tracks: any[]
) {
  logger.info('📚 Seeding programs...');

  const programs = [
    {
      title: "واحة السكينة",
      description: "برنامج متكامل لمدة 14 يوم للوصول إلى السكينة والهدوء الداخلي",
      level: "مبتدأ",
      category: categoryMap.get("الاسترخاء"),
      thumbnailUrl: programImages.program1[0],
      thumbnailImages: programImages.program1.slice(1),
      tracks: [
        { trackId: tracks[0]._id, order: 1 },
        { trackId: tracks[1]._id, order: 2 },
        { trackId: tracks[3]._id, order: 3 }
      ],
      playCount: Math.floor(Math.random() * 8000) + 2000,
      isPremium: false,
      isFeatured: true,
      isActive: true
    },
    {
      title: "رحلة التأمل العميق",
      description: "برنامج متقدم لمدة 10 أيام لتعميق ممارسة التأمل والوصول للسلام الداخلي",
      level: "متقدم",
      category: categoryMap.get("التأمل"),
      thumbnailUrl: programImages.program2[0],
      thumbnailImages: programImages.program2.slice(1),
      tracks: [
        { trackId: tracks[2]._id, order: 1 },
        { trackId: tracks[5]._id, order: 2 }
      ],
      playCount: Math.floor(Math.random() * 5000) + 3000,
      isPremium: true,
      isFeatured: true,
      isActive: true
    },
    {
      title: "أصوات الطبيعة الشافية",
      description: "برنامج لمدة 12 يوم مع أجمل أصوات الطبيعة للاسترخاء والشفاء",
      level: "متوسط",
      category: categoryMap.get("الطبيعة"),
      thumbnailUrl: programImages.program3[0],
      thumbnailImages: programImages.program3.slice(1),
      tracks: [
        { trackId: tracks[1]._id, order: 1 },
        { trackId: tracks[4]._id, order: 2 },
        { trackId: tracks[6]._id, order: 3 }
      ],
      playCount: Math.floor(Math.random() * 6000) + 2500,
      isPremium: false,
      isFeatured: false,
      isActive: true
    }
  ];

  const createdPrograms = await Program.insertMany(programs);
  logger.info(`✅ Created ${createdPrograms.length} programs`);

  return createdPrograms;
}

// Seed packages
async function seedPackages() {
  logger.info('📦 Seeding subscription packages...');

  const packages = [
    {
      name: "الاشتراك المتميز",
      nameEn: "Premium Subscription",
      type: "premium",
      price: 20,
      currency: "USD",
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
      price: 10,
      currency: "USD",
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

  const createdPackages = await Package.insertMany(packages);
  logger.info(`✅ Created ${createdPackages.length} packages`);

  return createdPackages;
}

// Seed admin user
async function seedAdmin() {
  logger.info('👤 Creating admin user...');

  const admin = await User.create({
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
  });

  logger.info('✅ Admin user created');
  logger.info('📧 Email: admin@naturacalm.com');
  logger.info('🔑 Password: Admin@123');

  return admin;
}

// Seed test users
async function seedTestUsers(packages: any[]) {
  logger.info('👥 Creating test users...');

  const premiumPackage = packages.find(p => p.type === 'premium');
  const basicPackage = packages.find(p => p.type === 'basic');

  // User 1: Free tier (no subscription)
  const user1 = await User.create({
    name: "نهال أحمد",
    phone: "+201111111111",
    password: "Test@123",
    role: "user",
    isVerified: true,
    subscription: {
      status: "expired",
      autoRenew: true
    }
  });

  // User 2: Basic subscription
  const user2 = await User.create({
    name: "أحمد محمود",
    phone: "+201222222222",
    password: "Test@123",
    role: "user",
    isVerified: true,
    subscription: {
      packageId: basicPackage._id,
      status: "active",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      autoRenew: true
    }
  });

  // Create subscription for user 2
  await Subscription.create({
    userId: user2._id,
    packageId: basicPackage._id,
    status: "active",
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    autoRenew: true,
    paymentMethod: "visa"
  });

  // User 3: Premium subscription
  const user3 = await User.create({
    name: "فاطمة خالد",
    phone: "+201333333333",
    password: "Test@123",
    role: "user",
    isVerified: true,
    subscription: {
      packageId: premiumPackage._id,
      status: "active",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      autoRenew: true
    }
  });

  // Create subscription for user 3
  await Subscription.create({
    userId: user3._id,
    packageId: premiumPackage._id,
    status: "active",
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    autoRenew: true,
    paymentMethod: "apple-pay"
  });

  // User 4: Expired subscription
  const user4 = await User.create({
    name: "سارة عبدالله",
    phone: "+201444444444",
    password: "Test@123",
    role: "user",
    isVerified: true,
    subscription: {
      packageId: basicPackage._id,
      status: "expired",
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      autoRenew: false
    }
  });

  await Subscription.create({
    userId: user4._id,
    packageId: basicPackage._id,
    status: "expired",
    startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    autoRenew: false
  });

  const users = [user1, user2, user3, user4];
  logger.info(`✅ Created ${users.length} test users`);

  return users;
}

// Seed favorites
async function seedFavorites(users: any[], tracks: any[], programs: any[]) {
  logger.info('❤️  Seeding user favorites...');

  const favorites = [];

  for (const user of users) {
    // Add 2-3 favorite tracks per user
    const numTracks = 2 + Math.floor(Math.random() * 2);
    const selectedTracks = tracks.sort(() => 0.5 - Math.random()).slice(0, numTracks);

    for (const track of selectedTracks) {
      favorites.push({
        userId: user._id,
        trackId: track._id,
        type: 'track'
      });
    }

    // Add 1-2 favorite programs per user
    const numPrograms = 1 + Math.floor(Math.random() * 2);
    const selectedPrograms = programs.sort(() => 0.5 - Math.random()).slice(0, numPrograms);

    for (const program of selectedPrograms) {
      favorites.push({
        userId: user._id,
        programId: program._id,
        type: 'program'
      });
    }
  }

  const createdFavorites = await UserFavorite.insertMany(favorites);
  logger.info(`✅ Created ${createdFavorites.length} favorites`);

  return createdFavorites;
}

// Seed enrollments
async function seedEnrollments(users: any[], programs: any[], tracks: any[]) {
  logger.info('📖 Seeding user program enrollments...');

  const enrollments = [];

  for (const user of users) {
    // Enroll user in 1-2 programs
    const numPrograms = 1 + Math.floor(Math.random() * 2);
    const selectedPrograms = programs.sort(() => 0.5 - Math.random()).slice(0, numPrograms);

    for (const program of selectedPrograms) {
      // Get program tracks
      const programTracks = program.tracks || [];
      const totalTracks = programTracks.length;

      // Complete random number of tracks (0 to all)
      const numCompleted = Math.floor(Math.random() * (totalTracks + 1));
      const completedTracks = programTracks
        .slice(0, numCompleted)
        .map((t: any) => t.trackId);

      const progress = totalTracks > 0 ? Math.round((numCompleted / totalTracks) * 100) : 0;
      const isCompleted = progress === 100;

      enrollments.push({
        userId: user._id,
        programId: program._id,
        completedTracks,
        progress,
        enrolledAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
        lastAccessedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date in last 7 days
        isCompleted,
        completedAt: isCompleted ? new Date() : undefined
      });
    }
  }

  const createdEnrollments = await UserProgram.insertMany(enrollments);
  logger.info(`✅ Created ${createdEnrollments.length} enrollments`);

  return createdEnrollments;
}

// Seed listening sessions
async function seedSessions(users: any[], tracks: any[], programs: any[]) {
  logger.info('🎧 Seeding listening sessions...');

  const sessions = [];

  for (const user of users) {
    // Create 10-20 sessions per user
    const numSessions = 10 + Math.floor(Math.random() * 11);

    for (let i = 0; i < numSessions; i++) {
      const track = tracks[Math.floor(Math.random() * tracks.length)];
      const hasProgram = Math.random() > 0.5;
      const program = hasProgram ? programs[Math.floor(Math.random() * programs.length)] : null;

      // Random start time in last 30 days
      const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

      // Some sessions completed, some not
      const completed = Math.random() > 0.3; // 70% completion rate
      const durationSeconds = completed
        ? track.durationSeconds
        : Math.floor(Math.random() * track.durationSeconds);

      const endTime = completed
        ? new Date(startTime.getTime() + track.durationSeconds * 1000)
        : undefined;

      sessions.push({
        userId: user._id,
        trackId: track._id,
        programId: program?._id,
        startTime,
        endTime,
        durationSeconds,
        completed,
        lastPosition: durationSeconds
      });
    }
  }

  const createdSessions = await ListeningSession.insertMany(sessions);
  logger.info(`✅ Created ${createdSessions.length} listening sessions`);

  return createdSessions;
}

// Seed notifications
async function seedNotifications(users: any[]) {
  logger.info('🔔 Seeding notifications...');

  const notificationTypes = ['new_content', 'achievement', 'reminder', 'subscription', 'system'];
  const notifications = [];

  const notificationTemplates = {
    new_content: [
      { title: "محتوى جديد", message: "تم إضافة جلسات تأمل جديدة استكشفها الآن!", icon: "🎵" },
      { title: "برنامج جديد", message: "برنامج جديد متاح: رحلة السكينة الداخلية", icon: "✨" }
    ],
    achievement: [
      { title: "إنجاز رائع", message: "أكملت 7 أيام متتالية من التأمل!", icon: "🏆" },
      { title: "مستوى جديد", message: "وصلت إلى المستوى المتوسط، أحسنت!", icon: "⭐" }
    ],
    reminder: [
      { title: "وقت التأمل", message: "حان وقت جلستك اليومية، لا تنسى!", icon: "⏰" },
      { title: "تذكير ودي", message: "لم تستمع لأي جلسة اليوم، خذ وقتك للاسترخاء", icon: "🌙" }
    ],
    subscription: [
      { title: "اشتراكك ينتهي قريباً", message: "اشتراكك سينتهي خلال 7 أيام، جدده الآن", icon: "💳" },
      { title: "تم تجديد الاشتراك", message: "تم تجديد اشتراكك بنجاح، استمتع بالمحتوى", icon: "✅" }
    ],
    system: [
      { title: "مرحباً بك", message: "مرحباً بك في ناتشورا كالم، ابدأ رحلتك نحو الاسترخاء", icon: "👋" },
      { title: "تحديث جديد", message: "تحديث جديد متاح مع ميزات محسنة", icon: "🔄" }
    ]
  };

  for (const user of users) {
    // Create 5-10 notifications per user
    const numNotifications = 5 + Math.floor(Math.random() * 6);

    for (let i = 0; i < numNotifications; i++) {
      const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)] as any;
      const templates = notificationTemplates[type];
      const template = templates[Math.floor(Math.random() * templates.length)];

      const isRead = Math.random() > 0.4; // 60% are read
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days

      notifications.push({
        userId: user._id,
        type,
        title: template.title,
        message: template.message,
        icon: template.icon,
        isRead,
        readAt: isRead ? new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) : undefined,
        createdAt
      });
    }
  }

  const createdNotifications = await Notification.insertMany(notifications);
  logger.info(`✅ Created ${createdNotifications.length} notifications`);

  return createdNotifications;
}

// Seed coupons
async function seedCoupons(packages: any[]) {
  logger.info('🎟️  Seeding coupons...');

  const premiumPackage = packages.find(p => p.type === 'premium');

  const coupons = [
    {
      code: "SAVE5",
      discountType: "fixed",
      discountValue: 5,
      maxUses: 100,
      usedCount: Math.floor(Math.random() * 20),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      isActive: true,
      applicablePackages: [] // Applies to all packages
    },
    {
      code: "WELCOME20",
      discountType: "percentage",
      discountValue: 20,
      maxUses: 100,
      usedCount: Math.floor(Math.random() * 30),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      isActive: true,
      applicablePackages: [] // Applies to all packages
    },
    {
      code: "PREMIUM50",
      discountType: "percentage",
      discountValue: 50,
      maxUses: 50,
      usedCount: Math.floor(Math.random() * 10),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true,
      applicablePackages: [premiumPackage._id] // Only for premium package
    }
  ];

  const createdCoupons = await Coupon.insertMany(coupons);
  logger.info(`✅ Created ${createdCoupons.length} coupons`);

  return createdCoupons;
}

// Main seed function
async function seed() {
  try {
    // Check environment and protection
    checkEnvironment();

    // Connect to database
    await connectDatabase();

    // Clear database if --clear flag is provided
    if (process.argv.includes('--clear')) {
      await clearDatabase();
    }

    logger.info('🌱 Starting database seeding...');
    logger.info('⚠️  All data will be in Arabic as per requirements');

    // Seed data in order
    const categories = await seedCategories();
    const categoryMap = new Map<string, mongoose.Types.ObjectId>(
      categories.map(cat => [cat.name, cat._id as mongoose.Types.ObjectId])
    );

    const tracks = await seedTracks(categoryMap);
    const programs = await seedPrograms(categoryMap, tracks);
    const packages = await seedPackages();
    const admin = await seedAdmin();
    const users = await seedTestUsers(packages);
    await seedFavorites(users, tracks, programs);
    await seedEnrollments(users, programs, tracks);
    await seedSessions(users, tracks, programs);
    await seedNotifications(users);
    await seedCoupons(packages);

    logger.info('');
    logger.info('✅ ========================================');
    logger.info('✅ Database seeded successfully!');
    logger.info('✅ ========================================');
    logger.info('');
    logger.info('📊 Summary:');
    logger.info(`   - ${categories.length} categories`);
    logger.info(`   - ${tracks.length} tracks`);
    logger.info(`   - ${programs.length} programs`);
    logger.info(`   - ${packages.length} packages`);
    logger.info(`   - ${users.length + 1} users (including admin)`);
    logger.info('');
    logger.info('👤 Admin Credentials:');
    logger.info('   Email: admin@naturacalm.com');
    logger.info('   Password: Admin@123');
    logger.info('');
    logger.info('👥 Test Users:');
    logger.info('   User 1 (Free): +201111111111 / Test@123');
    logger.info('   User 2 (Basic): +201222222222 / Test@123');
    logger.info('   User 3 (Premium): +201333333333 / Test@123');
    logger.info('   User 4 (Expired): +201444444444 / Test@123');
    logger.info('');
    logger.info('🎟️  Coupon Codes:');
    logger.info('   SAVE5 - $5 off any package');
    logger.info('   WELCOME20 - 20% off any package');
    logger.info('   PREMIUM50 - 50% off Premium package only');
    logger.info('');

    // Disconnect
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding database:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

// Run seed function
seed();
