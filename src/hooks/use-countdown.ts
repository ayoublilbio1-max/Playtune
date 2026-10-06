import { useEffect, useState } from "react";

import { markSleepTimerDone, useSleep } from "../store/sleep";

/** Milliseconds left on the sleep timer, updated every second (null when no timer). */
export function useSleepCountdown(): number | null {
  const active = useSleep((s) => s.active);
  const endsAt = useSleep((s) => s.endsAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) markSleepTimerDone();
    }, 1000);
    return () => clearInterval(id);
  }, [active, endsAt]);

  if (!active) return null;
  return Math.max(0, endsAt - now);
}
