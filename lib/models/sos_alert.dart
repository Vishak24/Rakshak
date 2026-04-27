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

  // Mock alerts for fallback
  static List<SosAlert> mockAlerts() => [
    SosAlert(
      id: 'mock-001',
      zoneName: 'Mylapore',
      riskLevel: 'HIGH',
      timestamp: DateTime.now().subtract(const Duration(minutes: 3)),
      status: 'dispatched',
      lat: 13.0339,
      lng: 80.2707,
      pincode: '600004',
      sosId: 'mock-001',
    ),
    SosAlert(
      id: 'mock-002',
      zoneName: 'T. Nagar',
      riskLevel: 'HIGH',
      timestamp: DateTime.now().subtract(const Duration(minutes: 7)),
      status: 'dispatched',
      lat: 13.0350,
      lng: 80.2323,
      pincode: '600017',
      sosId: 'mock-002',
    ),
  ];
}
