import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/models/medshift_models.dart';

class WorkerOnboardingDraft {
  const WorkerOnboardingDraft({
    this.firstName = '',
    this.lastName = '',
    this.title = ClinicalRole.hca,
    this.latitude = 51.0447,
    this.longitude = -114.0719,
    this.maxDistanceKm = 25,
    this.availableDays = const ['MONDAY', 'TUESDAY', 'WEDNESDAY'],
    this.preferredShiftTypes = const ['DAY'],
    this.credentialType = 'HCA certificate',
    this.credentialUrl = '',
    this.backgroundConsent = false,
  });

  final String firstName;
  final String lastName;
  final ClinicalRole title;
  final double latitude;
  final double longitude;
  final double maxDistanceKm;
  final List<String> availableDays;
  final List<String> preferredShiftTypes;
  final String credentialType;
  final String credentialUrl;
  final bool backgroundConsent;

  WorkerOnboardingDraft copyWith({
    String? firstName,
    String? lastName,
    ClinicalRole? title,
    double? latitude,
    double? longitude,
    double? maxDistanceKm,
    List<String>? availableDays,
    List<String>? preferredShiftTypes,
    String? credentialType,
    String? credentialUrl,
    bool? backgroundConsent,
  }) {
    return WorkerOnboardingDraft(
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      title: title ?? this.title,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      maxDistanceKm: maxDistanceKm ?? this.maxDistanceKm,
      availableDays: availableDays ?? this.availableDays,
      preferredShiftTypes: preferredShiftTypes ?? this.preferredShiftTypes,
      credentialType: credentialType ?? this.credentialType,
      credentialUrl: credentialUrl ?? this.credentialUrl,
      backgroundConsent: backgroundConsent ?? this.backgroundConsent,
    );
  }

  factory WorkerOnboardingDraft.fromProfile(WorkerProfile profile) {
    return WorkerOnboardingDraft(
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.title,
      latitude: profile.location.latitude,
      longitude: profile.location.longitude,
      maxDistanceKm: profile.maxDistanceKm,
      availableDays: profile.availableDays.isEmpty
          ? const ['MONDAY', 'TUESDAY', 'WEDNESDAY']
          : profile.availableDays,
      preferredShiftTypes: profile.preferredShiftTypes.isEmpty
          ? const ['DAY']
          : profile.preferredShiftTypes,
      credentialType: profile.credentialType,
      credentialUrl: profile.credentialUrl,
      backgroundConsent: profile.backgroundConsent,
    );
  }

  factory WorkerOnboardingDraft.fromJson(Map<String, dynamic> json) {
    return WorkerOnboardingDraft(
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      title: clinicalRoleFromApi(json['title']?.toString()),
      latitude: ((json['latitude'] ?? 51.0447) as num).toDouble(),
      longitude: ((json['longitude'] ?? -114.0719) as num).toDouble(),
      maxDistanceKm: ((json['maxDistanceKm'] ?? 25) as num).toDouble(),
      availableDays: List<String>.from(json['availableDays'] ?? const []),
      preferredShiftTypes: List<String>.from(
        json['preferredShiftTypes'] ?? const [],
      ),
      credentialType: (json['credentialType'] ?? 'HCA certificate').toString(),
      credentialUrl: (json['credentialUrl'] ?? '').toString(),
      backgroundConsent: json['backgroundConsent'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
    'firstName': firstName,
    'lastName': lastName,
    'title': clinicalRoleToApi(title),
    'latitude': latitude,
    'longitude': longitude,
    'maxDistanceKm': maxDistanceKm,
    'availableDays': availableDays,
    'preferredShiftTypes': preferredShiftTypes,
    'credentialType': credentialType,
    'credentialUrl': credentialUrl,
    'backgroundConsent': backgroundConsent,
  };

  Map<String, dynamic> toApiPayload() => {
    'firstName': firstName.trim(),
    'lastName': lastName.trim(),
    'title': clinicalRoleToApi(title),
    'credentials': [
      {'type': credentialType.trim(), 'documentUrl': credentialUrl.trim()},
    ],
    'backgroundCheck': {
      'consentedAt': backgroundConsent
          ? DateTime.now().toIso8601String()
          : null,
    },
    'location': GeoPoint(longitude: longitude, latitude: latitude).toJson(),
    'preferences': {
      'maxDistanceKm': maxDistanceKm,
      'availableDays': availableDays,
      'preferredShiftTypes': preferredShiftTypes,
    },
  };
}

class OnboardingDraftStore {
  static const _key = 'medshift.workerOnboardingDraft';

  Future<WorkerOnboardingDraft> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) {
      return const WorkerOnboardingDraft();
    }
    return WorkerOnboardingDraft.fromJson(
      jsonDecode(raw) as Map<String, dynamic>,
    );
  }

  Future<void> write(WorkerOnboardingDraft draft) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(draft.toJson()));
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

final onboardingDraftStoreProvider = Provider<OnboardingDraftStore>((ref) {
  return OnboardingDraftStore();
});
