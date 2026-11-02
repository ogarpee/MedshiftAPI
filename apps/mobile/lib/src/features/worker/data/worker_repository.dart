import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../onboarding/data/onboarding_draft_store.dart';

class WorkerRepository {
  WorkerRepository(this._dio);

  final Dio _dio;

  Future<String> currentUserId() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/me');
    final userId = (response.data?['sub'] ?? response.data?['id'] ?? '')
        .toString();
    if (userId.isEmpty) {
      throw const ApiException(
        'Your session could not be identified. Sign in again.',
      );
    }
    return userId;
  }

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
      final data = response.data;
      if (data == null || data.isEmpty) return null;
      final profile = WorkerProfile.fromJson(data);
      return profile.id.isEmpty ? null : profile;
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  Future<WorkerProfile> saveProfile({
    required WorkerOnboardingDraft draft,
  }) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/worker-profiles/me',
      data: draft.toApiPayload(),
    );
    return WorkerProfile.fromJson(response.data ?? {});
  }

  Future<ServerWorkerOnboardingDraft?> onboardingDraft() async {
    final response = await _dio.get<dynamic>(
      '/worker-profiles/onboarding-draft',
    );
    final data = response.data;
    if (data == null || (data is String && data.trim().isEmpty)) return null;
    if (data is! Map) {
      throw const ApiException(
        'The saved onboarding draft response was invalid. Please retry.',
      );
    }
    return ServerWorkerOnboardingDraft.fromJson(
      Map<String, dynamic>.from(data),
    );
  }

  Future<void> saveOnboardingDraft({
    required WorkerOnboardingDraft draft,
    required int currentStep,
  }) async {
    await _dio.put<void>(
      '/worker-profiles/onboarding-draft',
      data: {'currentStep': currentStep, 'data': draft.toApiPayload()},
    );
  }

  Future<void> clearOnboardingDraft() async {
    await _dio.delete<void>('/worker-profiles/onboarding-draft');
  }
}

class ServerWorkerOnboardingDraft {
  const ServerWorkerOnboardingDraft({
    required this.draft,
    required this.currentStep,
    this.profileId,
  });

  final WorkerOnboardingDraft draft;
  final int currentStep;
  final String? profileId;

  factory ServerWorkerOnboardingDraft.fromJson(Map<String, dynamic> json) {
    return ServerWorkerOnboardingDraft(
      draft: WorkerOnboardingDraft.fromApiPayload(
        Map<String, dynamic>.from(json['data'] as Map? ?? const {}),
      ),
      currentStep: _intValue(json['currentStep']).clamp(0, 4),
      profileId: json['profileId']?.toString(),
    );
  }
}

int _intValue(dynamic value) {
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

final workerRepositoryProvider = Provider<WorkerRepository>((ref) {
  return WorkerRepository(ref.watch(dioProvider));
});

class WorkerProfileSnapshot {
  const WorkerProfileSnapshot({
    this.profile,
    this.onboarding,
    this.profileError,
    this.onboardingError,
  });

  final WorkerProfile? profile;
  final OnboardingState? onboarding;
  final String? profileError;
  final String? onboardingError;

  bool get hasError => profileError != null || onboardingError != null;
}

final workerProfileSnapshotProvider =
    FutureProvider.autoDispose<WorkerProfileSnapshot>((ref) async {
      final repository = ref.watch(workerRepositoryProvider);
      WorkerProfile? profile;
      OnboardingState? onboarding;
      String? profileError;
      String? onboardingError;

      try {
        profile = await repository.profile();
      } catch (error) {
        profileError = apiErrorMessage(
          error,
          'Your worker profile could not be loaded.',
        );
      }
      try {
        onboarding = await repository.onboardingStatus();
      } catch (error) {
        onboardingError = apiErrorMessage(
          error,
          'Onboarding status could not be loaded.',
        );
      }
      if (profileError != null && onboardingError != null) {
        throw ApiException(profileError);
      }
      return WorkerProfileSnapshot(
        profile: profile,
        onboarding: onboarding,
        profileError: profileError,
        onboardingError: onboardingError,
      );
    });
