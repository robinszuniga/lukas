import { useSyncExternalStore } from 'react'
import { getNotificationsOn, getPrefs, prefsVersion, subscribePrefs, type Preferences } from '@/lib/prefs'

let cachedVersion = -1
let cached: Preferences & { notificationsOn: boolean }

function snapshot() {
  const v = prefsVersion()
  if (v !== cachedVersion) {
    cached = { ...getPrefs(), notificationsOn: getNotificationsOn() }
    cachedVersion = v
  }
  return cached
}

/** Preferencias actuales; el componente se vuelve a dibujar cuando cambian. */
export function usePrefs() {
  return useSyncExternalStore(subscribePrefs, snapshot, snapshot)
}
