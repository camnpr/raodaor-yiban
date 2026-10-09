import { View, StyleSheet } from 'react-native';
import QRCode from 'react-qr-code';
import { radius, spacing } from '../../design/tokens';

interface QrCodeProps {
  /** 二维码编码内容（通常为分享链接） */
  value: string;
  /** 边长（物理像素，默认 220，长辈场景建议偏大） */
  size?: number;
}

/**
 * 纯展示型二维码（基于 react-qr-code，纯 SVG、零依赖，Web / Native 通用）。
 * 白底黑码，保证对比度可被相机扫描。
 */
export function QrCode({ value, size = 220 }: QrCodeProps) {
  return (
    <View
      style={[
        styles.card,
        { width: size + spacing.lg * 2, height: size + spacing.lg * 2, padding: spacing.lg },
      ]}
    >
      <QRCode value={value} size={size} bgColor="white" fgColor="black" level="M" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: 'white',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
