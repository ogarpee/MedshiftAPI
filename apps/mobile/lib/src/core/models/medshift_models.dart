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

enum ShiftStatus {
  draft,
  published,
  matching,
  open,
  assigned,
  upcoming,
  matched,
  inProgress,
  completed,
  timesheetSubmitted,
  facilityApproved,
  paymentProcessing,
  paid,
  cancelled,
  expired,
  noShow,
  disputed,
}

enum ShiftApplicationStatus {
  applied,
  underReview,
  selected,
  confirmed,
  declined,
  withdrawn,
}

enum ShiftInvitationStatus { pending, accepted, declined, cancelled, expired }

enum ShiftAssignmentStatus {
  confirmed,
  inProgress,
  completed,
  cancelled,
  noShow,
}

enum AttendanceEventType {
  clockIn,
  breakStart,
  breakEnd,
  clockOut,
  manualAdjustment,
}

enum TimesheetStatus {
  draft,
  submitted,
  approved,
  rejected,
  correctionRequested,
  disputed,
}

enum ShiftSearchSort { distance, startTime, hourlyRate }

enum ShiftSearchPeriod { day, evening, night, weekend }

enum NotificationType {
  shiftCreated,
  shiftAccepted,
  onboardingApproved,
  onboardingRejected,
  reviewAvailable,
}

enum TwoFactorMethod { totp, email }

TwoFactorMethod twoFactorMethodFromApi(String? value) =>
    value == 'EMAIL' ? TwoFactorMethod.email : TwoFactorMethod.totp;

