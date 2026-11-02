import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../auth/state/auth_controller.dart';
import '../../worker/data/worker_repository.dart';
import '../data/onboarding_draft_store.dart';

enum OnboardingDraftSaveState { idle, saving, saved, device, error }

class WorkerOnboardingViewState {
  const WorkerOnboardingViewState({
    required this.draft,
    required this.userId,
    this.profile,
    this.baseline,
    this.status = const OnboardingState(
      verificationStatus: OnboardingStatus.incomplete,
    ),
    this.step = 0,
    this.saveState = OnboardingDraftSaveState.idle,
    this.syncError,
    this.loadNotice,
    this.profileLoadBlocked = false,
  });

  final WorkerOnboardingDraft draft;
  final String userId;
  final WorkerProfile? profile;
  final WorkerOnboardingDraft? baseline;
  final OnboardingState status;
  final int step;
  final OnboardingDraftSaveState saveState;
  final String? syncError;
  final String? loadNotice;
  final bool profileLoadBlocked;

  WorkerOnboardingViewState copyWith({
    WorkerOnboardingDraft? draft,
    WorkerProfile? profile,
    WorkerOnboardingDraft? baseline,
    OnboardingState? status,
    int? step,
    OnboardingDraftSaveState? saveState,
    String? syncError,
    String? loadNotice,
    bool? profileLoadBlocked,
    bool clearSyncError = false,
    bool clearLoadNotice = false,
  }) {
    return WorkerOnboardingViewState(
      draft: draft ?? this.draft,
      userId: userId,
      profile: profile ?? this.profile,
      baseline: baseline ?? this.baseline,
      status: status ?? this.status,
      step: step ?? this.step,
      saveState: saveState ?? this.saveState,
      syncError: clearSyncError ? null : syncError ?? this.syncError,
      loadNotice: clearLoadNotice ? null : loadNotice ?? this.loadNotice,
      profileLoadBlocked: profileLoadBlocked ?? this.profileLoadBlocked,
    );
  }
}

