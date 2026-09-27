import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';

class CloudinaryUploadService {
  CloudinaryUploadService(this._config);

  final AppConfig _config;

  Future<String> pickAndUploadCredential() async {
    if (!_config.hasCloudinaryConfig) {
      throw const ApiException('Cloudinary is not configured for this build.');
    }

    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg'],
    );

    final file = picked.isEmpty ? null : picked.single;
    if (file == null) {
      throw const ApiException('No credential file selected.');
    }
    final bytes = await file.readAsBytes();

    final uri = Uri.parse(
      'https://api.cloudinary.com/v1_1/${_config.cloudinaryCloudName}/auto/upload',
    );
    final request = http.MultipartRequest('POST', uri)
      ..fields['upload_preset'] = _config.cloudinaryUploadPreset
      ..files.add(
        http.MultipartFile.fromBytes('file', bytes, filename: file.name),
      );

    final response = await request.send();
    final body = await response.stream.bytesToString();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException('Credential upload failed (${response.statusCode}).');
    }

    final json = jsonDecode(body) as Map<String, dynamic>;
    return (json['secure_url'] ?? '').toString();
  }
}

final cloudinaryUploadServiceProvider = Provider<CloudinaryUploadService>((
  ref,
) {
  return CloudinaryUploadService(ref.watch(appConfigProvider));
});
