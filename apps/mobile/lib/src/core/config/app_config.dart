import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';

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

  String? get apiConfigurationError {
    final trimmedUrl = apiBaseUrl.trim();
    if (trimmedUrl.isEmpty) {
      return 'MEDSHIFT_API_URL is required for this build.';
    }

    final uri = Uri.tryParse(trimmedUrl);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return 'MEDSHIFT_API_URL must be a valid absolute URL.';
    }

    final host = uri.host.toLowerCase();
    if (!kIsWeb &&
        (host == 'localhost' || host == '127.0.0.1' || host == '::1')) {
      return 'MEDSHIFT_API_URL cannot point to localhost on device builds.';
    }

    return null;
  }

  bool get hasValidApiBaseUrl => apiConfigurationError == null;

  bool get hasCloudinaryConfig =>
      cloudinaryCloudName.isNotEmpty && cloudinaryUploadPreset.isNotEmpty;

  bool get hasMapboxToken => mapboxAccessToken.isNotEmpty;
}

final appConfigProvider = Provider<AppConfig>((ref) {
  return const AppConfig(
    apiBaseUrl: String.fromEnvironment('MEDSHIFT_API_URL', defaultValue: ''),
    cloudinaryCloudName: String.fromEnvironment('CLOUDINARY_CLOUD_NAME'),
    cloudinaryUploadPreset: String.fromEnvironment('CLOUDINARY_UPLOAD_PRESET'),
    mapboxAccessToken: String.fromEnvironment('MAPBOX_ACCESS_TOKEN'),
  );
});
