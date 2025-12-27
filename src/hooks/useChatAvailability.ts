import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChatSettings {
  is_enabled: boolean;
  auto_offline_message: string;
  timezone: string;
  manual_override: 'online' | 'offline' | null;
}

interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface ChatAvailability {
  status: 'online' | 'offline';
  message: string;
  isLoading: boolean;
  settings: ChatSettings | null;
  refetch: () => Promise<void>;
}

export const useChatAvailability = (): ChatAvailability => {
  const [status, setStatus] = useState<'online' | 'offline'>('offline');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<ChatSettings | null>(null);

  const checkAvailability = async () => {
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('chat_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsError) {
        console.error('Error fetching chat settings:', settingsError);
        setStatus('offline');
        setMessage('Chat indisponível no momento.');
        return;
      }

      const chatSettings: ChatSettings = {
        is_enabled: settingsData.is_enabled,
        auto_offline_message: settingsData.auto_offline_message || 'Chat offline.',
        timezone: settingsData.timezone || 'America/Sao_Paulo',
        manual_override: settingsData.manual_override as 'online' | 'offline' | null,
      };

      setSettings(chatSettings);

      // Check if chat is globally disabled
      if (!chatSettings.is_enabled) {
        setStatus('offline');
        setMessage(chatSettings.auto_offline_message);
        return;
      }

      // Check manual override
      if (chatSettings.manual_override === 'online') {
        setStatus('online');
        setMessage('');
        return;
      }

      if (chatSettings.manual_override === 'offline') {
        setStatus('offline');
        setMessage(chatSettings.auto_offline_message);
        return;
      }

      // Fetch working hours
      const { data: hoursData, error: hoursError } = await supabase
        .from('chat_working_hours')
        .select('*')
        .order('day_of_week');

      if (hoursError) {
        console.error('Error fetching working hours:', hoursError);
        setStatus('offline');
        setMessage(chatSettings.auto_offline_message);
        return;
      }

      // Get current time in the configured timezone
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: chatSettings.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };
      
      const timeFormatter = new Intl.DateTimeFormat('en-US', options);
      const currentTime = timeFormatter.format(now);
      
      const dayOptions: Intl.DateTimeFormatOptions = {
        timeZone: chatSettings.timezone,
        weekday: 'long',
      };
      const dayFormatter = new Intl.DateTimeFormat('en-US', dayOptions);
      const currentDay = dayFormatter.format(now);
      
      // Map day name to number
      const dayMap: Record<string, number> = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
      };
      
      const currentDayNumber = dayMap[currentDay];

      // Find today's schedule
      const todaySchedule = hoursData?.find(
        (h: WorkingHour) => h.day_of_week === currentDayNumber
      );

      if (!todaySchedule || !todaySchedule.is_active) {
        setStatus('offline');
        setMessage(chatSettings.auto_offline_message);
        return;
      }

      // Compare times
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const [startHour, startMinute] = todaySchedule.start_time.split(':').map(Number);
      const [endHour, endMinute] = todaySchedule.end_time.split(':').map(Number);

      const currentMinutes = currentHour * 60 + currentMinute;
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        setStatus('online');
        setMessage('');
      } else {
        setStatus('offline');
        setMessage(chatSettings.auto_offline_message);
      }
    } catch (error) {
      console.error('Error checking chat availability:', error);
      setStatus('offline');
      setMessage('Chat indisponível no momento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAvailability();

    // Refresh every minute to keep status updated
    const interval = setInterval(checkAvailability, 60000);

    return () => clearInterval(interval);
  }, []);

  return {
    status,
    message,
    isLoading,
    settings,
    refetch: checkAvailability,
  };
};
