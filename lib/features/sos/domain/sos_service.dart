/// SOS service interface
abstract class SosService {
  /// Trigger SOS alert with optional pincode override (from Judge Mode)
  Future<bool> triggerSos({int? pincode});

  /// Cancel SOS alert
  Future<bool> cancelSos();

  /// Get SOS status
  Future<Map<String, dynamic>> getSosStatus();

  /// Check if SOS is active
  Future<bool> isSosActive();
}
