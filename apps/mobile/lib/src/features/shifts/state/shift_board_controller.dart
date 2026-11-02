import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/app_config.dart';
import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_token_store.dart';
import '../../worker/data/worker_repository.dart';
import '../data/shift_repository.dart';

class ShiftBoardState {
  const ShiftBoardState({
    this.openShifts = const [],
    this.myShifts = const [],
    this.applications = const [],
    this.invitations = const [],
    this.assignments = const [],
    this.attendanceEvents = const [],
    this.timesheets = const [],
    this.profile,
    this.onboarding = const OnboardingState(
      verificationStatus: OnboardingStatus.incomplete,
    ),
    this.filters = const ShiftSearchFilters(),
    this.message,
    this.isSearching = false,
    this.searchError,
  });

  final List<ShiftSummary> openShifts;
  final List<ShiftSummary> myShifts;
  final List<ShiftApplicationSummary> applications;
  final List<ShiftInvitationSummary> invitations;
  final List<ShiftAssignmentSummary> assignments;
  final List<AttendanceEventSummary> attendanceEvents;
  final List<TimesheetSummary> timesheets;
  final WorkerProfile? profile;
  final OnboardingState onboarding;
  final ShiftSearchFilters filters;
  final String? message;
  final bool isSearching;
  final String? searchError;

  List<ShiftSummary> get all => [...openShifts, ...myShifts];

  ShiftBoardState copyWith({
    List<ShiftSummary>? openShifts,
    ShiftSearchFilters? filters,
    String? message,
    bool? isSearching,
    String? searchError,
    bool clearSearchError = false,
  }) => ShiftBoardState(
    openShifts: openShifts ?? this.openShifts,
    myShifts: myShifts,
    applications: applications,
    invitations: invitations,
    assignments: assignments,
    attendanceEvents: attendanceEvents,
    timesheets: timesheets,
    profile: profile,
    onboarding: onboarding,
    filters: filters ?? this.filters,
    message: message ?? this.message,
    isSearching: isSearching ?? this.isSearching,
    searchError: clearSearchError ? null : searchError ?? this.searchError,
  );
}

class ShiftBoardController extends AsyncNotifier<ShiftBoardState> {
  io.Socket? _socket;

  @override
  Future<ShiftBoardState> build() async {
    ref.onDispose(() => _socket?.dispose());
    final state = await _load();
    await _connectRealtime();
    return state;
  }

  Future<ShiftBoardState> _load([
    ShiftSearchFilters filters = const ShiftSearchFilters(),
  ]) async {
    final workerRepository = ref.watch(workerRepositoryProvider);
    final shiftRepository = ref.watch(shiftRepositoryProvider);
    final onboarding = await workerRepository.onboardingStatus();
    final profile = await workerRepository.profile();
    final myShifts = await shiftRepository.myShifts();
    final marketplaceResults = await Future.wait([
      shiftRepository.applications(),
      shiftRepository.invitations(),
      shiftRepository.assignments(),
      shiftRepository.attendance(),
      shiftRepository.timesheets(),
    ]);
    final openShifts = profile == null
        ? <ShiftSummary>[]
        : await shiftRepository.openShifts(
            location: profile.location,
            radiusKm: profile.maxDistanceKm,
            filters: filters,
          );

    return ShiftBoardState(
      openShifts: openShifts,
      myShifts: myShifts,
      applications: marketplaceResults[0] as List<ShiftApplicationSummary>,
      invitations: marketplaceResults[1] as List<ShiftInvitationSummary>,
      assignments: marketplaceResults[2] as List<ShiftAssignmentSummary>,
      attendanceEvents: marketplaceResults[3] as List<AttendanceEventSummary>,
      timesheets: marketplaceResults[4] as List<TimesheetSummary>,
      profile: profile,
      onboarding: onboarding,
      filters: filters,
      message: onboarding.canAcceptShifts
          ? filters.hasActiveFilters
                ? 'Showing filtered shifts. ${openShifts.length} match${openShifts.length == 1 ? "" : "es"} found.'
                : 'Live board connected to your saved radius.'
          : 'Complete approval before applying for live shifts.',
    );
  }

  Future<void> refresh() async {
    final filters = state.value?.filters ?? const ShiftSearchFilters();
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _load(filters));
  }

  Future<void> applyFilters(ShiftSearchFilters filters) async {
    final current = state.value;
    if (current == null) {
      state = await AsyncValue.guard(() => _load(filters));
      return;
    }
    state = AsyncData(
      current.copyWith(
        filters: filters,
        isSearching: true,
        clearSearchError: true,
      ),
    );
    try {
      state = AsyncData((await _load(filters)).copyWith(isSearching: false));
    } catch (error) {
      state = AsyncData(
        current.copyWith(
          filters: filters,
          isSearching: false,
          searchError: apiErrorMessage(
            error,
            'Shift search could not be refreshed.',
          ),
        ),
      );
    }
  }

  Future<void> applyToShift(String shiftId) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    if (!current.onboarding.canAcceptShifts) {
      throw const ApiException(
        'Worker onboarding must be approved before applying to shifts.',
      );
    }

    await ref.read(shiftRepositoryProvider).apply(shiftId);
    state = AsyncData(await _load());
  }

  Future<void> respondToInvitation(
    String invitationId,
    ShiftInvitationStatus status,
  ) async {
    await ref
        .read(shiftRepositoryProvider)
        .respondToInvitation(invitationId, status);
    state = AsyncData(await _load());
  }

  Future<void> recordAttendance(
    String shiftId,
    AttendanceEventType type,
  ) async {
    final location = state.value?.profile?.location;
    await ref
        .read(shiftRepositoryProvider)
        .recordAttendance(shiftId, type, location: location);
    state = AsyncData(await _load());
  }

  Future<void> submitTimesheet(ShiftSummary shift) async {
    await ref.read(shiftRepositoryProvider).submitTimesheet(shift);
    state = AsyncData(await _load());
  }

  Future<void> _connectRealtime() async {
    final token = await ref.read(secureTokenStoreProvider).readAccessToken();
    if (token == null || token.isEmpty) {
      return;
    }
    final config = ref.read(appConfigProvider);
    _socket = io.io(
      '${config.apiBaseUrl}/shifts',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );
    _socket
      ?..on('shift.created', (_) => refresh())
      ..connect();
  }
}

final shiftBoardControllerProvider =
    AsyncNotifierProvider<ShiftBoardController, ShiftBoardState>(
      ShiftBoardController.new,
    );
