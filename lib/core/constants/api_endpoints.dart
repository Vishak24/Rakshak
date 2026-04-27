/// API Endpoints for Rakshak Sentinel
class ApiEndpoints {
  ApiEndpoints._();

  static const _base =
      'https://aksdwfbnn5.execute-api.ap-south-1.amazonaws.com';

  static const predict  = '$_base/predict';
  static const sos      = '$_base/sos';       // stub
  static const user     = '$_base/user';      // stub
  static const events   = '$_base/incidents'; // stub
}
