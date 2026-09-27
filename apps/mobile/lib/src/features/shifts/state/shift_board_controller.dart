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
    this.profile,
    this.onboarding = const OnboardingState(
      verificationStatus: OnboardingStatus.incomplete,
    ),
    this.filters = const ShiftSearchFilters(),
    this.message,
  });

  final List<ShiftSummary> openShifts;
  final List<ShiftSummary> myShifts;
  final WorkerProfile? profile;
  final OnboardingState onboarding;
  final ShiftSearchFilters filters;
  final String? message;

  List<ShiftSummary> get all => [...openShifts, ...myShifts];
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
      profile: profile,
      onboarding: onboarding,
      filters: filters,
      message: onboarding.canAcceptShifts
          ? filters.hasActiveFilters
                ? 'Showing filtered shifts. ${openShifts.length} match${openShifts.length == 1 ? "" : "es"} found.'
                : 'Live board connected to your saved radius.'
          : 'Complete approval before accepting live shifts.',
    );
  }

  Future<void> refresh() async {
    final filters = state.value?.filters ?? const ShiftSearchFilters();
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _load(filters));
  }

  Future<void> applyFilters(ShiftSearchFilters filters) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _load(filters));
  }

  Future<void> acceptShift(String shiftId) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    if (!current.onboarding.canAcceptShifts) {
      throw const ApiException(
        'Worker onboarding must be approved before accepting shifts.',
      );
    }

    await ref.read(shiftRepositoryProvider).accept(shiftId);
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
