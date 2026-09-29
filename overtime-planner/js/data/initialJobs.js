// Adelaide Operations - Canonical Job Archetypes
// Configured with real Adelaide municipal teams, exclusive locks, anchors, and WZTM/TPO requirements.
window.HortOpsData = window.HortOpsData || {};

window.HortOpsData.INITIAL_JOBS = [
  {
    "id": "tramline-5am",
    "name": "5am Tramline",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 5,
    "anchorWeek": 7,
    "anchorDate": "2026-02-15",
    "targetDate": "2026-02-15",
    "expectedAnnualShifts": 10,
    "startTime": "05:00 AM",
    "durationHours": 6,
    "crewSize": 5,
    "crewSizeRequired": 5,
    "preferredDay": "sunday",
    "status": "active",
    "category": "CBD Corridor",
    "color": "#10b981",
    "locationDetails": "King William Street / Victoria Square Tram Corridor",
    "notes": "Early morning safety clearance. Requires Tram Protection Order (TPO) and Work Zone Traffic Management (WZTM).",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Parks",
    "primaryTeam": "Parks",
    "secondaryTeam": "Arboriculture",
    "tertiaryTeam": "Squares",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Parks",
      "Arboriculture",
      "Squares",
      "Irrigation"
    ],
    "plantOperatorRequired": true,
    "requiresWZTM": true,
    "requiresTPO": true
  },
  {
    "id": "bundys-road",
    "name": "Bundeys Road",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 6,
    "anchorWeek": 6,
    "anchorDate": "2026-02-08",
    "targetDate": "2026-02-08",
    "expectedAnnualShifts": 8,
    "startTime": "06:30 AM",
    "durationHours": 6,
    "crewSize": 5,
    "crewSizeRequired": 5,
    "preferredDay": "sunday",
    "status": "active",
    "category": "Parklands",
    "color": "#06b6d4",
    "locationDetails": "Bundeys Road, North Adelaide / Park 10",
    "notes": "Road corridor maintenance. Work Zone Traffic Management (WZTM) required.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Parks",
    "primaryTeam": "Parks",
    "secondaryTeam": "Streetscapes",
    "tertiaryTeam": "Irrigation",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Parks",
      "Streetscapes",
      "Irrigation",
      "Squares"
    ],
    "plantOperatorRequired": false,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "sir-donald-bradman-drive",
    "name": "Sir Donald Bradman Drive",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 4,
    "anchorWeek": 6,
    "anchorDate": "2026-02-08",
    "targetDate": "2026-02-08",
    "expectedAnnualShifts": 11,
    "startTime": "06:00 AM",
    "durationHours": 6,
    "crewSize": 6,
    "crewSizeRequired": 6,
    "preferredDay": "sunday",
    "status": "active",
    "category": "CBD Corridor",
    "color": "#f59e0b",
    "locationDetails": "Sir Donald Bradman Drive median strip & verges",
    "notes": "Arterial gateway maintenance. WZTM mandatory with dynamic lane buffering.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Parks",
    "primaryTeam": "Parks",
    "secondaryTeam": "Streetscapes",
    "tertiaryTeam": "Arboriculture",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Parks",
      "Streetscapes",
      "Arboriculture",
      "Irrigation",
      "Squares"
    ],
    "plantOperatorRequired": true,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "west-terrace-median",
    "name": "West Terrace Median",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 4,
    "anchorWeek": 8,
    "anchorDate": "2026-02-22",
    "targetDate": "2026-02-22",
    "expectedAnnualShifts": 10,
    "startTime": "06:00 AM",
    "durationHours": 6,
    "crewSize": 6,
    "crewSizeRequired": 6,
    "preferredDay": "sunday",
    "status": "active",
    "category": "CBD Corridor",
    "color": "#8b5cf6",
    "locationDetails": "West Terrace Center Median (Grote St to Currie St)",
    "notes": "Major Western arterial corridor. WZTM permit required with lane closure plan.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Parks",
    "primaryTeam": "Parks",
    "secondaryTeam": "Streetscapes",
    "tertiaryTeam": "Arboriculture",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Parks",
      "Streetscapes",
      "Arboriculture",
      "Squares"
    ],
    "plantOperatorRequired": true,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "montefiore-hill",
    "name": "Montefiore Hill",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 6,
    "anchorWeek": 9,
    "anchorDate": "2026-03-01",
    "targetDate": "2026-03-01",
    "expectedAnnualShifts": 7,
    "startTime": "06:00 AM",
    "durationHours": 6,
    "crewSize": 6,
    "crewSizeRequired": 6,
    "preferredDay": "sunday",
    "status": "active",
    "category": "Parklands",
    "color": "#ec4899",
    "locationDetails": "Montefiore Hill, North Adelaide / Light's Vision",
    "notes": "Steep incline trimming and garden maintenance. Work Zone Traffic Management required.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Parks",
    "primaryTeam": "Parks",
    "secondaryTeam": "Streetscapes",
    "tertiaryTeam": "Arboriculture",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Parks",
      "Streetscapes",
      "Arboriculture",
      "Irrigation",
      "Squares"
    ],
    "plantOperatorRequired": true,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "grote-street",
    "name": "Grote Street",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 16,
    "anchorWeek": 7,
    "anchorDate": "2026-02-15",
    "targetDate": "2026-02-15",
    "expectedAnnualShifts": 3,
    "startTime": "06:00 AM",
    "durationHours": 6,
    "crewSize": 4,
    "crewSizeRequired": 4,
    "preferredDay": "sunday",
    "status": "active",
    "category": "CBD Corridor",
    "color": "#3b82f6",
    "locationDetails": "Grote Street corridor (Central Market perimeter)",
    "notes": "Urban streetscape deep clean and pruning. WZTM required.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Streetscapes",
    "primaryTeam": "Streetscapes",
    "secondaryTeam": "Parks",
    "tertiaryTeam": "Squares",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Streetscapes",
      "Parks",
      "Squares"
    ],
    "plantOperatorRequired": false,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "rundle-street-vine",
    "name": "Rundle Street Vine",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 8,
    "anchorWeek": 6,
    "anchorDate": "2026-02-08",
    "targetDate": "2026-02-08",
    "expectedAnnualShifts": 2,
    "startTime": "06:00 AM",
    "durationHours": 6,
    "crewSize": 2,
    "crewSizeRequired": 2,
    "preferredDay": "sunday",
    "status": "active",
    "category": "Specialty Horticultural",
    "color": "#14b8a6",
    "locationDetails": "Rundle Street East verandah vines and planter boxes",
    "notes": "Specialized vine training and pruning. WZTM required for pedestrian/street buffer.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Streetscapes",
    "primaryTeam": "Streetscapes",
    "secondaryTeam": "Arboriculture",
    "tertiaryTeam": "Parks",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Streetscapes",
      "Arboriculture",
      "Parks"
    ],
    "plantOperatorRequired": false,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "grenfell-greening",
    "name": "Grenfell Greening",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 12,
    "anchorWeek": 13,
    "anchorDate": "2026-03-29",
    "targetDate": "2026-03-29",
    "expectedAnnualShifts": 2,
    "startTime": "06:00 AM",
    "durationHours": 6,
    "crewSize": 4,
    "crewSizeRequired": 4,
    "preferredDay": "sunday",
    "status": "active",
    "category": "CBD Corridor",
    "color": "#eab308",
    "locationDetails": "Grenfell Street parklets & planter boxes",
    "notes": "Seasonal planting and greening refreshments.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Streetscapes",
    "primaryTeam": "Streetscapes",
    "secondaryTeam": "Parks",
    "tertiaryTeam": "Squares",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Streetscapes",
      "Parks",
      "Squares"
    ],
    "plantOperatorRequired": false,
    "requiresWZTM": false,
    "requiresTPO": false
  },
  {
    "id": "frome-street",
    "name": "Frome Street Bikeway",
    "frequencyType": "annual",
    "anchorWeek": 10,
    "targetMonth": 3,
    "expectedAnnualShifts": 1,
    "startTime": "06:00 AM",
    "durationHours": 8,
    "crewSize": 5,
    "crewSizeRequired": 5,
    "preferredDay": "sunday",
    "status": "active",
    "category": "CBD Corridor",
    "color": "#6366f1",
    "locationDetails": "Frome Street Separated Bikeway",
    "notes": "Bi-annual garden verge and planter hedge maintenance along cycle corridor.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Streetscapes",
    "primaryTeam": "Streetscapes",
    "secondaryTeam": "Parks",
    "tertiaryTeam": "Arboriculture",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Streetscapes",
      "Parks",
      "Arboriculture"
    ],
    "plantOperatorRequired": false,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "hindley-street",
    "name": "Hindley Street Precinct",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 8,
    "anchorWeek": 11,
    "anchorDate": "2026-03-15",
    "targetDate": "2026-03-15",
    "expectedAnnualShifts": 6,
    "startTime": "05:30 AM",
    "durationHours": 6,
    "crewSize": 4,
    "crewSizeRequired": 4,
    "preferredDay": "sunday",
    "status": "active",
    "category": "CBD Corridor",
    "color": "#ef4444",
    "locationDetails": "Hindley Street entertainment precinct verges",
    "notes": "Early morning deep clean and garden bed restoration prior to commercial trading.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Streetscapes",
    "primaryTeam": "Streetscapes",
    "secondaryTeam": "Waste and Resource Recovery",
    "tertiaryTeam": "Parks",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Streetscapes",
      "Waste and Resource Recovery",
      "Parks"
    ],
    "plantOperatorRequired": false,
    "requiresWZTM": true,
    "requiresTPO": false
  },
  {
    "id": "north-adelaide-roses",
    "name": "North Adelaide Rose Gardens",
    "frequencyType": "annual",
    "anchorWeek": 28,
    "targetMonth": 7,
    "expectedAnnualShifts": 2,
    "startTime": "07:00 AM",
    "durationHours": 6,
    "crewSize": 6,
    "crewSizeRequired": 6,
    "preferredDay": "saturday",
    "status": "active",
    "category": "Specialty Horticultural",
    "color": "#f43f5e",
    "locationDetails": "Brougham Gardens / Palmer Place Rose Collection",
    "notes": "Annual winter rose pruning and mulching intensive.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Parks",
    "primaryTeam": "Parks",
    "secondaryTeam": "Nursery",
    "tertiaryTeam": "Streetscapes",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Parks",
      "Nursery",
      "Streetscapes"
    ],
    "plantOperatorRequired": true,
    "requiresWZTM": false,
    "requiresTPO": false
  },
  {
    "id": "whitmore-square",
    "name": "Whitmore Square Community Turf",
    "frequencyType": "recurring_weeks",
    "intervalWeeks": 8,
    "anchorWeek": 12,
    "anchorDate": "2026-03-22",
    "targetDate": "2026-03-22",
    "expectedAnnualShifts": 6,
    "startTime": "07:00 AM",
    "durationHours": 6,
    "crewSize": 3,
    "crewSizeRequired": 3,
    "preferredDay": "sunday",
    "status": "active",
    "category": "Parklands",
    "color": "#10b981",
    "locationDetails": "Iparrityi / Whitmore Square center lawn",
    "notes": "Weekend aeration, turf renovation and irrigation maintenance.",
    "defaultDepartment": "Horticulture",
    "primaryDepartment": "Horticulture",
    "defaultTeam": "Squares",
    "primaryTeam": "Squares",
    "secondaryTeam": "Irrigation",
    "tertiaryTeam": "Mowing",
    "isExclusiveTeams": true,
    "exclusiveTeams": [
      "Squares",
      "Irrigation",
      "Mowing",
      "Parks"
    ],
    "plantOperatorRequired": true,
    "requiresWZTM": false,
    "requiresTPO": false
  }
];

