import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../worker/data/worker_repository.dart';
import '../data/onboarding_draft_store.dart';

class WorkerOnboardingViewState {
  const WorkerOnboardingViewState({
    required this.draft,
    this.profile,
    this.status = const OnboardingState(
      verificationStatus: OnboardingStatus.incomplete,
    ),
    this.step = 0,
  });

  final WorkerOnboardingDraft draft;
  final WorkerProfile? profile;
  final OnboardingState status;
  final int step;

  WorkerOnboardingViewState copyWith({
    WorkerOnboardingDraft? draft,
    WorkerProfile? profile,
    OnboardingState? status,
    int? step,
  }) {
    return WorkerOnboardingViewState(
      draft: draft ?? this.draft,
      profile: profile ?? this.profile,
      status: status ?? this.status,
      step: step ?? this.step,
    );
  }
}

class WorkerOnboardingController
    extends AsyncNotifier<WorkerOnboardingViewState> {
  @override
  Future<WorkerOnboardingViewState> build() async {
    final draftStore = ref.watch(onboardingDraftStoreProvider);
    final repository = ref.watch(workerRepositoryProvider);
    var draft = await draftStore.read();
    final status = await repository.onboardingStatus();
    final profile = await repository.profile();
    if (profile != null) {
      draft = WorkerOnboardingDraft.fromProfile(profile);
      await draftStore.write(draft);
    }
    return WorkerOnboardingViewState(
      draft: draft,
      profile: profile,
      status: status,
    );
  }

  Future<void> updateDraft(WorkerOnboardingDraft draft) async {
    await ref.read(onboardingDraftStoreProvider).write(draft);
    final current = state.value;
    if (current != null) {
      state = AsyncData(current.copyWith(draft: draft));
    }
  }

  void setStep(int step) {
    final current = state.value;
    if (current != null) {
      state = AsyncData(current.copyWith(step: step));
    }
  }

  Future<void> submit() async {
    final current = state.value;
    if (current == null) {
      return;
    }
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final profile = await ref
          .read(workerRepositoryProvider)
          .saveProfile(draft: current.draft, profileId: current.profile?.id);
      await ref.read(onboardingDraftStoreProvider).clear();
      final status = await ref
          .read(workerRepositoryProvider)
          .onboardingStatus();
      return current.copyWith(profile: profile, status: status);
    });
  }
}

final workerOnboardingControllerProvider =
    AsyncNotifierProvider<
      WorkerOnboardingController,
      WorkerOnboardingViewState
    >(WorkerOnboardingController.new);
