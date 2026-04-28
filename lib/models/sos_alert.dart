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
    final rawZoneName = json['zone_name']?.toString();
    final pincode     = json['pincode']?.toString();

    // If zone_name is a raw 6-digit pincode, resolve it to an area name
    String resolvedName;
    if (rawZoneName != null && RegExp(r'^\d{6}$').hasMatch(rawZoneName)) {
      resolvedName = '${_pincodeNames[rawZoneName] ?? rawZoneName} ($rawZoneName)';
    } else {
      resolvedName = rawZoneName ?? pincode ?? 'Unknown Zone';
    }

    return SosAlert(
      id:        json['sos_id']?.toString() ?? json['id']?.toString() ?? '',
      zoneName:  resolvedName,
      riskLevel: json['risk_level']?.toString() ?? 'HIGH',
      timestamp: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      status:    json['status']?.toString() ?? 'dispatched',
      lat:       (json['latitude'] as num?)?.toDouble(),
      lng:       (json['longitude'] as num?)?.toDouble(),
      pincode:   pincode,
      sosId:     json['sos_id']?.toString(),
    );
  }

  // Pincode → area name lookup (matches judge_mode_overlay.dart dropdown)
  static const Map<String, String> _pincodeNames = {
    '600001': 'Parrys Corner',  '600002': 'Sowcarpet',
    '600003': 'Park Town',      '600004': 'Mylapore',
    '600005': 'Chintadripet',   '600006': 'Chepauk',
    '600007': 'Perambur',       '600008': 'Chepauk',
    '600009': 'Kilpauk',        '600010': 'Vepery',
    '600011': 'Royapuram',      '600012': 'Tondiarpet',
    '600013': 'Tiruvottiyur',   '600015': 'Padi',
    '600017': 'T. Nagar',       '600018': 'Kodambakkam',
    '600019': 'Ennore',         '600020': 'Anna Nagar',
    '600024': 'Ashok Nagar',    '600028': 'Nungambakkam',
    '600029': 'Aminjikarai',    '600032': 'Vadapalani',
    '600033': 'Saidapet',       '600034': 'Teynampet',
    '600035': 'Alandur',        '600036': 'St. Thomas Mount',
    '600040': 'Virugambakkam',  '600042': 'Thiruvanmiyur',
    '600044': 'Tambaram',       '600045': 'Pallavaram',
    '600050': 'Arumbakkam',     '600053': 'Ambattur',
    '600056': 'Porur',          '600058': 'Washermanpet',
    '600061': 'Chromepet',      '600064': 'Vandalur',
    '600078': 'Valasaravakkam', '600081': 'Manali',
    '600082': 'Madhavaram',     '600083': 'Villivakkam',
    '600090': 'Velachery',      '600096': 'OMR',
    '600099': 'Poonamallee',    '600118': 'Kathivakkam',
  };

  // No mock fallback — return empty list when backend is unavailable
  static List<SosAlert> mockAlerts() => [];
}
