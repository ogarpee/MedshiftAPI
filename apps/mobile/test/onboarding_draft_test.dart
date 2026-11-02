import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/core/models/medshift_models.dart';
import 'package:medshift_mobile/src/features/onboarding/data/onboarding_draft_store.dart';

void main() {
  test('worker onboarding draft maps to worker profile API payload', () {
    const draft = WorkerOnboardingDraft(
      firstName: 'Sarah',
      lastName: 'Jones',
      title: ClinicalRole.hca,
      latitude: 51.0447,
      longitude: -114.0719,
      maxDistanceKm: 25,
      documents: [
        WorkerDocument(
          id: 'id-1',
          category: WorkerDocumentCategory.governmentId,
          cloudinaryPublicId: 'medshift/workers/1/id-1',
        ),
        WorkerDocument(
          id: 'cert-1',
          category: WorkerDocumentCategory.professionalCertificate,
          cloudinaryPublicId: 'medshift/workers/1/cert-1',
        ),
        WorkerDocument(
          id: 'check-1',
          category: WorkerDocumentCategory.backgroundCheck,
          cloudinaryPublicId: 'medshift/workers/1/check-1',
        ),
      ],
    );

    final payload = draft.toApiPayload();

    expect(payload['firstName'], 'Sarah');
    expect(payload['title'], 'HCA');
    expect(payload['location']['coordinates'], [-114.0719, 51.0447]);
    expect((payload['documents'] as List).length, 3);
    expect((payload['documents'] as List).first['category'], 'GOVERNMENT_ID');
    expect(payload.containsKey('backgroundCheck'), isFalse);
  });

  test('readable enum formats API constants', () {
    expect(readableEnum('PENDING_REVIEW'), 'Pending Review');
  });

  test('server onboarding payload restores fields and active step state', () {
    final draft = WorkerOnboardingDraft.fromApiPayload({
      'firstName': 'Amara',
      'lastName': 'Cole',
      'title': 'RN',
      'location': {
        'type': 'Point',
        'coordinates': [-113.49, 53.54],
      },
      'preferences': {
        'maxDistanceKm': 40,
        'availableDays': ['FRIDAY'],
        'preferredShiftTypes': ['NIGHT'],
      },
      'documents': const [],
    });
    final stored = StoredWorkerOnboardingDraft(
      draft: draft,
      currentStep: 3,
      pendingSync: true,
    );
    final restored = StoredWorkerOnboardingDraft.fromJson(stored.toJson());

    expect(restored.currentStep, 3);
    expect(restored.pendingSync, isTrue);
    expect(restored.draft.firstName, 'Amara');
    expect(restored.draft.title, ClinicalRole.rn);
    expect(restored.draft.longitude, -113.49);
    expect(restored.draft.preferredShiftTypes, ['NIGHT']);
  });

  test('legacy draft values decode without blocking onboarding', () {
    final restored = StoredWorkerOnboardingDraft.fromJson({
      'currentStep': '2',
      'pendingSync': true,
      'data': {
        'firstName': 'Amara',
        'latitude': '53.54',
        'longitude': '-113.49',
        'maxDistanceKm': '40',
        'availableDays': ['FRIDAY'],
        'preferredShiftTypes': ['NIGHT'],
      },
    });

    expect(restored.currentStep, 2);
    expect(restored.draft.latitude, 53.54);
    expect(restored.draft.longitude, -113.49);
    expect(restored.draft.maxDistanceKm, 40);
  });

  test('unwrapped saved drafts migrate without losing progress', () {
    final restored = StoredWorkerOnboardingDraft.fromJson({
      'firstName': 'Amara',
      'lastName': 'Cole',
      'latitude': 53.54,
      'longitude': -113.49,
      'maxDistanceKm': 35,
    });

    expect(restored.pendingSync, isTrue);
    expect(restored.draft.firstName, 'Amara');
    expect(restored.draft.lastName, 'Cole');
    expect(restored.draft.maxDistanceKm, 35);
  });

  test('profile decoding tolerates serialized numeric document metadata', () {
    final profile = WorkerProfile.fromJson({
      'id': 'profile-1',
      'firstName': 'Amara',
      'lastName': 'Cole',
      'title': 'RN',
      'location': {
        'type': 'Point',
        'coordinates': [-113.49, 53.54],
      },
      'preferences': {
        'maxDistanceKm': '40',
        'availableDays': ['FRIDAY'],
        'preferredShiftTypes': ['NIGHT'],
      },
      'documents': [
        {
          'id': 'document-1',
          'category': 'GOVERNMENT_ID',
          'version': '123',
          'bytes': '2048',
        },
      ],
      'onboarding': {'verificationStatus': 'PENDING_REVIEW'},
      'stats': {'averageRating': '4.8', 'totalShiftsCompleted': '12'},
    });

    expect(profile.maxDistanceKm, 40);
    expect(profile.documents.single.version, 123);
    expect(profile.documents.single.bytes, 2048);
    expect(profile.averageRating, 4.8);
    expect(profile.totalShiftsCompleted, 12);
  });
}
