import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';

class ShiftRepository {
  ShiftRepository(this._dio);

  final Dio _dio;

  Future<List<ShiftSummary>> openShifts({
    required GeoPoint location,
    required double radiusKm,
    ShiftSearchFilters filters = const ShiftSearchFilters(),
  }) async {
    final response = await _dio.get<List<dynamic>>(
      '/matching/open-shifts',
      queryParameters: {
        'longitude': location.longitude,
        'latitude': location.latitude,
        'radiusKm': filters.radiusKm ?? radiusKm,
        if (filters.search.trim().isNotEmpty) 'search': filters.search.trim(),
        if (filters.roles.isNotEmpty)
          'roles': filters.roles.map(clinicalRoleToApi).join(','),
        if (filters.facilityTypes.isNotEmpty)
          'facilityTypes': filters.facilityTypes
              .map(facilityTypeToApi)
              .join(','),
        if (filters.shiftTypes.isNotEmpty)
          'shiftTypes': filters.shiftTypes
              .map(shiftSearchPeriodToApi)
              .join(','),
        if (filters.maxShiftHours != null)
          'maxShiftHours': filters.maxShiftHours,
        if (filters.minHourlyRate != null)
          'minHourlyRate': filters.minHourlyRate,
        'sort': shiftSearchSortToApi(filters.sort),
      },
    );
    return (response.data ?? const [])
        .map(
          (json) =>
              ShiftSummary.fromJson(Map<String, dynamic>.from(json as Map)),
        )
        .toList();
  }

  Future<List<ShiftSummary>> myShifts() async {
    final response = await _dio.get<List<dynamic>>('/shifts/worker/me');
    return (response.data ?? const [])
        .map(
          (json) =>
              ShiftSummary.fromJson(Map<String, dynamic>.from(json as Map)),
        )
        .toList();
  }

  Future<ShiftSummary> accept(String shiftId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/shifts/$shiftId/accept',
    );
    return ShiftSummary.fromJson(response.data ?? {});
  }

  Future<List<ShiftApplicationSummary>> applications() async {
    final response = await _dio.get<List<dynamic>>('/applications/me');
    return (response.data ?? const [])
        .map(
          (json) => ShiftApplicationSummary.fromJson(
            Map<String, dynamic>.from(json as Map),
          ),
        )
        .toList();
  }

  Future<ShiftApplicationSummary> apply(String shiftId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/shifts/$shiftId/applications',
    );
    return ShiftApplicationSummary.fromJson(response.data ?? {});
  }

  Future<List<ShiftInvitationSummary>> invitations() async {
    final response = await _dio.get<List<dynamic>>('/invitations/me');
    return (response.data ?? const [])
        .map(
          (json) => ShiftInvitationSummary.fromJson(
            Map<String, dynamic>.from(json as Map),
          ),
        )
        .toList();
  }

  Future<ShiftInvitationSummary> respondToInvitation(
    String invitationId,
    ShiftInvitationStatus status,
  ) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/invitations/$invitationId/status',
      data: {'status': shiftInvitationStatusToApi(status)},
    );
    return ShiftInvitationSummary.fromJson(response.data ?? {});
  }

  Future<List<ShiftAssignmentSummary>> assignments() async {
    final response = await _dio.get<List<dynamic>>('/assignments/me');
    return (response.data ?? const [])
        .map(
          (json) => ShiftAssignmentSummary.fromJson(
            Map<String, dynamic>.from(json as Map),
          ),
        )
        .toList();
  }

  Future<List<AttendanceEventSummary>> attendance() async {
    final response = await _dio.get<List<dynamic>>('/attendance');
    return (response.data ?? const [])
        .map(
          (json) => AttendanceEventSummary.fromJson(
            Map<String, dynamic>.from(json as Map),
          ),
        )
        .toList();
  }

  Future<List<TimesheetSummary>> timesheets() async {
    final response = await _dio.get<List<dynamic>>('/timesheets');
    return (response.data ?? const [])
        .map(
          (json) =>
              TimesheetSummary.fromJson(Map<String, dynamic>.from(json as Map)),
        )
        .toList();
  }

  Future<void> recordAttendance(
    String shiftId,
    AttendanceEventType type, {
    GeoPoint? location,
  }) {
    final path = switch (type) {
      AttendanceEventType.breakStart => '/attendance/break/start',
      AttendanceEventType.breakEnd => '/attendance/break/end',
      AttendanceEventType.clockOut => '/attendance/clock-out',
      _ => '/attendance/clock-in',
    };
    final now = DateTime.now().toUtc();
    return _dio.post<void>(
      path,
      data: {
        'shiftId': shiftId,
        'idempotencyKey':
            '${shiftId}_${type.name}_${now.microsecondsSinceEpoch}',
        'occurredAt': now.toIso8601String(),
        if (location != null) 'location': location.toJson(),
      },
    );
  }

  Future<TimesheetSummary> submitTimesheet(ShiftSummary shift) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/timesheets',
      data: {
        'shiftId': shift.id,
        'actualStartTime': shift.startTime.toUtc().toIso8601String(),
        'actualEndTime': DateTime.now().toUtc().toIso8601String(),
        'breakMinutes': 0,
        'notes': 'Submitted from MedShift mobile.',
      },
    );
    return TimesheetSummary.fromJson(response.data ?? {});
  }
}

final shiftRepositoryProvider = Provider<ShiftRepository>((ref) {
  return ShiftRepository(ref.watch(dioProvider));
});