window.HortOpsData.HISTORICAL_REAL_ASSIGNMENTS = {
  "bundys-road_2026-02-08": [
    "EMP-068",
    "EMP-004",
    "EMP-239"
  ],
  "rundle-street-vine_2026-02-08": [
    "EMP-090",
    "EMP-116"
  ],
  "sir-donald-bradman-drive_2026-02-08": [
    "EMP-199",
    "EMP-003",
    "EMP-243",
    "EMP-036",
    "EMP-234"
  ],
  "grote-street_2026-02-15": [
    "EMP-004",
    "EMP-068",
    "EMP-090",
    "EMP-021"
  ],
  "tramline-5am_2026-02-15": [
    "EMP-234",
    "EMP-199",
    "EMP-243",
    "EMP-072"
  ],
  "tramline-5am_2026-02-22": [
    "EMP-243",
    "EMP-081",
    "EMP-136",
    "EMP-206"
  ],
  "west-terrace-median_2026-02-22": [
    "EMP-036",
    "EMP-199",
    "EMP-003",
    "EMP-090",
    "EMP-004"
  ],
  "montefiore-hill_2026-03-01": [
    "EMP-090",
    "EMP-068",
    "EMP-014",
    "EMP-081",
    "EMP-199",
    "EMP-116"
  ],
  "sir-donald-bradman-drive_2026-03-15": [
    "EMP-116",
    "EMP-003",
    "EMP-117",
    "EMP-234",
    "EMP-081",
    "EMP-031"
  ],
  "west-terrace-median_2026-03-22": [
    "EMP-090",
    "EMP-021",
    "EMP-116",
    "EMP-206",
    "EMP-014",
    "EMP-155"
  ],
  "grenfell-greening_2026-03-29": [
    "EMP-068",
    "EMP-004",
    "EMP-199",
    "EMP-031"
  ],
  "tramline-5am_2026-03-29": [
    "EMP-117",
    "EMP-081",
    "EMP-072",
    "EMP-243"
  ],
  "bundys-road_2026-04-05": [],
  "sir-donald-bradman-drive_2026-04-05": [],
  "west-terrace-median_2026-04-19": [
    "EMP-234",
    "EMP-014",
    "EMP-004",
    "EMP-068",
    "EMP-081"
  ],
  "sir-donald-bradman-drive_2026-05-03": [
    "EMP-090",
    "EMP-003",
    "EMP-116",
    "EMP-031",
    "EMP-199",
    "EMP-039"
  ],
  "tramline-5am_2026-05-10": [
    "EMP-036",
    "EMP-239",
    "EMP-072",
    "EMP-243"
  ],
  "west-terrace-median_2026-05-17": [
    "EMP-021",
    "EMP-090",
    "EMP-206",
    "EMP-199",
    "EMP-234",
    "EMP-243",
    "EMP-117"
  ],
  "montefiore-hill_2026-05-24": [
    "EMP-004",
    "EMP-068",
    "EMP-031",
    "EMP-234",
    "EMP-116"
  ],
  "bundys-road_2026-05-31": [
    "EMP-003",
    "EMP-021",
    "EMP-036",
    "EMP-199",
    "EMP-014"
  ],
  "sir-donald-bradman-drive_2026-05-31": [
    "EMP-004",
    "EMP-068",
    "EMP-243",
    "EMP-116",
    "EMP-239",
    "EMP-234"
  ],
  "grote-street_2026-06-07": [
    "EMP-090",
    "EMP-003",
    "EMP-234",
    "EMP-117"
  ],
  "west-terrace-median_2026-06-14": [
    "EMP-021",
    "EMP-004",
    "EMP-117",
    "EMP-116",
    "EMP-036",
    "EMP-199"
  ],
  "tramline-5am_2026-06-21": [
    "EMP-081",
    "EMP-072",
    "EMP-206",
    "EMP-243"
  ],
  "sir-donald-bradman-drive_2026-06-28": [
    "EMP-068",
    "EMP-090",
    "EMP-031",
    "EMP-014",
    "EMP-117",
    "EMP-243"
  ],
  "west-terrace-median_2026-07-05": [
    "EMP-072",
    "EMP-031",
    "EMP-234",
    "EMP-116",
    "EMP-199",
    "EMP-039",
    "EMP-004"
  ],
  "sir-donald-bradman-drive_2026-07-12": [
    "EMP-206",
    "EMP-068",
    "EMP-021",
    "EMP-014",
    "EMP-003",
    "EMP-004"
  ],
  "tramline-5am_2026-07-19": [
    "EMP-243",
    "EMP-081",
    "EMP-234",
    "EMP-206",
    "EMP-199",
    "EMP-014",
    "EMP-031"
  ],
  "montefiore-hill_2026-07-26": [
    "EMP-239",
    "EMP-117",
    "EMP-036",
    "EMP-243",
    "EMP-031"
  ],
  "west-terrace-median_2026-08-02": [
    "EMP-234",
    "EMP-116",
    "EMP-199",
    "EMP-004",
    "EMP-243",
    "EMP-003"
  ],
  "bundys-road_2026-08-09": [
    "EMP-081",
    "EMP-234",
    "EMP-021",
    "EMP-068",
    "EMP-014"
  ],
  "sir-donald-bradman-drive_2026-08-16": [
    "EMP-239",
    "EMP-068",
    "EMP-036",
    "EMP-003",
    "EMP-031"
  ],
  "tramline-5am_2026-08-23": [
    "EMP-243",
    "EMP-239",
    "EMP-117",
    "EMP-036",
    "EMP-136"
  ],
  "montefiore-hill_2026-08-30": [
    "EMP-199",
    "EMP-116",
    "EMP-068",
    "EMP-004",
    "EMP-021",
    "EMP-234"
  ],
  "west-terrace-median_2026-09-06": [
    "EMP-031",
    "EMP-003",
    "EMP-199",
    "EMP-206",
    "EMP-081"
  ],
  "bundys-road_2026-09-13": [
    "EMP-239",
    "EMP-117",
    "EMP-036",
    "EMP-136",
    "EMP-014"
  ],
  "sir-donald-bradman-drive_2026-09-20": [
    "EMP-116",
    "EMP-068",
    "EMP-004",
    "EMP-021",
    "EMP-003"
  ],
  "tramline-5am_2026-09-27": [
    "EMP-243",
    "EMP-014",
    "EMP-081",
    "EMP-031",
    "EMP-234"
  ],
  "montefiore-hill_2026-10-04": [
    "EMP-206",
    "EMP-068",
    "EMP-239",
    "EMP-117",
    "EMP-036"
  ],
  "west-terrace-median_2026-10-11": [
    "EMP-136",
    "EMP-116",
    "EMP-117",
    "EMP-004",
    "EMP-021"
  ],
  "bundys-road_2026-10-18": [
    "EMP-003",
    "EMP-014",
    "EMP-068",
    "EMP-206",
    "EMP-199"
  ],
  "sir-donald-bradman-drive_2026-10-25": [
    "EMP-239",
    "EMP-068",
    "EMP-036",
    "EMP-136",
    "EMP-116"
  ],
  "tramline-5am_2026-11-01": [
    "EMP-243",
    "EMP-206",
    "EMP-199",
    "EMP-239",
    "EMP-117"
  ],
  "montefiore-hill_2026-11-08": [
    "EMP-068",
    "EMP-243",
    "EMP-021",
    "EMP-003",
    "EMP-081"
  ]
};

