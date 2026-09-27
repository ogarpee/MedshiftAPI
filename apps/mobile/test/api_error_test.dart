import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/core/network/api_client.dart';

void main() {
  test('api exception uses stable message', () {
    expect(
      apiErrorMessage(const ApiException('Approval required'), 'Fallback'),
      'Approval required',
    );
  });
}
