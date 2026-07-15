import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'rescan-reminders';
const REMINDER_STORAGE_KEY = 'visionqc:rescan-reminders';
let reminderNotificationsInitialized = false;

// Metadata saved beside Expo's notification id so the Reminders screen can show a useful list.
export type ScheduledRescanReminder = {
  alias: string;
  notificationId: string;
  daysUntilReminder: number;
  dueAt: string;
  scheduledAt: string;
  disease?: string | null;
  location?: string | null;
  reason?: string | null;
};

type ReminderRegistry = Record<string, ScheduledRescanReminder>;

type ScheduleReminderInput = {
  alias: string;
  daysUntilReminder: number;
  disease?: string | null;
  location?: string | null;
  reason?: string | null;
};

// Controls how notifications behave when they arrive while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Read the local reminder registry. The string branch keeps older saved reminders from breaking after schema changes.
async function readRegistry(): Promise<ReminderRegistry> {
  const raw = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce<ReminderRegistry>((registry, [aliasKey, value]) => {
      if (typeof value === 'string') {
        registry[aliasKey] = {
          alias: aliasKey,
          notificationId: value,
          daysUntilReminder: 0,
          dueAt: '',
          scheduledAt: '',
        };
        return registry;
      }

      if (value && typeof value === 'object') {
        const reminder = value as Partial<ScheduledRescanReminder>;
        if (typeof reminder.notificationId === 'string') {
          registry[aliasKey] = {
            alias: reminder.alias || aliasKey,
            notificationId: reminder.notificationId,
            daysUntilReminder: Number(reminder.daysUntilReminder) || 0,
            dueAt: reminder.dueAt || '',
            scheduledAt: reminder.scheduledAt || '',
            disease: reminder.disease || '',
            location: reminder.location || '',
            reason: reminder.reason || '',
          };
        }
      }

      return registry;
    }, {});
  } catch {
    return {};
  }
}

async function writeRegistry(registry: ReminderRegistry) {
  await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(registry));
}

// One active reminder is kept per alias, so a new scan replaces the old follow-up for that plant.
function getAliasKey(alias: string): string {
  return alias.trim().toLowerCase();
}

function buildReminderBody(alias: string, daysUntilReminder: number): string {
  const dayLabel = `${daysUntilReminder} day${daysUntilReminder === 1 ? '' : 's'}`;
  return `It's time to re-scan ${alias}. This follow-up is due ${dayLabel} after treatment begins.`;
}

export async function initializeReminderNotifications() {
  if (Platform.OS !== 'android' || reminderNotificationsInitialized) return;

  // Android requires a channel before scheduled notifications can use channel-specific behavior.
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Re-scan reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0d4d3d',
  });

  reminderNotificationsInitialized = true;
}

export async function scheduleRescanReminder(input: ScheduleReminderInput): Promise<boolean> {
  const alias = input.alias.trim();
  const daysUntilReminder = Math.max(1, Math.round(input.daysUntilReminder));
  if (!alias) return false;

  // Local notifications need device permission; returning false lets the UI show a non-fatal message.
  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  await initializeReminderNotifications();

  const aliasKey = getAliasKey(alias);
  const registry = await readRegistry();
  const existingNotificationId = registry[aliasKey]?.notificationId;

  if (existingNotificationId) {
    // Replace the previous scheduled notification for this alias instead of stacking duplicates.
    await Notifications.cancelScheduledNotificationAsync(existingNotificationId);
  }

  // Follow-up reminders are scheduled for 10 AM on the due date to avoid surprising late-night alerts.
  const triggerDate = new Date();
  triggerDate.setDate(triggerDate.getDate() + daysUntilReminder);
  triggerDate.setHours(10, 0, 0, 0);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Re-scan reminder for ${alias}`,
      body: buildReminderBody(alias, daysUntilReminder),
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
    },
  });

  // Save display metadata separately because Expo only returns the notification id.
  registry[aliasKey] = {
    alias,
    notificationId,
    daysUntilReminder,
    dueAt: triggerDate.toISOString(),
    scheduledAt: new Date().toISOString(),
    disease: input.disease || '',
    location: input.location || '',
    reason: input.reason || '',
  };
  await writeRegistry(registry);
  return true;
}

// Return reminders sorted by soonest due date for the dedicated Reminders screen.
export async function getScheduledRescanReminders(): Promise<ScheduledRescanReminder[]> {
  const registry = await readRegistry();

  return Object.values(registry).sort((left, right) => {
    const leftTime = new Date(left.dueAt).getTime();
    const rightTime = new Date(right.dueAt).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;

    return leftTime - rightTime;
  });
}
