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
      credentialType: 'HCA certificate',
      credentialUrl: 'https://res.cloudinary.com/demo/document.pdf',
      backgroundConsent: true,
    );

    final payload = draft.toApiPayload();

    expect(payload['firstName'], 'Sarah');
    expect(payload['title'], 'HCA');
    expect(payload['location']['coordinates'], [-114.0719, 51.0447]);
    expect(
      payload['credentials'].single['documentUrl'],
      contains('cloudinary'),
    );
  });

  test('readable enum formats API constants', () {
    expect(readableEnum('PENDING_REVIEW'), 'Pending Review');
  });
}
