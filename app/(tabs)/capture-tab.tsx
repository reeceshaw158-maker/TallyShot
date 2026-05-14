// This file exists only so expo-router registers the route for the FAB tab button.
// The tab button is overridden to push /capture instead of navigating here.
import { useEffect } from 'react';
import { router } from 'expo-router';

export default function CaptureTab() {
  useEffect(() => { router.replace('/capture'); }, []);
  return null;
}
