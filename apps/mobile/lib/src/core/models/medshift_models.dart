enum UserRole { worker, facility, admin }

enum AccountStatus { pending, active, suspended }

enum ClinicalRole { hca, rn, lpn, psw }

enum FacilityType {
  longTermCare,
  hospital,
  clinic,
  homeCare,
  supportiveLiving,
  retirementResidence,
  other,
}

enum OnboardingStatus { incomplete, pendingReview, approved, rejected }

enum ShiftStatus { open, matched, inProgress, completed, cancelled }

enum ShiftSearchSort { distance, startTime, hourlyRate }

enum NotificationType {
  shiftCreated,
  shiftAccepted,
  onboardingApproved,
  onboardingRejected,
  reviewAvailable,
}

String roleToApi(UserRole role) => switch (role) {
  UserRole.worker => 'WORKER',
  UserRole.facility => 'FACILITY',
  UserRole.admin => 'ADMIN',
};

String clinicalRoleToApi(ClinicalRole role) => switch (role) {
  ClinicalRole.hca => 'HCA',
  ClinicalRole.rn => 'RN',
  ClinicalRole.lpn => 'LPN',
  ClinicalRole.psw => 'PSW',
};

String facilityTypeToApi(FacilityType type) => switch (type) {
  FacilityType.longTermCare => 'LONG_TERM_CARE',
  FacilityType.hospital => 'HOSPITAL',
  FacilityType.clinic => 'CLINIC',
  FacilityType.homeCare => 'HOME_CARE',
  FacilityType.supportiveLiving => 'SUPPORTIVE_LIVING',
  FacilityType.retirementResidence => 'RETIREMENT_RESIDENCE',
  FacilityType.other => 'OTHER',
};

String shiftSearchSortToApi(ShiftSearchSort sort) => switch (sort) {
  ShiftSearchSort.distance => 'DISTANCE',
  ShiftSearchSort.startTime => 'START_TIME',
  ShiftSearchSort.hourlyRate => 'HOURLY_RATE',
};

String onboardingStatusToApi(OnboardingStatus status) => switch (status) {
  OnboardingStatus.incomplete => 'INCOMPLETE',
  OnboardingStatus.pendingReview => 'PENDING_REVIEW',
  OnboardingStatus.approved => 'APPROVED',
  OnboardingStatus.rejected => 'REJECTED',
};

UserRole userRoleFromApi(String? value) => switch (value) {
  'FACILITY' => UserRole.facility,
  'ADMIN' => UserRole.admin,
  _ => UserRole.worker,
};

AccountStatus accountStatusFromApi(String? value) => switch (value) {
  'ACTIVE' => AccountStatus.active,
  'SUSPENDED' => AccountStatus.suspended,
  _ => AccountStatus.pending,
};

ClinicalRole clinicalRoleFromApi(String? value) => switch (value) {
  'RN' => ClinicalRole.rn,
  'LPN' => ClinicalRole.lpn,
  'PSW' => ClinicalRole.psw,
  _ => ClinicalRole.hca,
};

FacilityType facilityTypeFromApi(String? value) => switch (value) {
  'HOSPITAL' => FacilityType.hospital,
  'CLINIC' => FacilityType.clinic,
  'HOME_CARE' => FacilityType.homeCare,
  'SUPPORTIVE_LIVING' => FacilityType.supportiveLiving,
  'RETIREMENT_RESIDENCE' => FacilityType.retirementResidence,
  'OTHER' => FacilityType.other,
  _ => FacilityType.longTermCare,
};

class ShiftSearchFilters {
  const ShiftSearchFilters({
    this.roleRequired,
    this.facilityType,
    this.radiusKm,
    this.maxShiftHours,
    this.minHourlyRate,
    this.sort = ShiftSearchSort.distance,
  });

  final ClinicalRole? roleRequired;
  final FacilityType? facilityType;
  final double? radiusKm;
  final double? maxShiftHours;
  final double? minHourlyRate;
  final ShiftSearchSort sort;

  bool get hasActiveFilters =>
      roleRequired != null ||
      facilityType != null ||
      radiusKm != null ||
      maxShiftHours != null ||
      minHourlyRate != null ||
      sort != ShiftSearchSort.distance;

  ShiftSearchFilters copyWith({
    ClinicalRole? roleRequired,
    FacilityType? facilityType,
    double? radiusKm,
    double? maxShiftHours,
    double? minHourlyRate,
    ShiftSearchSort? sort,
    bool clearRole = false,
    bool clearFacilityType = false,
    bool clearRadius = false,
    bool clearMaxHours = false,
    bool clearMinRate = false,
  }) {
    return ShiftSearchFilters(
      roleRequired: clearRole ? null : roleRequired ?? this.roleRequired,
      facilityType: clearFacilityType
          ? null
          : facilityType ?? this.facilityType,
      radiusKm: clearRadius ? null : radiusKm ?? this.radiusKm,
      maxShiftHours: clearMaxHours ? null : maxShiftHours ?? this.maxShiftHours,
      minHourlyRate: clearMinRate ? null : minHourlyRate ?? this.minHourlyRate,
      sort: sort ?? this.sort,
    );
  }
}

