import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';

class CloudinaryUploadService {
  CloudinaryUploadService(this._dio);

  final Dio _dio;

  Future<WorkerDocument> pickAndUploadDocument(
    WorkerDocumentCategory category, {
    void Function(int progress)? onProgress,
  }) async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
    );
    final file = picked.isEmpty ? null : picked.single;
    if (file == null) throw const ApiException('No document selected.');
    final bytes = await file.xFile.readAsBytes();
    if (bytes.length > 10 * 1024 * 1024) {
      throw const ApiException('Choose a document under 10 MB.');
    }
    final mimeType = _mimeType(file.extension);
    final signedResponse = await _dio.post<Map<String, dynamic>>(
      '/uploads/worker-documents/sign',
      data: {
        'category': workerDocumentCategoryToApi(category),
        'fileName': file.name,
        'mimeType': mimeType,
        'sizeBytes': bytes.length,
      },
    );
    final signed = signedResponse.data ?? const <String, dynamic>{};
    final uploadResponse = await Dio().post<Map<String, dynamic>>(
      signed['uploadUrl'].toString(),
      data: FormData.fromMap({
        'file': MultipartFile.fromBytes(
          bytes,
          filename: file.name,
          contentType: DioMediaType.parse(mimeType),
        ),
        'api_key': signed['apiKey'],
        'timestamp': signed['timestamp'].toString(),
        'signature': signed['signature'],
        'folder': signed['folder'],
        'public_id': signed['uploadPublicId'],
        'type': signed['deliveryType'],
      }),
      onSendProgress: (sent, total) {
        if (total > 0) onProgress?.call((sent * 100 / total).round());
      },
    );
    final uploaded = uploadResponse.data ?? const <String, dynamic>{};
    final completedResponse = await _dio.post<Map<String, dynamic>>(
      '/uploads/worker-documents/complete',
      data: {
        'category': workerDocumentCategoryToApi(category),
        'publicId': uploaded['public_id'],
        'resourceType': uploaded['resource_type'],
        'deliveryType': uploaded['type'],
        'version': uploaded['version'],
        'format': uploaded['format'],
        'bytes': uploaded['bytes'],
        'originalFilename': uploaded['original_filename'] ?? file.name,
        'signature': uploaded['signature'],
      },
    );
    return WorkerDocument.fromJson(completedResponse.data ?? const {});
  }
}

String _mimeType(String? extension) => switch (extension?.toLowerCase()) {
  'pdf' => 'application/pdf',
  'png' => 'image/png',
  'webp' => 'image/webp',
  _ => 'image/jpeg',
};

final cloudinaryUploadServiceProvider = Provider<CloudinaryUploadService>((
  ref,
) {
  return CloudinaryUploadService(ref.watch(dioProvider));
});
