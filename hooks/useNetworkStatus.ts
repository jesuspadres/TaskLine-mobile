import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '@/stores/offlineStore';

export function useNetworkStatus() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const setOnline = useOfflineStore((s) => s.setOnline);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      setOnline(connected);
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      setOnline(connected);
    });

    return unsubscribe;
  }, [setOnline]);

  return { isOnline };
}