OnboardingStatus onboardingStatusFromApi(String? value) => switch (value) {
  'APPROVED' => OnboardingStatus.approved,
  'PENDING_REVIEW' => OnboardingStatus.pendingReview,
  'REJECTED' => OnboardingStatus.rejected,
  _ => OnboardingStatus.incomplete,
};

ShiftStatus shiftStatusFromApi(String? value) => switch (value) {
  'MATCHED' => ShiftStatus.matched,
  'IN_PROGRESS' => ShiftStatus.inProgress,
  'COMPLETED' => ShiftStatus.completed,
  'CANCELLED' => ShiftStatus.cancelled,
  _ => ShiftStatus.open,
};

String readableEnum(String value) {
  return value
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.role,
    required this.status,
    required this.emailVerified,
  });

  final String id;
  final String email;
  final UserRole role;
  final AccountStatus status;
  final bool emailVerified;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: (json['id'] ?? json['sub'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      role: userRoleFromApi(json['role']?.toString()),
      status: accountStatusFromApi(json['status']?.toString()),
      emailVerified: json['emailVerified'] == true,
    );
  }
}

class AuthSession {
  const AuthSession({required this.accessToken, required this.user});

  final String accessToken;
  final AuthUser user;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: (json['accessToken'] ?? '').toString(),
      user: AuthUser.fromJson(Map<String, dynamic>.from(json['user'] as Map)),
    );
  }
}

class GeoPoint {
  const GeoPoint({required this.longitude, required this.latitude});

  final double longitude;
  final double latitude;

  factory GeoPoint.fromJson(Map<String, dynamic>? json) {
    final coordinates = json?['coordinates'];
    if (coordinates is List && coordinates.length >= 2) {
      return GeoPoint(
        longitude: (coordinates[0] as num).toDouble(),
        latitude: (coordinates[1] as num).toDouble(),
      );
    }
    return const GeoPoint(longitude: -114.0719, latitude: 51.0447);
  }

  Map<String, dynamic> toJson() => {
    'type': 'Point',
    'coordinates': [longitude, latitude],
  };
}

class OnboardingState {
  const OnboardingState({
    required this.verificationStatus,
    this.completed = false,
    this.nextStep,
    this.profileId,
    this.rejectedReason,
  });

  final bool completed;
  final String? nextStep;
  final String? profileId;
  final String? rejectedReason;
  final OnboardingStatus verificationStatus;

  bool get canAcceptShifts => verificationStatus == OnboardingStatus.approved;

  factory OnboardingState.fromJson(Map<String, dynamic> json) {
    return OnboardingState(
      completed: json['completed'] == true,
      nextStep: json['nextStep']?.toString(),
      profileId: json['profileId']?.toString(),
      rejectedReason: json['rejectedReason']?.toString(),
      verificationStatus: onboardingStatusFromApi(
        json['verificationStatus']?.toString(),
      ),
    );
  }
}

class WorkerProfile {
  const WorkerProfile({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.title,
    required this.location,
    required this.maxDistanceKm,
    required this.availableDays,
    required this.preferredShiftTypes,
    required this.credentialType,
    required this.credentialUrl,
    required this.backgroundConsent,
    required this.onboardingStatus,
    this.averageRating = 0,
    this.totalShiftsCompleted = 0,
  });

  final String id;
  final String firstName;
  final String lastName;
  final ClinicalRole title;
  final GeoPoint location;
  final double maxDistanceKm;
  final List<String> availableDays;
  final List<String> preferredShiftTypes;
  final String credentialType;
  final String credentialUrl;
  final bool backgroundConsent;
  final OnboardingStatus onboardingStatus;
  final double averageRating;
  final int totalShiftsCompleted;

  String get displayName => '$firstName $lastName'.trim();

