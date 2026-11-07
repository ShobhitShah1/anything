import { useEffect, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import mobileAds, {
  AdsConsent,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
  useNativeAd,
} from 'react-native-google-mobile-ads';
import type { Palette } from '../theme';

export function CollectionAd({ colors }: { colors: Palette }) {
  const extra = Constants.expoConfig?.extra;
  const enabled = extra?.admobEnabled === true;
  const testMode = extra?.admobTestMode === true;
  const adUnitId = testMode
    ? TestIds.NATIVE
    : Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID;
  const [consentReady, setConsentReady] = useState(false);

  useEffect(() => {
    let active = true;
    const prepareAds = async () => {
      try {
        await AdsConsent.gatherConsent();
      } catch {
        // The UMP SDK may still have usable consent saved from its previous session.
      }
      try {
        if (!(await AdsConsent.getConsentInfo()).canRequestAds) return;
        await mobileAds().initialize();
        if (active) setConsentReady(true);
      } catch {
        // Ads remain absent when consent or the native ads SDK is unavailable.
      }
    };
    if (enabled && adUnitId) void prepareAds();
    return () => {
      active = false;
    };
  }, [enabled, adUnitId]);

  if (!enabled || !adUnitId) return null;
  return <LoadedCollectionAd adUnitId={adUnitId} consentReady={consentReady} colors={colors} />;
}

function LoadedCollectionAd({
  adUnitId,
  consentReady,
  colors,
}: {
  adUnitId: string;
  consentReady: boolean;
  colors: Palette;
}) {
  const { nativeAd } = useNativeAd({ adUnitId, autoLoad: consentReady });
  if (!nativeAd) return null;

  return (
    <View style={{ paddingTop: 28, paddingBottom: 16 }}>
      <NativeAdView
        nativeAd={nativeAd}
        style={{
          overflow: 'hidden',
          borderRadius: 18,
          backgroundColor: colors.paper,
        }}
      >
        <NativeMediaView style={{ width: '100%', height: 168 }} />
        <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 }}>
          <Text
            allowFontScaling={false}
            style={{ color: colors.muted, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 }}
          >
            SPONSORED
          </Text>
          {nativeAd.icon?.url && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={{ width: 34, height: 34, borderRadius: 9, marginBottom: 9 }}
              />
            </NativeAsset>
          )}
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}
            >
              {nativeAd.headline}
            </Text>
          </NativeAsset>
          {nativeAd.body && (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text
                allowFontScaling={false}
                numberOfLines={3}
                style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}
              >
                {nativeAd.body}
              </Text>
            </NativeAsset>
          )}
          {nativeAd.advertiser && (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}
              >
                {nativeAd.advertiser}
              </Text>
            </NativeAsset>
          )}
          {nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Text
                allowFontScaling={false}
                style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 12 }}
              >
                {nativeAd.callToAction} ↗
              </Text>
            </NativeAsset>
          )}
        </View>
      </NativeAdView>
    </View>
  );
}
