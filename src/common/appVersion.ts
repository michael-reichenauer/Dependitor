import axios from "axios";
import { useEffect, useRef } from "react";
import { useActivity } from "./activity";
import { Time } from "../utils/time";

const checkRemoteInterval = 30 * Time.minute;
const retryFailedRemoteInterval = 5 * Time.minute;

export const startTime = dateToLocalISO(new Date().toISOString());
export const localSha =
  process.env.REACT_APP_SHA === "%REACT_APP_SHA%"
    ? "000000"
    : process.env.REACT_APP_SHA ?? "000000";
export const localShortSha =
  process.env.REACT_APP_SHA === "%REACT_APP_SHA%"
    ? "000000"
    : process.env.REACT_APP_SHA?.substring(0, 6);
export const localBuildTime =
  process.env.REACT_APP_BUILD_TIME === "%REACT_APP_BUILD_TIME%"
    ? startTime
    : // @ts-ignore
      dateToLocalISO(process.env.REACT_APP_BUILD_TIME);

// Monitors server version of the web site and if newer, triggers a force reload to ensure latest web is shown,
export const useAppVersionMonitor = () => {
  const [isActive] = useActivity();
  const timerRef = useRef<any>();
  const isRunning = useRef(false);

  useEffect(() => {
    clearTimeout(timerRef.current);
    const getRemoteVersion = async () => {
      if (!isActive || !isRunning.current) {
        isRunning.current = false;
        clearTimeout(timerRef.current);
        return;
      }

      const remoteUrl = window.location.href;
      try {
        console.info(
          `Local version:  '${localSha.substring(0, 6)}' '${localBuildTime}'`
        );
        // console.log(`Checking remote, active=${isActive} ...`)
        const manifest = (
          await axios.get("/manifest.json", { timeout: 20 * Time.second })
        ).data;

        const remoteSha =
          manifest.sha === "%REACT_APP_SHA%" ? localSha : manifest.sha;
        const remoteBuildTime =
          manifest.buildTime === "%REACT_APP_BUILD_TIME%"
            ? localBuildTime
            : dateToLocalISO(manifest.buildTime);

        console.info(
          `Remote version: '${remoteSha.substring(
            0,
            6
          )}' '${remoteBuildTime}' at ${remoteUrl}`
        );

        if (localSha !== remoteSha) {
          console.info("Remote version differs, reloading ...");
          window.location.reload();
        }
        if (!isRunning.current) {
          timerRef.current = setTimeout(getRemoteVersion, checkRemoteInterval);
        }
      } catch (err) {
        console.error("Failed get remote manifest:", err, remoteUrl);
        if (!isRunning.current) {
          timerRef.current = setTimeout(
            getRemoteVersion,
            retryFailedRemoteInterval
          );
        }
      }
    };
    isRunning.current = true;
    getRemoteVersion();

    return () => {
      isRunning.current = false;
      clearTimeout(timerRef.current);
    };
  }, [isActive, timerRef, isRunning]);
};

function dateToLocalISO(dateText: string) {
  const date = new Date(dateText);
  const off = date.getTimezoneOffset();
  const absOffset = Math.abs(off);
  return (
    new Date(date.getTime() - off * Time.minute).toISOString().substr(0, 23) +
    (off > 0 ? "-" : "+") +
    (absOffset / 60).toFixed(0).padStart(2, "0") +
    ":" +
    (absOffset % 60).toString().padStart(2, "0")
  );
}
