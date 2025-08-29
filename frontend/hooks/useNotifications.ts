import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  appointmentId?: string;
  type?: string;
  [key: string]: any;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: NotificationData;
  date: Date;
}

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const notificationListener = useRef<Notifications.Subscription>(null);
  const responseListener = useRef<Notifications.Subscription>(null);
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Save token to storage for API calls
        AsyncStorage.setItem('pushToken', token);
      }
    });

    // Listener for notifications received while app is running
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const newNotification: PushNotification = {
        id: notification.request.identifier,
        title: notification.request.content.title || 'Nueva notificación',
        body: notification.request.content.body || '',
        data: notification.request.content.data as NotificationData,
        date: new Date(),
      };
      
      setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Keep last 50
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as NotificationData;
      console.log('Notification tapped:', data);
      
      // Handle navigation based on notification type
      if (data?.appointmentId) {
        // Navigate to appointment details
        console.log('Navigate to appointment:', data.appointmentId);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const sendLocalNotification = async (title: string, body: string, data?: NotificationData) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
  };

  const scheduledNotification = async (
    title: string, 
    body: string, 
    trigger: Date,
    data?: NotificationData
  ) => {
    // Expo Notifications espera un objeto NotificationTriggerInput, no un Date directamente
    // Expo Notifications espera un objeto NotificationTriggerInput, por ejemplo { seconds: number }
    const seconds = Math.max(1, Math.floor((trigger.getTime() - Date.now()) / 1000));
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: { seconds, repeats: false, type: SchedulableTriggerInputTypes.TIME_INTERVAL },
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const requestPermissions = async () => {
    return await registerForPushNotificationsAsync();
  };

  return {
    expoPushToken,
    notifications,
    sendLocalNotification,
    scheduledNotification,
    clearNotifications,
    requestPermissions,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4AF37',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
      
      console.log('Push token:', token);
    } catch (e) {
      console.log('Error getting push token:', e);
      token = null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}