import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const padTimeUnit = (value: number): string => value.toString().padStart(2, '0');

const parseTimeParts = (time: string): { hours: number; minutes: number; seconds: number } => {
  const [hourStr, minuteStr, secondStr] = time.split(':');
  const hours = Number.parseInt(hourStr ?? '0', 10);
  const minutes = Number.parseInt(minuteStr ?? '0', 10);
  const seconds = Number.parseInt(secondStr ?? '0', 10);

  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
    seconds: Number.isFinite(seconds) ? seconds : 0,
  };
};

const toUtcDate = (time: string): Date => {
  const { hours, minutes, seconds } = parseTimeParts(time);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds, 0));
};

export const normalizeLocalTimeInput = (time: string): string => {
  const { hours, minutes, seconds } = parseTimeParts(time);
  const hasSeconds = time.split(':').length === 3;
  if (hasSeconds) {
    return `${padTimeUnit(hours)}:${padTimeUnit(minutes)}:${padTimeUnit(seconds)}`;
  }
  return `${padTimeUnit(hours)}:${padTimeUnit(minutes)}`;
};

export const parseScheduledTime = (time: string): Dayjs => {
  const normalized = normalizeLocalTimeInput(time);
  const { hours, minutes, seconds } = parseTimeParts(normalized);

  return dayjs().hour(hours).minute(minutes).second(seconds).millisecond(0);
};

export const formatLocalTime = (time: string): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(toUtcDate(time));
};

export const formatRelativeTime = (date: string | Date): string => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - targetDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  }

  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  if (diffDays === 1) {
    return 'yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== targetDate.getFullYear() ? 'numeric' : undefined,
  }).format(targetDate);
};

export const formatFullTimestamp = (date: string | Date): string => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(targetDate);
};
