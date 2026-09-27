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
        if (filters.roleRequired != null)
          'roleRequired': clinicalRoleToApi(filters.roleRequired!),
        if (filters.facilityType != null)
          'facilityType': facilityTypeToApi(filters.facilityType!),
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
}

final shiftRepositoryProvider = Provider<ShiftRepository>((ref) {
  return ShiftRepository(ref.watch(dioProvider));
});
