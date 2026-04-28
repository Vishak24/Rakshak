class SosAlert {
  final String id;
  final String zoneName;
  final String riskLevel;
  final DateTime timestamp;
  final String status;
  final double? lat;
  final double? lng;
  final String? pincode;
  final String? sosId;

  const SosAlert({
    required this.id,
    required this.zoneName,
    required this.riskLevel,
    required this.timestamp,
    required this.status,
    this.lat,
    this.lng,
    this.pincode,
    this.sosId,
  });

  factory SosAlert.fromJson(Map<String, dynamic> json) {
    return SosAlert(
      id:        json['sos_id']?.toString() ?? json['id']?.toString() ?? '',
      zoneName:  json['zone_name']?.toString() ?? json['pincode']?.toString() ?? 'Unknown Zone',
      riskLevel: json['risk_level']?.toString() ?? 'HIGH',
      timestamp: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      status:    json['status']?.toString() ?? 'dispatched',
      lat:       (json['latitude'] as num?)?.toDouble(),
      lng:       (json['longitude'] as num?)?.toDouble(),
      pincode:   json['pincode']?.toString(),
      sosId:     json['sos_id']?.toString(),
    );
  }

  // No mock fallback — return empty list when backend is unavailable
  static List<SosAlert> mockAlerts() => [];
}
