const humanizeDuration = require("humanize-duration");

export class Time {
  public static second = 1000;
  public static minute = 60 * Time.second;
  public static hour = 60 * Time.minute;
  public static day = 24 * Time.hour;
}

// Returns a duration as a nice human readable string.
export const durationString = (duration: number): string => {
  return humanizeDuration(duration);
};

// Async sleep/delay
export async function delay(
  time: number,
  ac?: AbortController
): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), time);
    ac?.signal.addEventListener("abort", () => resolve(false));
  });
}

// currentTimeAdd returns a time in the future (or past), e.g. currentTimeAdd(10*minute)
export function currentTimeAdd(timeToAdd: number): Date {
  return timeAdd(new Date(), timeToAdd);
}

// timeAdd returns a time relative to the specified date timeAdd(someDate, 15 *second)
export function timeAdd(time: Date, timeToAdd: number): Date {
  return new Date(time.getTime() + timeToAdd);
}
