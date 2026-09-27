import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../onboarding/data/onboarding_draft_store.dart';

class WorkerRepository {
  WorkerRepository(this._dio);

  final Dio _dio;

  Future<OnboardingState> onboardingStatus() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/worker-profiles/onboarding-status',
    );
    return OnboardingState.fromJson(response.data ?? {});
  }

  Future<WorkerProfile?> profile() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/worker-profiles/me',
      );
      return WorkerProfile.fromJson(response.data ?? {});
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  Future<WorkerProfile> saveProfile({
    required WorkerOnboardingDraft draft,
    String? profileId,
  }) async {
    final response = profileId == null || profileId.isEmpty
        ? await _dio.post<Map<String, dynamic>>(
            '/worker-profiles',
            data: draft.toApiPayload(),
          )
        : await _dio.patch<Map<String, dynamic>>(
            '/worker-profiles/$profileId',
            data: draft.toApiPayload(),
          );
    return WorkerProfile.fromJson(response.data ?? {});
  }
}

final workerRepositoryProvider = Provider<WorkerRepository>((ref) {
  return WorkerRepository(ref.watch(dioProvider));
});
