import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/features/onboarding/data/onboarding_draft_store.dart';
import 'package:medshift_mobile/src/features/onboarding/state/worker_onboarding_controller.dart';
import 'package:medshift_mobile/src/features/worker/data/worker_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('save and continue flushes the newest draft and target step', () async {
    SharedPreferences.setMockInitialValues({});
    final serverSaves = <Map<String, dynamic>>[];
    final repository = WorkerRepository(_onboardingDio(serverSaves));
    final container = ProviderContainer(
      overrides: [workerRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    final initial = await container.read(
      workerOnboardingControllerProvider.future,
    );
    final controller = container.read(
      workerOnboardingControllerProvider.notifier,
    );

    await controller.updateDraft(
      initial.draft.copyWith(firstName: 'Older value'),
    );
    final newest = initial.draft.copyWith(firstName: 'Latest value');
    await controller.saveAndContinue(newest, 1);

    final state = container.read(workerOnboardingControllerProvider).value!;
    final stored = await OnboardingDraftStore().read('worker-1');
    expect(state.step, 1);
    expect(state.draft.firstName, 'Latest value');
    expect(state.saveState, OnboardingDraftSaveState.saved);
    expect(serverSaves, hasLength(1));
    expect(serverSaves.single['currentStep'], 1);
    expect((serverSaves.single['data'] as Map)['firstName'], 'Latest value');
    expect(stored?.currentStep, 1);
    expect(stored?.draft.firstName, 'Latest value');
    expect(stored?.pendingSync, isFalse);
  });

  test('draft request failure does not block an existing profile', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [
        workerRepositoryProvider.overrideWithValue(
          WorkerRepository(_onboardingDio([], draftFails: true)),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = await container.read(
      workerOnboardingControllerProvider.future,
    );

    expect(state.profile?.id, 'profile-1');
    expect(state.step, 4);
    expect(state.profileLoadBlocked, isFalse);
    expect(state.loadNotice, contains('could not be checked'));
  });

  test(
    'profile failure preserves device progress and blocks submission',
    () async {
      SharedPreferences.setMockInitialValues({});
      await OnboardingDraftStore().write(
        'worker-1',
        const StoredWorkerOnboardingDraft(
          draft: WorkerOnboardingDraft(firstName: 'Device draft'),
          currentStep: 2,
        ),
      );
      final container = ProviderContainer(
        overrides: [
          workerRepositoryProvider.overrideWithValue(
            WorkerRepository(_onboardingDio([], profileFails: true)),
          ),
        ],
      );
      addTearDown(container.dispose);

      final state = await container.read(
        workerOnboardingControllerProvider.future,
      );

      expect(state.draft.firstName, 'Device draft');
      expect(state.step, 2);
      expect(state.profileLoadBlocked, isTrue);
      expect(state.loadNotice, contains('temporarily unavailable'));
    },
  );

  test(
    'pending device draft renders before background sync completes',
    () async {
      SharedPreferences.setMockInitialValues({});
      await OnboardingDraftStore().write(
        'worker-1',
        const StoredWorkerOnboardingDraft(
          draft: WorkerOnboardingDraft(firstName: 'Offline progress'),
          currentStep: 1,
          pendingSync: true,
        ),
      );
      final saveGate = Completer<void>();
      final container = ProviderContainer(
        overrides: [
          workerRepositoryProvider.overrideWithValue(
            WorkerRepository(_onboardingDio([], saveGate: saveGate)),
          ),
        ],
      );
      addTearDown(container.dispose);

      final state = await container.read(
        workerOnboardingControllerProvider.future,
      );

      expect(state.draft.firstName, 'Offline progress');
      expect(state.step, 1);
      expect(state.saveState, OnboardingDraftSaveState.device);
      saveGate.complete();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(
        container.read(workerOnboardingControllerProvider).value?.saveState,
        OnboardingDraftSaveState.saved,
      );
    },
  );

  test('new worker with no profile or draft opens identity step', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [
        workerRepositoryProvider.overrideWithValue(
          WorkerRepository(_onboardingDio([], hasProfile: false)),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = await container.read(
      workerOnboardingControllerProvider.future,
    );

    expect(state.profile, isNull);
    expect(state.profileLoadBlocked, isFalse);
    expect(state.step, 0);
  });

  test('malformed server draft falls back to canonical profile', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [
        workerRepositoryProvider.overrideWithValue(
          WorkerRepository(_onboardingDio([], draftResponse: const [])),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = await container.read(
      workerOnboardingControllerProvider.future,
    );

    expect(state.profile?.id, 'profile-1');
    expect(state.step, 4);
    expect(state.profileLoadBlocked, isFalse);
  });
}

Dio _onboardingDio(
  List<Map<String, dynamic>> serverSaves, {
  bool draftFails = false,
  bool profileFails = false,
  bool hasProfile = true,
  Object? draftResponse = '',
  Completer<void>? saveGate,
}) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/auth/me') {
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 200,
              data: {'sub': 'worker-1'},
            ),
          );
          return;
        }
        if (options.path == '/worker-profiles/onboarding-status') {
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'profileId': hasProfile ? 'profile-1' : null,
                'verificationStatus': hasProfile
                    ? 'PENDING_REVIEW'
                    : 'INCOMPLETE',
              },
            ),
          );
          return;
        }
        if (options.path == '/worker-profiles/me') {
          if (profileFails) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response<void>(
                  requestOptions: options,
                  statusCode: 500,
                ),
              ),
            );
            return;
          }
          if (!hasProfile) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response<void>(
                  requestOptions: options,
                  statusCode: 404,
                ),
              ),
            );
            return;
          }
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'id': 'profile-1',
                'firstName': 'Amara',
                'lastName': 'Cole',
                'title': 'HCA',
                'location': {
                  'type': 'Point',
                  'coordinates': [-114.0719, 51.0447],
                },
                'preferences': {
                  'maxDistanceKm': 25,
                  'availableDays': ['MONDAY'],
                  'preferredShiftTypes': ['DAY'],
                },
                'documents': <dynamic>[],
                'onboarding': {'verificationStatus': 'PENDING_REVIEW'},
              },
            ),
          );
          return;
        }
        if (options.path == '/worker-profiles/onboarding-draft' &&
            options.method == 'GET') {
          if (draftFails) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response<void>(
                  requestOptions: options,
                  statusCode: 500,
                ),
              ),
            );
            return;
          }
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: draftResponse,
            ),
          );
          return;
        }
        if (options.path == '/worker-profiles/onboarding-draft' &&
            options.method == 'PUT') {
          Future<void>(() async {
            if (saveGate != null) await saveGate.future;
            serverSaves.add(Map<String, dynamic>.from(options.data as Map));
            handler.resolve(
              Response<void>(requestOptions: options, statusCode: 200),
            );
          });
          return;
        }
        handler.reject(
          DioException(
            requestOptions: options,
            message: 'Unexpected request: ${options.method} ${options.path}',
          ),
        );
      },
    ),
  );
  return dio;
}
