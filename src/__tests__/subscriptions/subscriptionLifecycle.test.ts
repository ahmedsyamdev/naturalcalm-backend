import '../setup';
import { User, IUser } from '../../models/User.model';
import { Package, IPackage } from '../../models/Package.model';
import { Subscription } from '../../models/Subscription.model';
import { Notification } from '../../models/Notification.model';
import { Document } from 'mongoose';

describe('Subscription Lifecycle Tests', () => {
  let testUser: IUser & Document;
  let basicPackage: IPackage & Document;
  let premiumPackage: IPackage & Document;

  beforeEach(async () => {
    testUser = await User.create({
      name: 'Test User',
      phone: '+1234567890',
      password: 'password123',
      isVerified: true,
    });

    basicPackage = await Package.create({
      name: 'الباقة الأساسية',
      nameEn: 'Basic Package',
      type: 'basic',
      price: 9.99,
      currency: 'USD',
      periodType: 'month',
      periodCount: 1,
      discountPercentage: 0,
      features: ['وصول إلى المحتوى المميز', 'جودة صوت عالية', 'بدون إعلانات'],
      isActive: true,
      displayOrder: 1,
    });

    premiumPackage = await Package.create({
      name: 'الباقة المتميزة',
      nameEn: 'Premium Package',
      type: 'premium',
      price: 99.99,
      currency: 'USD',
      periodType: 'year',
      periodCount: 1,
      discountPercentage: 20,
      features: [
        'وصول غير محدود لجميع المحتوى',
        'جودة صوت فائقة',
        'بدون إعلانات',
        'محتوى حصري',
        'تحديثات أسبوعية',
      ],
      isActive: true,
      displayOrder: 2,
    });
  });

  describe('1. Test viewing packages', () => {
    it('should retrieve all active packages', async () => {
      const packages = await Package.find({ isActive: true }).sort({ displayOrder: 1 });

      expect(packages).toHaveLength(2);
      expect(packages[0].name).toBe('الباقة الأساسية');
      expect(packages[1].name).toBe('الباقة المتميزة');
    });

    it('should not retrieve inactive packages', async () => {
      await Package.create({
        name: 'Inactive Package',
        type: 'basic',
        price: 5.99,
        periodType: 'month',
        periodCount: 1,
        isActive: false,
      });

      const packages = await Package.find({ isActive: true });
      expect(packages).toHaveLength(2);
    });
  });

  describe('2. Test getting user subscription (none exists)', () => {
    it('should return null when user has no subscription', async () => {
      const subscription = await Subscription.findOne({
        userId: testUser._id,
        status: 'active',
      });

      expect(subscription).toBeNull();
    });

    it('should show user is on free tier', async () => {
      expect(testUser.subscription.status).toBe('expired');
    });
  });

  describe('3. Test subscribing to package', () => {
    it('should create active subscription', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate,
        endDate,
        autoRenew: true,
      });

      expect(subscription.status).toBe('active');
      expect(subscription.autoRenew).toBe(true);
      expect(subscription.userId.toString()).toBe(testUser._id.toString());
    });

    it('should update user subscription field', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate,
        endDate,
      });

      await User.findByIdAndUpdate(testUser._id, {
        'subscription.packageId': basicPackage._id,
        'subscription.status': 'active',
        'subscription.startDate': startDate,
        'subscription.endDate': endDate,
      });

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.subscription.status).toBe('active');
    });

    it('should create notification on subscription', async () => {
      await Notification.create({
        userId: testUser._id,
        type: 'subscription',
        title: 'اشتراك مفعّل',
        message: 'تم تفعيل اشتراكك بنجاح',
      });

      const notifications = await Notification.find({ userId: testUser._id });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('subscription');
    });
  });

  describe('4. Test subscription becomes active', () => {
    it('should have correct daysRemaining virtual field', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 15);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate,
      });

      expect(subscription.daysRemaining).toBeGreaterThan(0);
      expect(subscription.daysRemaining).toBeLessThanOrEqual(16);
    });

    it('should have isActive virtual field as true', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 10);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate,
      });

      expect(subscription.isActive).toBe(true);
    });
  });

  describe('5. Test cancelling subscription', () => {
    it('should set autoRenew to false', async () => {
      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true,
      });

      await subscription.cancel();

      expect(subscription.autoRenew).toBe(false);
      expect(subscription.cancellationDate).toBeDefined();
    });

    it('should keep status as active', async () => {
      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await subscription.cancel();

      expect(subscription.status).toBe('active');
    });
  });

  describe('6. Test subscription remains active until endDate', () => {
    it('should remain active before endDate', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 5);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate,
        autoRenew: false,
      });

      expect(subscription.isActive).toBe(true);
      expect(subscription.daysRemaining).toBeGreaterThan(0);
    });
  });

  describe('7. Test subscription expires after endDate', () => {
    it('should auto-expire when endDate passes', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: pastDate,
      });

      expect(subscription.status).toBe('expired');
      expect(subscription.isActive).toBe(false);
      expect(subscription.daysRemaining).toBe(0);
    });

    it('should find expired subscriptions', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: pastDate,
      });

      const expiredSubs = await Subscription.find({
        status: 'active',
        endDate: { $lte: new Date() },
      });

      expect(expiredSubs).toHaveLength(1);
    });
  });

  describe('8. Test renewal', () => {
    it('should extend subscription endDate', async () => {
      const currentEndDate = new Date();
      currentEndDate.setDate(currentEndDate.getDate() + 5);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate: currentEndDate,
      });

      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);

      await subscription.renew(newEndDate);

      expect(subscription.status).toBe('active');
      expect(subscription.endDate.getTime()).toBe(newEndDate.getTime());
    });
  });

  describe('9. Test upgrade/downgrade with proration', () => {
    it('should calculate proration when upgrading', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 15);

      const _subscription = await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate,
      });

      const now = new Date();
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const oldPricePerDay = basicPackage.price / 30;
      const newPricePerDay = premiumPackage.price / 365;

      const remainingCredit = daysRemaining * oldPricePerDay;
      const creditDays = Math.floor(remainingCredit / newPricePerDay);

      expect(creditDays).toBeGreaterThan(0);
      expect(remainingCredit).toBeGreaterThan(0);
    });
  });

  describe('10. Test auto-renewal', () => {
    it('should find subscriptions with autoRenew enabled', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate: futureDate,
        autoRenew: true,
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const subsToRenew = await Subscription.find({
        status: 'active',
        autoRenew: true,
        endDate: { $gte: new Date(), $lte: nextWeek },
      });

      expect(subsToRenew).toHaveLength(1);
    });
  });

  describe('11. Test accessing premium content', () => {
    it('should allow access with active subscription', async () => {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: premiumPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate,
      });

      const hasAccess = subscription.isActive;
      expect(hasAccess).toBe(true);
    });

    it('should deny access without subscription', async () => {
      const subscription = await Subscription.findOne({
        userId: testUser._id,
        status: 'active',
      });

      expect(subscription).toBeNull();
    });

    it('should deny access with expired subscription', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const subscription = await Subscription.create({
        userId: testUser._id,
        packageId: premiumPackage._id,
        status: 'expired',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: pastDate,
      });

      expect(subscription.isActive).toBe(false);
    });
  });

  describe('12. Test subscription history', () => {
    it('should retrieve all user subscriptions', async () => {
      const endDate1 = new Date();
      endDate1.setMonth(endDate1.getMonth() - 2);

      const endDate2 = new Date();
      endDate2.setMonth(endDate2.getMonth() + 1);

      await Subscription.create({
        userId: testUser._id,
        packageId: basicPackage._id,
        status: 'expired',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: endDate1,
      });

      await Subscription.create({
        userId: testUser._id,
        packageId: premiumPackage._id,
        status: 'active',
        startDate: new Date(),
        endDate: endDate2,
      });

      const history = await Subscription.find({ userId: testUser._id }).sort({
        startDate: -1,
      });

      expect(history).toHaveLength(2);
    });
  });
});
