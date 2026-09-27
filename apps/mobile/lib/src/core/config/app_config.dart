import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.cloudinaryCloudName,
    required this.cloudinaryUploadPreset,
    required this.mapboxAccessToken,
  });

  final String apiBaseUrl;
  final String cloudinaryCloudName;
  final String cloudinaryUploadPreset;
  final String mapboxAccessToken;

  bool get hasCloudinaryConfig =>
      cloudinaryCloudName.isNotEmpty && cloudinaryUploadPreset.isNotEmpty;

  bool get hasMapboxToken => mapboxAccessToken.isNotEmpty;
}

final appConfigProvider = Provider<AppConfig>((ref) {
  return const AppConfig(
    apiBaseUrl: String.fromEnvironment(
      'MEDSHIFT_API_URL',
      defaultValue: 'http://localhost:4000',
    ),
    cloudinaryCloudName: String.fromEnvironment('CLOUDINARY_CLOUD_NAME'),
    cloudinaryUploadPreset: String.fromEnvironment('CLOUDINARY_UPLOAD_PRESET'),
    mapboxAccessToken: String.fromEnvironment('MAPBOX_ACCESS_TOKEN'),
  );
});
