import { requireOptionalNativeModule } from 'expo';

export default requireOptionalNativeModule<{ hide(reducedMotion: boolean): Promise<void> }>(
  'AnythingLaunch',
);