class WorkerOnboardingController
    extends AsyncNotifier<WorkerOnboardingViewState> {
  Timer? _saveTimer;
  Future<void> _localWriteQueue = Future<void>.value();
  Future<void> _syncQueue = Future<void>.value();
  int _revision = 0;

  @override
  Future<WorkerOnboardingViewState> build() async {
    ref.onDispose(() => _saveTimer?.cancel());
    final draftStore = ref.watch(onboardingDraftStoreProvider);
    final repository = ref.watch(workerRepositoryProvider);
    var userId = '';
    try {
      final auth = await ref.watch(authControllerProvider.future);
      userId = auth.user?.id ?? auth.session?.user.id ?? '';
    } catch (_) {
      // The authenticated API remains a safe fallback if session restoration
      // has not completed yet (or a platform token store is unavailable).
    }
    if (userId.isEmpty) {
      userId = await repository.currentUserId();
    }
    if (userId.isEmpty) {
      throw const ApiException(
        'Your session could not be identified. Sign in again.',
      );
    }
    final local = await draftStore.read(userId);
    final statusFuture = _capture(repository.onboardingStatus());
    final profileFuture = _capture(repository.profile());
    final serverFuture = _capture(repository.onboardingDraft());
    final statusResult = await statusFuture;
    final profileResult = await profileFuture;
    final serverResult = await serverFuture;
    final profile = profileResult.value;
    final server = serverResult.value;
    final status = statusResult.value ?? _statusFromProfile(profile);
    final profileLoadBlocked =
        profileResult.error != null ||
        (statusResult.error != null && profile == null) ||
        (status.profileId?.isNotEmpty == true && profile == null);
    final baseline = profile == null
        ? null
        : WorkerOnboardingDraft.fromProfile(profile);

    late WorkerOnboardingDraft draft;
    var step = 0;
    var saveState = OnboardingDraftSaveState.idle;
    String? syncError;
    String? loadNotice;
    var shouldSyncLocal = false;
    if (local?.pendingSync == true) {
      draft = _reconcileDocuments(local!.draft, baseline);
      step = local.currentStep;
      saveState = OnboardingDraftSaveState.device;
      shouldSyncLocal = true;
    } else if (server != null) {
      draft = _reconcileDocuments(server.draft, baseline);
      step = server.currentStep;
      saveState = OnboardingDraftSaveState.saved;
    } else if (baseline != null) {
      draft = baseline;
      step = 4;
      saveState = OnboardingDraftSaveState.saved;
    } else if (local != null) {
      draft = _reconcileDocuments(local.draft, baseline);
      step = local.currentStep;
      saveState = OnboardingDraftSaveState.device;
      shouldSyncLocal = true;
    } else {
      draft = const WorkerOnboardingDraft();
    }

    if (profileLoadBlocked) {
      loadNotice =
          'Your submitted profile is temporarily unavailable. Your device progress is safe.';
    } else if (serverResult.error != null) {
      loadNotice =
          'Saved onboarding progress could not be checked. You can continue on this device.';
    } else if (statusResult.error != null) {
      loadNotice =
          'Your verification status could not be refreshed. You can continue editing.';
    }
    if (serverResult.error != null &&
        saveState == OnboardingDraftSaveState.device) {
      syncError = 'Draft synchronization will retry automatically.';
    }

    await draftStore.write(
      userId,
      StoredWorkerOnboardingDraft(
        draft: draft,
        currentStep: step,
        pendingSync: saveState == OnboardingDraftSaveState.device,
      ),
    );
    final resolved = WorkerOnboardingViewState(
      draft: draft,
      userId: userId,
      profile: profile,
      baseline: baseline,
      status: status,
      step: step,
      saveState: saveState,
      syncError: syncError,
      loadNotice: loadNotice,
      profileLoadBlocked: profileLoadBlocked,
    );
    if (shouldSyncLocal) {
      Future<void>.delayed(Duration.zero, () async {
        if (!ref.mounted) return;
        await syncNow();
      });
    }
    return resolved;
  }

  Future<void> updateDraft(WorkerOnboardingDraft draft) async {
    final current = state.value;
    if (current == null) return;
    await _saveLocal(
      current.copyWith(
        draft: draft,
        saveState: OnboardingDraftSaveState.saving,
        clearSyncError: true,
      ),
    );
    _scheduleSync();
  }

  Future<void> setStep(int step) async {
    final current = state.value;
    if (current == null) return;
    await saveAndContinue(current.draft, step);
  }

  Future<void> saveAndContinue(WorkerOnboardingDraft draft, int step) async {
    _saveTimer?.cancel();
    final current = state.value;
    if (current == null) return;
    await _saveLocal(
      current.copyWith(
        draft: draft,
        step: step.clamp(0, 4),
        saveState: OnboardingDraftSaveState.saving,
        clearSyncError: true,
      ),
    );
    await syncNow();
  }

  Future<void> syncNow() async {
    _saveTimer?.cancel();
    final current = state.value;
    if (current == null) return;
    final revision = _revision;
    state = AsyncData(
      current.copyWith(saveState: OnboardingDraftSaveState.saving),
    );
    final queuedSync = _syncQueue.then((_) => _syncSnapshot(current, revision));
    _syncQueue = queuedSync;
    await queuedSync;
  }

  Future<void> _syncSnapshot(
    WorkerOnboardingViewState snapshot,
    int revision,
  ) async {
    try {
      await ref
          .read(workerRepositoryProvider)
          .saveOnboardingDraft(
            draft: snapshot.draft,
            currentStep: snapshot.step,
          );
      if (revision != _revision) return;
      await _queueLocalWrite(snapshot, pendingSync: false);
      if (revision != _revision) return;
      final latest = state.value;
      if (latest != null) {
        state = AsyncData(
          latest.copyWith(
            saveState: OnboardingDraftSaveState.saved,
            clearSyncError: true,
          ),
        );
      }
    } catch (error) {
      if (revision != _revision) return;
      final latest = state.value;
      if (latest != null) {
        state = AsyncData(
          latest.copyWith(
            saveState: OnboardingDraftSaveState.device,
            syncError: apiErrorMessage(
              error,
              'Draft could not be synchronized.',
            ),
          ),
        );
      }
    }
  }

  Future<void> submit() async {
    _saveTimer?.cancel();
    await _localWriteQueue;
    await _syncQueue;
    final current = state.value;
    if (current == null) return;
    state = const AsyncLoading();
    try {
      final repository = ref.read(workerRepositoryProvider);
      final profile = await repository.saveProfile(draft: current.draft);
      await repository.clearOnboardingDraft();
      await ref.read(onboardingDraftStoreProvider).clear(current.userId);
      final status = await repository.onboardingStatus();
      final submitted = WorkerOnboardingDraft.fromProfile(profile);
      state = AsyncData(
        current.copyWith(
          draft: submitted,
          profile: profile,
          baseline: submitted,
          status: status,
          step: 4,
          saveState: OnboardingDraftSaveState.saved,
          clearSyncError: true,
        ),
      );
    } catch (error, stackTrace) {
      state = AsyncData(
        current.copyWith(
          saveState: OnboardingDraftSaveState.device,
          syncError: apiErrorMessage(
            error,
            'Onboarding could not be submitted.',
          ),
        ),
      );
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> _saveLocal(WorkerOnboardingViewState next) async {
    _revision += 1;
    state = AsyncData(next);
    await _queueLocalWrite(next, pendingSync: true);
  }

  Future<void> _queueLocalWrite(
    WorkerOnboardingViewState snapshot, {
    required bool pendingSync,
  }) {
    final write = _localWriteQueue.then(
      (_) => ref
          .read(onboardingDraftStoreProvider)
          .write(
            snapshot.userId,
            StoredWorkerOnboardingDraft(
              draft: snapshot.draft,
              currentStep: snapshot.step,
              pendingSync: pendingSync,
            ),
          ),
    );
    _localWriteQueue = write;
    return write;
  }

  void _scheduleSync() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 700), syncNow);
  }

  WorkerOnboardingDraft _reconcileDocuments(
    WorkerOnboardingDraft draft,
    WorkerOnboardingDraft? canonical,
  ) {
    if (canonical == null) return draft;
    final canonicalById = {
      for (final document in canonical.documents) document.id: document,
    };
    return draft.copyWith(
      documents: draft.documents
          .map((document) => canonicalById[document.id] ?? document)
          .toList(),
    );
  }
}

OnboardingState _statusFromProfile(WorkerProfile? profile) {
  if (profile == null) {
    return const OnboardingState(
      verificationStatus: OnboardingStatus.incomplete,
    );
  }
  return OnboardingState(
    completed: profile.onboardingStatus == OnboardingStatus.approved,
    profileId: profile.id,
    verificationStatus: profile.onboardingStatus,
  );
}

class _LoadResult<T> {
  const _LoadResult({this.value, this.error});

  final T? value;
  final Object? error;
}

Future<_LoadResult<T>> _capture<T>(Future<T> operation) async {
  try {
    return _LoadResult<T>(value: await operation);
  } catch (error) {
    return _LoadResult<T>(error: error);
  }
}

final workerOnboardingControllerProvider =
    AsyncNotifierProvider<
      WorkerOnboardingController,
      WorkerOnboardingViewState
    >(WorkerOnboardingController.new);
