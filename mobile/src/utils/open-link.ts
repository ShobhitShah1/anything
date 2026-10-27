import { openBrowserAsync } from 'expo-web-browser';
import { safeLink } from './native-data';

export async function openLink(value: string) {
  return openBrowserAsync(safeLink(value), {
    createTask: false,
    showInRecents: false,
    showTitle: true,
    dismissButtonStyle: 'close',
  });
}
