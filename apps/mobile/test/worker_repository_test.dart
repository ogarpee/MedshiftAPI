import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/features/onboarding/data/onboarding_draft_store.dart';
import 'package:medshift_mobile/src/features/worker/data/worker_repository.dart';

void main() {
  test(
    'final onboarding save always uses the authenticated me endpoint',
    () async {
      final requests = <RequestOptions>[];
      final dio = _capturingDio(requests);
      final repository = WorkerRepository(dio);

      final profile = await repository.saveProfile(
        draft: const WorkerOnboardingDraft(
          firstName: 'Amara',
          lastName: 'Cole',
        ),
      );

      expect(profile.id, 'profile-1');
      expect(requests.single.method, 'PUT');
      expect(requests.single.path, '/worker-profiles/me');
      expect((requests.single.data as Map)['firstName'], 'Amara');
      expect((requests.single.data as Map).containsKey('profileId'), isFalse);
    },
  );

  test('draft synchronization does not send a cached profile ID', () async {
    final requests = <RequestOptions>[];
    final repository = WorkerRepository(_capturingDio(requests));

    await repository.saveOnboardingDraft(
      draft: const WorkerOnboardingDraft(firstName: 'Amara'),
      currentStep: 2,
    );

    expect(requests.single.method, 'PUT');
    expect(requests.single.path, '/worker-profiles/onboarding-draft');
    final body = requests.single.data as Map;
    expect(body['currentStep'], 2);
    expect(body.containsKey('profileId'), isFalse);
  });

  test('server draft accepts a serialized current step', () {
    final draft = ServerWorkerOnboardingDraft.fromJson({
      'currentStep': '3',
      'data': {
        'firstName': 'Amara',
        'preferences': {'maxDistanceKm': '35'},
      },
    });

    expect(draft.currentStep, 3);
    expect(draft.draft.firstName, 'Amara');
    expect(draft.draft.maxDistanceKm, 35);
  });

  test('empty server draft response loads as no saved draft', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response<dynamic>(requestOptions: options, statusCode: 200, data: ''),
        ),
      ),
    );

    final draft = await WorkerRepository(dio).onboardingDraft();

    expect(draft, isNull);
  });

  test('empty profile response loads as no submitted profile', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 204,
          ),
        ),
      ),
    );

    final profile = await WorkerRepository(dio).profile();

    expect(profile, isNull);
  });
}

Dio _capturingDio(List<RequestOptions> requests) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        requests.add(options);
        if (options.path == '/worker-profiles/me') {
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
        handler.resolve(
          Response<void>(requestOptions: options, statusCode: 200),
        );
      },
    ),
  );
  return dio;
}
