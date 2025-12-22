import { connectDatabase } from '../config/database';
import { Package } from '../models/Package.model';
import logger from '../utils/logger';

const seedPackages = async (): Promise<void> => {
  try {
    await connectDatabase();

    await Package.deleteMany({});

    const packages = [
      {
        name: 'الباقة الأساسية',
        nameEn: 'Basic Package',
        type: 'basic',
        price: 9.99,
        currency: 'USD',
        periodType: 'month',
        periodCount: 1,
        durationInDays: 30,
        discountPercentage: 0,
        features: [
          'وصول إلى المحتوى المميز',
          'جودة صوت عالية',
          'بدون إعلانات',
        ],
        isActive: true,
        displayOrder: 1,
      },
      {
        name: 'الباقة القياسية',
        nameEn: 'Standard Package',
        type: 'standard',
        price: 24.99,
        currency: 'USD',
        periodType: 'month',
        periodCount: 3,
        durationInDays: 90,
        discountPercentage: 10,
        features: [
          'وصول إلى المحتوى المميز',
          'جودة صوت عالية',
          'بدون إعلانات',
          'محتوى حصري',
        ],
        isActive: true,
        displayOrder: 2,
      },
      {
        name: 'الباقة المتميزة',
        nameEn: 'Premium Package',
        type: 'premium',
        price: 99.99,
        currency: 'USD',
        periodType: 'year',
        periodCount: 1,
        durationInDays: 365,
        discountPercentage: 20,
        features: [
          'وصول غير محدود لجميع المحتوى',
          'جودة صوت فائقة',
          'بدون إعلانات',
          'محتوى حصري',
          'تحديثات أسبوعية',
        ],
        isActive: true,
        displayOrder: 3,
      },
    ];

    const created = await Package.insertMany(packages);
    logger.info(`✅ Successfully created ${created.length} packages`);

    for (const pkg of created) {
      logger.info(`  - ${pkg.name} (${pkg.type}): ${pkg.priceFormatted}/${pkg.periodArabic}`);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding packages:', error);
    process.exit(1);
  }
};

seedPackages();