class TwoFactorChallenge {
  const TwoFactorChallenge({
    required this.id,
    required this.method,
    required this.expiresAt,
    this.maskedEmail,
  });
  final String id;
  final TwoFactorMethod method;
  final DateTime expiresAt;
  final String? maskedEmail;
  factory TwoFactorChallenge.fromJson(Map<String, dynamic> json) =>
      TwoFactorChallenge(
        id: (json['challengeId'] ?? '').toString(),
        method: twoFactorMethodFromApi(json['method']?.toString()),
        expiresAt:
            DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
            DateTime.now().add(const Duration(minutes: 10)),
        maskedEmail: json['maskedEmail']?.toString(),
      );
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

String shiftSearchPeriodToApi(ShiftSearchPeriod period) => switch (period) {
  ShiftSearchPeriod.day => 'DAY',
  ShiftSearchPeriod.evening => 'EVENING',
  ShiftSearchPeriod.night => 'NIGHT',
  ShiftSearchPeriod.weekend => 'WEEKEND',
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
    this.search = '',
    this.roles = const [],
    this.facilityTypes = const [],
    this.shiftTypes = const [],
    this.radiusKm,
    this.maxShiftHours,
    this.minHourlyRate,
    this.sort = ShiftSearchSort.distance,
  });

  final String search;
  final List<ClinicalRole> roles;
  final List<FacilityType> facilityTypes;
  final List<ShiftSearchPeriod> shiftTypes;
  final double? radiusKm;
  final double? maxShiftHours;
  final double? minHourlyRate;
  final ShiftSearchSort sort;

  bool get hasActiveFilters =>
      search.trim().isNotEmpty ||
      roles.isNotEmpty ||
      facilityTypes.isNotEmpty ||
      shiftTypes.isNotEmpty ||
      radiusKm != null ||
      maxShiftHours != null ||
      minHourlyRate != null ||
      sort != ShiftSearchSort.distance;

  int get activeFilterCount =>
      roles.length +
      facilityTypes.length +
      shiftTypes.length +
      (radiusKm == null ? 0 : 1) +
      (maxShiftHours == null ? 0 : 1) +
      (minHourlyRate == null ? 0 : 1) +
      (sort == ShiftSearchSort.distance ? 0 : 1);

  ShiftSearchFilters copyWith({
    String? search,
    List<ClinicalRole>? roles,
    List<FacilityType>? facilityTypes,
    List<ShiftSearchPeriod>? shiftTypes,
    double? radiusKm,
    double? maxShiftHours,
    double? minHourlyRate,
    ShiftSearchSort? sort,
    bool clearSearch = false,
    bool clearRadius = false,
    bool clearMaxHours = false,
    bool clearMinRate = false,
  }) {
    return ShiftSearchFilters(
      search: clearSearch ? '' : search ?? this.search,
      roles: roles ?? this.roles,
      facilityTypes: facilityTypes ?? this.facilityTypes,
      shiftTypes: shiftTypes ?? this.shiftTypes,
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
  'DRAFT' => ShiftStatus.draft,
  'PUBLISHED' => ShiftStatus.published,
  'MATCHING' => ShiftStatus.matching,
  'ASSIGNED' => ShiftStatus.assigned,
  'UPCOMING' => ShiftStatus.upcoming,
  'MATCHED' => ShiftStatus.matched,
  'IN_PROGRESS' => ShiftStatus.inProgress,
  'COMPLETED' => ShiftStatus.completed,
  'TIMESHEET_SUBMITTED' => ShiftStatus.timesheetSubmitted,
  'FACILITY_APPROVED' => ShiftStatus.facilityApproved,
  'PAYMENT_PROCESSING' => ShiftStatus.paymentProcessing,
  'PAID' => ShiftStatus.paid,
  'CANCELLED' => ShiftStatus.cancelled,
  'EXPIRED' => ShiftStatus.expired,
  'NO_SHOW' => ShiftStatus.noShow,
  'DISPUTED' => ShiftStatus.disputed,
  _ => ShiftStatus.open,
};

String shiftStatusToApi(ShiftStatus status) => switch (status) {
  ShiftStatus.draft => 'DRAFT',
  ShiftStatus.published => 'PUBLISHED',
  ShiftStatus.matching => 'MATCHING',
  ShiftStatus.open => 'OPEN',
  ShiftStatus.assigned => 'ASSIGNED',
  ShiftStatus.upcoming => 'UPCOMING',
  ShiftStatus.matched => 'MATCHED',
  ShiftStatus.inProgress => 'IN_PROGRESS',
  ShiftStatus.completed => 'COMPLETED',
  ShiftStatus.timesheetSubmitted => 'TIMESHEET_SUBMITTED',
  ShiftStatus.facilityApproved => 'FACILITY_APPROVED',
  ShiftStatus.paymentProcessing => 'PAYMENT_PROCESSING',
  ShiftStatus.paid => 'PAID',
  ShiftStatus.cancelled => 'CANCELLED',
  ShiftStatus.expired => 'EXPIRED',
  ShiftStatus.noShow => 'NO_SHOW',
  ShiftStatus.disputed => 'DISPUTED',
};

ShiftApplicationStatus shiftApplicationStatusFromApi(String? value) =>
    switch (value) {
      'UNDER_REVIEW' => ShiftApplicationStatus.underReview,
      'SELECTED' => ShiftApplicationStatus.selected,
      'CONFIRMED' => ShiftApplicationStatus.confirmed,
      'DECLINED' => ShiftApplicationStatus.declined,
      'WITHDRAWN' => ShiftApplicationStatus.withdrawn,
      _ => ShiftApplicationStatus.applied,
    };

String shiftInvitationStatusToApi(ShiftInvitationStatus status) =>
    switch (status) {
      ShiftInvitationStatus.accepted => 'ACCEPTED',
      ShiftInvitationStatus.declined => 'DECLINED',
      ShiftInvitationStatus.cancelled => 'CANCELLED',
      ShiftInvitationStatus.expired => 'EXPIRED',
      ShiftInvitationStatus.pending => 'PENDING',
    };

ShiftInvitationStatus shiftInvitationStatusFromApi(String? value) =>
    switch (value) {
      'ACCEPTED' => ShiftInvitationStatus.accepted,
      'DECLINED' => ShiftInvitationStatus.declined,
      'CANCELLED' => ShiftInvitationStatus.cancelled,
      'EXPIRED' => ShiftInvitationStatus.expired,
      _ => ShiftInvitationStatus.pending,
    };

ShiftAssignmentStatus shiftAssignmentStatusFromApi(String? value) =>
    switch (value) {
      'IN_PROGRESS' => ShiftAssignmentStatus.inProgress,
      'COMPLETED' => ShiftAssignmentStatus.completed,
      'CANCELLED' => ShiftAssignmentStatus.cancelled,
      'NO_SHOW' => ShiftAssignmentStatus.noShow,
      _ => ShiftAssignmentStatus.confirmed,
    };

AttendanceEventType attendanceEventTypeFromApi(String? value) =>
    switch (value) {
      'BREAK_START' => AttendanceEventType.breakStart,
      'BREAK_END' => AttendanceEventType.breakEnd,
      'CLOCK_OUT' => AttendanceEventType.clockOut,
      'MANUAL_ADJUSTMENT' => AttendanceEventType.manualAdjustment,
      _ => AttendanceEventType.clockIn,
    };

TimesheetStatus timesheetStatusFromApi(String? value) => switch (value) {
  'APPROVED' => TimesheetStatus.approved,
  'REJECTED' => TimesheetStatus.rejected,
  'CORRECTION_REQUESTED' => TimesheetStatus.correctionRequested,
  'DISPUTED' => TimesheetStatus.disputed,
  'DRAFT' => TimesheetStatus.draft,
  _ => TimesheetStatus.submitted,
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
  const AuthSession({
    required this.accessToken,
    required this.user,
    this.refreshToken,
  });

  final String accessToken;
  final String? refreshToken;
  final AuthUser user;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: (json['accessToken'] ?? '').toString(),
      refreshToken: json['refreshToken']?.toString(),
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

enum WorkerDocumentCategory {
  governmentId,
  professionalCertificate,
  backgroundCheck,
  other,
}

String workerDocumentCategoryToApi(WorkerDocumentCategory value) =>
    switch (value) {
      WorkerDocumentCategory.governmentId => 'GOVERNMENT_ID',
      WorkerDocumentCategory.professionalCertificate =>
        'PROFESSIONAL_CERTIFICATE',
      WorkerDocumentCategory.backgroundCheck => 'BACKGROUND_CHECK',
      WorkerDocumentCategory.other => 'OTHER',
    };

WorkerDocumentCategory workerDocumentCategoryFromApi(String? value) =>
    switch (value) {
      'GOVERNMENT_ID' => WorkerDocumentCategory.governmentId,
      'BACKGROUND_CHECK' => WorkerDocumentCategory.backgroundCheck,
      'OTHER' => WorkerDocumentCategory.other,
      _ => WorkerDocumentCategory.professionalCertificate,
    };

class WorkerDocument {
  const WorkerDocument({
    required this.id,
    required this.category,
    this.cloudinaryPublicId,
    this.documentUrl,
    this.resourceType,
    this.deliveryType,
    this.version,
    this.format,
    this.originalFilename,
    this.bytes,
    this.uploadedAt,
    this.verificationStatus,
    this.rejectionReason,
  });

  final String id;
  final WorkerDocumentCategory category;
  final String? cloudinaryPublicId;
  final String? documentUrl;
  final String? resourceType;
  final String? deliveryType;
  final int? version;
  final String? format;
  final String? originalFilename;
  final int? bytes;
  final String? uploadedAt;
  final String? verificationStatus;
  final String? rejectionReason;

  factory WorkerDocument.fromJson(Map<String, dynamic> json) => WorkerDocument(
    id: (json['id'] ?? '').toString(),
    category: workerDocumentCategoryFromApi(json['category']?.toString()),
    cloudinaryPublicId: json['cloudinaryPublicId']?.toString(),
    documentUrl: json['documentUrl']?.toString(),
    resourceType: json['resourceType']?.toString(),
    deliveryType: json['deliveryType']?.toString(),
    version: _nullableInt(json['version']),
    format: json['format']?.toString(),
    originalFilename: json['originalFilename']?.toString(),
    bytes: _nullableInt(json['bytes']),
    uploadedAt: json['uploadedAt']?.toString(),
    verificationStatus: json['verificationStatus']?.toString(),
    rejectionReason: json['rejectionReason']?.toString(),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'category': workerDocumentCategoryToApi(category),
    if (cloudinaryPublicId != null) 'cloudinaryPublicId': cloudinaryPublicId,
    if (documentUrl != null) 'documentUrl': documentUrl,
    if (resourceType != null) 'resourceType': resourceType,
    if (deliveryType != null) 'deliveryType': deliveryType,
    if (version != null) 'version': version,
    if (format != null) 'format': format,
    if (originalFilename != null) 'originalFilename': originalFilename,
    if (bytes != null) 'bytes': bytes,
    if (uploadedAt != null) 'uploadedAt': uploadedAt,
    if (verificationStatus != null) 'verificationStatus': verificationStatus,
    if (rejectionReason != null) 'rejectionReason': rejectionReason,
  };
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
    required this.documents,
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
  final List<WorkerDocument> documents;
  final OnboardingStatus onboardingStatus;
  final double averageRating;
  final int totalShiftsCompleted;

  String get displayName => '$firstName $lastName'.trim();

  factory WorkerProfile.fromJson(Map<String, dynamic> json) {
    final preferences = _stringMap(json['preferences']);
    final onboarding = _stringMap(json['onboarding']);
    final stats = _stringMap(json['stats']);
    final documents = json['documents'] is List
        ? (json['documents'] as List)
              .whereType<Map>()
              .map(
                (item) =>
                    WorkerDocument.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList()
        : const <WorkerDocument>[];

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
      maxDistanceKm: _doubleValue(preferences['maxDistanceKm'], 25),
      availableDays: _stringList(preferences['availableDays']),
      preferredShiftTypes: _stringList(preferences['preferredShiftTypes']),
      documents: documents,
      onboardingStatus: onboardingStatusFromApi(
        onboarding['verificationStatus']?.toString(),
      ),
      averageRating: _doubleValue(stats['averageRating'], 0),
      totalShiftsCompleted: _intValue(stats['totalShiftsCompleted'], 0),
    );
  }
}

Map<String, dynamic> _stringMap(dynamic value) {
  if (value is! Map) return const {};
  return Map<String, dynamic>.from(value);
}

List<String> _stringList(dynamic value) {
  if (value is! List) return const [];
  return value
      .where((item) => item != null)
      .map((item) => item.toString())
      .toList();
}

double _doubleValue(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? fallback;
}

int _intValue(dynamic value, int fallback) {
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

int? _nullableInt(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
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

class ShiftApplicationSummary {
  const ShiftApplicationSummary({
    required this.id,
    required this.shiftId,
    required this.workerId,
    required this.status,
    this.message,
  });

  final String id;
  final String shiftId;
  final String workerId;
  final ShiftApplicationStatus status;
  final String? message;

  factory ShiftApplicationSummary.fromJson(Map<String, dynamic> json) {
    return ShiftApplicationSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      workerId: (json['workerId'] ?? '').toString(),
      status: shiftApplicationStatusFromApi(json['status']?.toString()),
      message: json['message']?.toString(),
    );
  }
}

class ShiftInvitationSummary {
  const ShiftInvitationSummary({
    required this.id,
    required this.shiftId,
    required this.workerId,
    required this.status,
    this.message,
  });

  final String id;
  final String shiftId;
  final String workerId;
  final ShiftInvitationStatus status;
  final String? message;

  factory ShiftInvitationSummary.fromJson(Map<String, dynamic> json) {
    return ShiftInvitationSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      workerId: (json['workerId'] ?? '').toString(),
      status: shiftInvitationStatusFromApi(json['status']?.toString()),
      message: json['message']?.toString(),
    );
  }
}

class ShiftAssignmentSummary {
  const ShiftAssignmentSummary({
    required this.id,
    required this.shiftId,
    required this.workerId,
    required this.status,
  });

  final String id;
  final String shiftId;
  final String workerId;
  final ShiftAssignmentStatus status;

  factory ShiftAssignmentSummary.fromJson(Map<String, dynamic> json) {
    return ShiftAssignmentSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      workerId: (json['workerId'] ?? '').toString(),
      status: shiftAssignmentStatusFromApi(json['status']?.toString()),
    );
  }
}

class AttendanceEventSummary {
  const AttendanceEventSummary({
    required this.id,
    required this.shiftId,
    required this.eventType,
    required this.occurredAt,
  });

  final String id;
  final String shiftId;
  final AttendanceEventType eventType;
  final DateTime occurredAt;

  factory AttendanceEventSummary.fromJson(Map<String, dynamic> json) {
    return AttendanceEventSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      eventType: attendanceEventTypeFromApi(json['eventType']?.toString()),
      occurredAt:
          DateTime.tryParse((json['occurredAt'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}

class TimesheetSummary {
  const TimesheetSummary({
    required this.id,
    required this.shiftId,
    required this.status,
    required this.workedMinutes,
    this.facilityNotes,
  });

  final String id;
  final String shiftId;
  final TimesheetStatus status;
  final int workedMinutes;
  final String? facilityNotes;

  factory TimesheetSummary.fromJson(Map<String, dynamic> json) {
    return TimesheetSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      status: timesheetStatusFromApi(json['status']?.toString()),
      workedMinutes: ((json['workedMinutes'] ?? 0) as num).toInt(),
      facilityNotes: json['facilityNotes']?.toString(),
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