  factory WorkerProfile.fromJson(Map<String, dynamic> json) {
    final preferences = Map<String, dynamic>.from(
      (json['preferences'] ?? {}) as Map,
    );
    final background = Map<String, dynamic>.from(
      (json['backgroundCheck'] ?? {}) as Map,
    );
    final onboarding = Map<String, dynamic>.from(
      (json['onboarding'] ?? {}) as Map,
    );
    final stats = Map<String, dynamic>.from((json['stats'] ?? {}) as Map);
    final credentials = json['credentials'] is List
        ? json['credentials'] as List
        : const [];
    final firstCredential = credentials.isNotEmpty && credentials.first is Map
        ? Map<String, dynamic>.from(credentials.first as Map)
        : <String, dynamic>{};

    return WorkerProfile(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      title: clinicalRoleFromApi(json['title']?.toString()),
      location: GeoPoint.fromJson(
        json['location'] is Map
            ? Map<String, dynamic>.from(json['location'] as Map)
            : null,
      ),
      maxDistanceKm: ((preferences['maxDistanceKm'] ?? 25) as num).toDouble(),
      availableDays: List<String>.from(
        preferences['availableDays'] ?? const [],
      ),
      preferredShiftTypes: List<String>.from(
        preferences['preferredShiftTypes'] ?? const [],
      ),
      credentialType: (firstCredential['type'] ?? 'HCA certificate').toString(),
      credentialUrl: (firstCredential['documentUrl'] ?? '').toString(),
      backgroundConsent: background['consentedAt'] != null,
      onboardingStatus: onboardingStatusFromApi(
        onboarding['verificationStatus']?.toString(),
      ),
      averageRating: ((stats['averageRating'] ?? 0) as num).toDouble(),
      totalShiftsCompleted: ((stats['totalShiftsCompleted'] ?? 0) as num)
          .toInt(),
    );
  }
}

class ShiftSummary {
  const ShiftSummary({
    required this.id,
    required this.facilityId,
    required this.roleRequired,
    required this.startTime,
    required this.endTime,
    required this.hourlyRate,
    required this.status,
    required this.location,
    this.description,
    this.distanceKm,
    this.facilityName,
    this.facilityCity,
    this.facilityRating,
    this.filledAt,
  });

  final String id;
  final String facilityId;
  final ClinicalRole roleRequired;
  final DateTime startTime;
  final DateTime endTime;
  final double hourlyRate;
  final ShiftStatus status;
  final GeoPoint location;
  final String? description;
  final double? distanceKm;
  final String? facilityName;
  final String? facilityCity;
  final double? facilityRating;
  final DateTime? filledAt;

  bool get isOpen => status == ShiftStatus.open;

  factory ShiftSummary.fromJson(Map<String, dynamic> json) {
    final facility = json['facility'] is Map
        ? Map<String, dynamic>.from(json['facility'] as Map)
        : <String, dynamic>{};
    final address = facility['address'] is Map
        ? Map<String, dynamic>.from(facility['address'] as Map)
        : <String, dynamic>{};
    final stats = facility['stats'] is Map
        ? Map<String, dynamic>.from(facility['stats'] as Map)
        : <String, dynamic>{};

    return ShiftSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      facilityId: (json['facilityId'] ?? '').toString(),
      roleRequired: clinicalRoleFromApi(json['roleRequired']?.toString()),
      startTime:
          DateTime.tryParse((json['startTime'] ?? '').toString()) ??
          DateTime.now(),
      endTime:
          DateTime.tryParse((json['endTime'] ?? '').toString()) ??
          DateTime.now(),
      hourlyRate: ((json['hourlyRate'] ?? 0) as num).toDouble(),
      status: shiftStatusFromApi(json['status']?.toString()),
      location: GeoPoint.fromJson(
        json['location'] is Map
            ? Map<String, dynamic>.from(json['location'] as Map)
            : null,
      ),
      description: json['description']?.toString(),
      distanceKm: json['distanceKm'] is num
          ? (json['distanceKm'] as num).toDouble()
          : null,
      facilityName: facility['name']?.toString(),
      facilityCity: address['city']?.toString(),
      facilityRating: stats['averageRating'] is num
          ? (stats['averageRating'] as num).toDouble()
          : null,
      filledAt: json['filledAt'] == null
          ? null
          : DateTime.tryParse(json['filledAt'].toString()),
    );
  }
}

class NotificationSummary {
  const NotificationSummary({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    this.readAt,
  });

  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final DateTime? readAt;

  bool get unread => readAt == null;

  factory NotificationSummary.fromJson(Map<String, dynamic> json) {
    return NotificationSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString()) ??
          DateTime.now(),
      readAt: json['readAt'] == null
          ? null
          : DateTime.tryParse(json['readAt'].toString()),
    );
  }
}

class ReviewSummary {
  const ReviewSummary({
    required this.id,
    required this.shiftId,
    required this.rating,
    this.comment,
  });

  final String id;
  final String shiftId;
  final int rating;
  final String? comment;

  factory ReviewSummary.fromJson(Map<String, dynamic> json) {
    return ReviewSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      rating: ((json['rating'] ?? 0) as num).toInt(),
      comment: json['comment']?.toString(),
    );
  }
}
