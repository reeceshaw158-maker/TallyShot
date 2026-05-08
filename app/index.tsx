import { Redirect } from 'expo-router';
import { useAppStore } from '../src/stores/appStore';

export default function Root() {
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  return <Redirect href={hasCompletedOnboarding ? '/(tabs)' : '/onboarding'} />;
}
