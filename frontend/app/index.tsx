import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getToken } from '@/src/api';
import { colors } from '@/src/theme';
import { AuroraBackground } from '@/src/ui';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) router.replace('/(tabs)/home');
      else router.replace('/onboarding');
    })();
  }, []);
  return (
    <View style={styles.container}>
      <AuroraBackground />
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
