import { NotificationType, NotificationData } from '../services/notification.service';

/**
 * Template parameters for different notification types
 */
interface TemplateParams {
  programName?: string;
  programNameAr?: string;
  contentName?: string;
  contentNameAr?: string;
  trackName?: string;
  trackNameAr?: string;
  days?: number;
  count?: number;
  packageName?: string;
  packageNameAr?: string;
  [key: string]: unknown;
}

/**
 * Notification template interface
 */
interface NotificationTemplate {
  type: NotificationType;
  icon?: string;
  title: string;
  message: string;
}

/**
 * Get notification template
 */
export const getNotificationTemplate = (
  templateName: string,
  params: TemplateParams = {}
): NotificationData | null => {
  const templates: Record<string, (params: TemplateParams) => NotificationTemplate> = {
    programCompleted: (params) => ({
      type: 'achievement',
      icon: '🎉',
      title: 'مبروك!',
      message: `أكملت برنامج ${params.programNameAr || params.programName || 'التأمل'} بنجاح!`,
    }),

    trackCompleted: (params) => ({
      type: 'achievement',
      icon: '✨',
      title: 'إنجاز جديد',
      message: `أكملت جلسة ${params.trackNameAr || params.trackName || 'التأمل'}`,
    }),

    newTrack: (params) => ({
      type: 'new_content',
      icon: '🆕',
      title: 'محتوى جديد',
      message: `تم إضافة جلسة جديدة: ${params.trackNameAr || params.trackName || 'استكشف الآن'}`,
    }),

    newProgram: (params) => ({
      type: 'new_content',
      icon: '🆕',
      title: 'برنامج جديد',
      message: `برنامج جديد متاح الآن: ${params.programNameAr || params.programName || 'استكشف الآن'}`,
    }),

    subscriptionExpiring: (params) => ({
      type: 'reminder',
      icon: '⏰',
      title: 'تنبيه الاشتراك',
      message: `باقتك تنتهي خلال ${params.days || 7} أيام. جدد اشتراكك للاستمتاع بالمحتوى`,
    }),

    subscriptionExpired: (_params) => ({
      type: 'subscription',
      icon: '⚠️',
      title: 'انتهى الاشتراك',
      message: 'انتهت صلاحية اشتراكك. قم بتجديد الاشتراك للوصول إلى جميع المحتويات',
    }),

    subscriptionActivated: (params) => ({
      type: 'subscription',
      icon: '✅',
      title: 'تم تفعيل الاشتراك',
      message: `تم تفعيل باقة ${params.packageNameAr || params.packageName || 'الاشتراك'} بنجاح!`,
    }),

    subscriptionRenewed: (params) => ({
      type: 'subscription',
      icon: '🔄',
      title: 'تم تجديد الاشتراك',
      message: `تم تجديد باقتك ${params.packageNameAr || params.packageName || ''} بنجاح`,
    }),

    paymentSucceeded: (_params) => ({
      type: 'subscription',
      icon: '💳',
      title: 'نجح الدفع',
      message: 'تمت معالجة الدفع بنجاح. شكراً لاشتراكك!',
    }),

    paymentFailed: (_params) => ({
      type: 'system',
      icon: '❌',
      title: 'فشل الدفع',
      message: 'فشلت عملية الدفع. الرجاء المحاولة مرة أخرى أو استخدام طريقة دفع أخرى',
    }),

    dailyReminder: (_params) => ({
      type: 'reminder',
      icon: '🧘',
      title: 'وقت التأمل',
      message: 'حان وقت جلستك اليومية. خصص بضع دقائق لراحتك الذهنية',
    }),

    weeklyProgress: (params) => ({
      type: 'achievement',
      icon: '📊',
      title: 'تقرير أسبوعي',
      message: `أكملت ${params.count || 0} جلسة هذا الأسبوع. استمر في التقدم!`,
    }),

    monthlyProgress: (params) => ({
      type: 'achievement',
      icon: '🏆',
      title: 'إنجاز شهري',
      message: `أكملت ${params.count || 0} جلسة هذا الشهر. إنجاز رائع!`,
    }),

    streakAchievement: (params) => ({
      type: 'achievement',
      icon: '🔥',
      title: 'سلسلة متواصلة',
      message: `أكملت ${params.count || 0} أيام متتالية! حافظ على هذا الإنجاز`,
    }),

    welcomeMessage: (_params) => ({
      type: 'system',
      icon: '👋',
      title: 'أهلاً بك في Naturacalm',
      message: 'ابدأ رحلتك نحو الهدوء والاسترخاء مع مكتبتنا الشاملة من التأملات',
    }),

    accountVerified: (_params) => ({
      type: 'system',
      icon: '✅',
      title: 'تم التحقق من الحساب',
      message: 'تم التحقق من حسابك بنجاح. استمتع بجميع الميزات',
    }),

    programRecommendation: (params) => ({
      type: 'new_content',
      icon: '💡',
      title: 'توصية خاصة',
      message: `بناءً على تفضيلاتك، قد يعجبك برنامج ${params.programNameAr || params.programName || 'هذا'}`,
    }),

    achievementUnlocked: (params) => ({
      type: 'achievement',
      icon: '🎖️',
      title: 'إنجاز جديد',
      message: params.message as string || 'فتحت إنجازاً جديداً!',
    }),

    customNotification: (params) => ({
      type: (params.type as NotificationType) || 'system',
      icon: params.icon as string,
      title: params.title as string || 'إشعار',
      message: params.message as string || '',
    }),
  };

  const templateFn = templates[templateName];

  if (!templateFn) {
    return null;
  }

  const template = templateFn(params);

  return {
    type: template.type,
    title: template.title,
    message: template.message,
    icon: template.icon,
    data: params,
  };
};

/**
 * Get multiple notification templates
 */
export const getNotificationTemplates = (
  templateNames: string[],
  params: TemplateParams = {}
): NotificationData[] => {
  return templateNames
    .map(name => getNotificationTemplate(name, params))
    .filter((template): template is NotificationData => template !== null);
};

/**
 * Available template names
 */
export const NOTIFICATION_TEMPLATES = {
  PROGRAM_COMPLETED: 'programCompleted',
  TRACK_COMPLETED: 'trackCompleted',
  NEW_TRACK: 'newTrack',
  NEW_PROGRAM: 'newProgram',
  SUBSCRIPTION_EXPIRING: 'subscriptionExpiring',
  SUBSCRIPTION_EXPIRED: 'subscriptionExpired',
  SUBSCRIPTION_ACTIVATED: 'subscriptionActivated',
  SUBSCRIPTION_RENEWED: 'subscriptionRenewed',
  PAYMENT_SUCCEEDED: 'paymentSucceeded',
  PAYMENT_FAILED: 'paymentFailed',
  DAILY_REMINDER: 'dailyReminder',
  WEEKLY_PROGRESS: 'weeklyProgress',
  MONTHLY_PROGRESS: 'monthlyProgress',
  STREAK_ACHIEVEMENT: 'streakAchievement',
  WELCOME_MESSAGE: 'welcomeMessage',
  ACCOUNT_VERIFIED: 'accountVerified',
  PROGRAM_RECOMMENDATION: 'programRecommendation',
  ACHIEVEMENT_UNLOCKED: 'achievementUnlocked',
  CUSTOM_NOTIFICATION: 'customNotification',
} as const;
