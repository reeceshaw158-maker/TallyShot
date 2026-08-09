import { Redirect } from 'expo-router';
import { useAppStore } from '../src/stores/appStore';

export default function Root() {
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  const trustScreensSeen       = useAppStore((s) => s.trustScreensSeen);

  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;
  if (!trustScreensSeen)       return <Redirect href={'/trust' as any} />;
  return <Redirect href="/(tabs)" />;
}