window.HortOpsData.HISTORICAL_PERMIT_DATA = {
  "bundys-road_2026-02-08": {
    "notes": "Booked 28/01/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "Booked 28/01/26",
    "tpoNotes": ""
  },
  "rundle-street-vine_2026-02-08": {
    "notes": "Booked 28/01/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "Booked 28/01/26",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-02-08": {
    "notes": "Booked 28/01/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "Booked 28/01/26",
    "tpoNotes": ""
  },
  "grote-street_2026-02-15": {
    "notes": "WZTM booked 6/02",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 6/02",
    "tpoNotes": ""
  },
  "tramline-5am_2026-02-15": {
    "notes": "TPO booked 29/01/26 WZTM 06/02",
    "wztmStatus": "finalized",
    "tpoStatus": "finalized",
    "wztmNotes": "TPO booked 29/01/26 WZTM 06/02",
    "tpoNotes": "TPO booked 29/01/26 WZTM 06/02"
  },
  "tramline-5am_2026-02-22": {
    "notes": "TPO booked 29/01/26 WZTM 16/02",
    "wztmStatus": "finalized",
    "tpoStatus": "finalized",
    "wztmNotes": "TPO booked 29/01/26 WZTM 16/02",
    "tpoNotes": "TPO booked 29/01/26 WZTM 16/02"
  },
  "west-terrace-median_2026-02-22": {
    "notes": "WZTM booked 17/02",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 17/02",
    "tpoNotes": ""
  },
  "montefiore-hill_2026-03-01": {
    "notes": "WZTM booked 23/02/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 23/02/26",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-03-15": {
    "notes": "WZTM booked 10/03/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 10/03/26",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-03-22": {
    "notes": "WZTM booked 16/03/26 for the 29th",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 16/03/26 for the 29th",
    "tpoNotes": ""
  },
  "grenfell-greening_2026-03-29": {
    "notes": "",
    "wztmStatus": "not_required",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "tramline-5am_2026-03-29": {
    "notes": "WZTM booked 16/03/26",
    "wztmStatus": "finalized",
    "tpoStatus": "pending",
    "wztmNotes": "WZTM booked 16/03/26",
    "tpoNotes": ""
  },
  "bundys-road_2026-04-05": {
    "notes": "-",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM approved",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-04-05": {
    "notes": "-",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM approved",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-04-19": {
    "notes": "WZTM booked 7/4/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 7/4/26",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-05-03": {
    "notes": "WZTM booked 31/3/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 31/3/26",
    "tpoNotes": ""
  },
  "tramline-5am_2026-05-10": {
    "notes": "WZTM booked 21/04/26",
    "wztmStatus": "finalized",
    "tpoStatus": "pending",
    "wztmNotes": "WZTM booked 21/04/26",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-05-17": {
    "notes": "WZTM booked 11/05/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 11/05/26",
    "tpoNotes": ""
  },
  "montefiore-hill_2026-05-24": {
    "notes": "WZTM booked 19/05/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 19/05/26",
    "tpoNotes": ""
  },
  "bundys-road_2026-05-31": {
    "notes": "WZTM booked 25/05/2026",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 25/05/2026",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-05-31": {
    "notes": "WZTM booked 25/05/2026",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 25/05/2026",
    "tpoNotes": ""
  },
  "grote-street_2026-06-07": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-06-14": {
    "notes": "WZTM booked 5/7/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 5/7/26",
    "tpoNotes": ""
  },
  "tramline-5am_2026-06-21": {
    "notes": "WZTM booked 12/06/2026",
    "wztmStatus": "finalized",
    "tpoStatus": "pending",
    "wztmNotes": "WZTM booked 12/06/2026",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-06-28": {
    "notes": "WZTM booked 19/07/2026",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 19/07/2026",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-07-05": {
    "notes": "WZTM booked 29/6/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 29/6/26",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-07-12": {
    "notes": "WZTM booked 2/7/26",
    "wztmStatus": "finalized",
    "tpoStatus": "not_required",
    "wztmNotes": "WZTM booked 2/7/26",
    "tpoNotes": ""
  },
  "tramline-5am_2026-07-19": {
    "notes": "TPO booked/WZTM booked",
    "wztmStatus": "finalized",
    "tpoStatus": "finalized",
    "wztmNotes": "TPO booked/WZTM booked",
    "tpoNotes": "TPO booked/WZTM booked"
  },
  "montefiore-hill_2026-07-26": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-08-02": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "bundys-road_2026-08-09": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-08-16": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "tramline-5am_2026-08-23": {
    "notes": "TPO booked",
    "wztmStatus": "finalized",
    "tpoStatus": "finalized",
    "wztmNotes": "TPO booked",
    "tpoNotes": "TPO booked"
  },
  "montefiore-hill_2026-08-30": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-09-06": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "bundys-road_2026-09-13": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-09-20": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "tramline-5am_2026-09-27": {
    "notes": "TPO booked",
    "wztmStatus": "finalized",
    "tpoStatus": "finalized",
    "wztmNotes": "TPO booked",
    "tpoNotes": "TPO booked"
  },
  "montefiore-hill_2026-10-04": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "west-terrace-median_2026-10-11": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "bundys-road_2026-10-18": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "sir-donald-bradman-drive_2026-10-25": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "tramline-5am_2026-11-01": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "pending",
    "wztmNotes": "",
    "tpoNotes": ""
  },
  "montefiore-hill_2026-11-08": {
    "notes": "",
    "wztmStatus": "pending",
    "tpoStatus": "not_required",
    "wztmNotes": "",
    "tpoNotes": ""
  }
};

window.HortOpsData.INITIAL_HORT_JOBS = window.HortOpsData.INITIAL_JOBS;
