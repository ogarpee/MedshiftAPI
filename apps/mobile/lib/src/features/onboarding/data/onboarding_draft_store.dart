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
    this.documents = const [],
  });

  final String firstName;
  final String lastName;
  final ClinicalRole title;
  final double latitude;
  final double longitude;
  final double maxDistanceKm;
  final List<String> availableDays;
  final List<String> preferredShiftTypes;
  final List<WorkerDocument> documents;

  WorkerOnboardingDraft copyWith({
    String? firstName,
    String? lastName,
    ClinicalRole? title,
    double? latitude,
    double? longitude,
    double? maxDistanceKm,
    List<String>? availableDays,
    List<String>? preferredShiftTypes,
    List<WorkerDocument>? documents,
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
      documents: documents ?? this.documents,
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
      documents: profile.documents,
    );
  }

  factory WorkerOnboardingDraft.fromJson(Map<String, dynamic> json) {
    return WorkerOnboardingDraft(
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      title: clinicalRoleFromApi(json['title']?.toString()),
      latitude: _doubleValue(json['latitude'], 51.0447),
      longitude: _doubleValue(json['longitude'], -114.0719),
      maxDistanceKm: _doubleValue(json['maxDistanceKm'], 25),
      availableDays: _stringList(json['availableDays']),
      preferredShiftTypes: _stringList(json['preferredShiftTypes']),
      documents: (json['documents'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) => WorkerDocument.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
    );
  }

  factory WorkerOnboardingDraft.fromApiPayload(
    Map<String, dynamic> json, {
    WorkerOnboardingDraft fallback = const WorkerOnboardingDraft(),
  }) {
    final location = Map<String, dynamic>.from(
      json['location'] as Map? ?? const {},
    );
    final coordinates = List<dynamic>.from(
      location['coordinates'] as List? ?? const [],
    );
    final preferences = Map<String, dynamic>.from(
      json['preferences'] as Map? ?? const {},
    );
    return WorkerOnboardingDraft(
      firstName: (json['firstName'] ?? fallback.firstName).toString(),
      lastName: (json['lastName'] ?? fallback.lastName).toString(),
      title: json['title'] == null
          ? fallback.title
          : clinicalRoleFromApi(json['title'].toString()),
      longitude: coordinates.length > 1
          ? _doubleValue(coordinates[0], fallback.longitude)
          : fallback.longitude,
      latitude: coordinates.length > 1
          ? _doubleValue(coordinates[1], fallback.latitude)
          : fallback.latitude,
      maxDistanceKm: _doubleValue(
        preferences['maxDistanceKm'],
        fallback.maxDistanceKm,
      ),
      availableDays: preferences['availableDays'] == null
          ? fallback.availableDays
          : _stringList(preferences['availableDays']),
      preferredShiftTypes: preferences['preferredShiftTypes'] == null
          ? fallback.preferredShiftTypes
          : _stringList(preferences['preferredShiftTypes']),
      documents: json['documents'] == null
          ? fallback.documents
          : (json['documents'] as List)
                .whereType<Map>()
                .map(
                  (item) =>
                      WorkerDocument.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList(),
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
    'documents': documents.map((document) => document.toJson()).toList(),
  };

  Map<String, dynamic> toApiPayload() => {
    'firstName': firstName.trim(),
    'lastName': lastName.trim(),
    'title': clinicalRoleToApi(title),
    'documents': documents.map((document) => document.toJson()).toList(),
    'location': GeoPoint(longitude: longitude, latitude: latitude).toJson(),
    'preferences': {
      'maxDistanceKm': maxDistanceKm,
      'availableDays': availableDays,
      'preferredShiftTypes': preferredShiftTypes,
    },
  };
}

class StoredWorkerOnboardingDraft {
  const StoredWorkerOnboardingDraft({
    required this.draft,
    this.currentStep = 0,
    this.pendingSync = false,
  });

  final WorkerOnboardingDraft draft;
  final int currentStep;
  final bool pendingSync;

  factory StoredWorkerOnboardingDraft.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final isWrappedDraft = data is Map;
    return StoredWorkerOnboardingDraft(
      draft: WorkerOnboardingDraft.fromJson(
        isWrappedDraft ? Map<String, dynamic>.from(data) : json,
      ),
      currentStep: _intValue(json['currentStep'], 0).clamp(0, 4),
      pendingSync: isWrappedDraft ? json['pendingSync'] == true : true,
    );
  }

  Map<String, dynamic> toJson() => {
    'data': draft.toJson(),
    'currentStep': currentStep,
    'pendingSync': pendingSync,
    'updatedAt': DateTime.now().toUtc().toIso8601String(),
  };
}

double _doubleValue(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? fallback;
}

int _intValue(dynamic value, int fallback) {
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

List<String> _stringList(dynamic value) {
  if (value is! List) return const [];
  return value
      .where((item) => item != null)
      .map((item) => item.toString())
      .toList();
}

class OnboardingDraftStore {
  static const _legacyKey = 'medshift.workerOnboardingDraft';
  String _key(String userId) => 'medshift.workerOnboardingDraft.$userId';

  Future<StoredWorkerOnboardingDraft?> read(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(userId));
    if (raw != null) {
      final restored = _decodeStoredDraft(raw);
      if (restored != null) return restored;
    }
    final legacy = prefs.getString(_legacyKey);
    if (legacy == null) return null;
    final legacyDraft = _decodeJsonMap(legacy);
    if (legacyDraft == null) return null;
    final migrated = StoredWorkerOnboardingDraft.fromJson(legacyDraft);
    await write(userId, migrated);
    await prefs.remove(_legacyKey);
    return migrated;
  }

  Future<void> write(String userId, StoredWorkerOnboardingDraft draft) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(userId), jsonEncode(draft.toJson()));
  }

  Future<void> clear(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(userId));
  }
}

StoredWorkerOnboardingDraft? _decodeStoredDraft(String raw) {
  final decoded = _decodeJsonMap(raw);
  if (decoded == null) return null;
  try {
    return StoredWorkerOnboardingDraft.fromJson(decoded);
  } on FormatException {
    return null;
  } on TypeError {
    return null;
  }
}

Map<String, dynamic>? _decodeJsonMap(String raw) {
  try {
    final decoded = jsonDecode(raw);
    return decoded is Map ? Map<String, dynamic>.from(decoded) : null;
  } on FormatException {
    return null;
  }
}

final onboardingDraftStoreProvider = Provider<OnboardingDraftStore>((ref) {
  return OnboardingDraftStore();
});
