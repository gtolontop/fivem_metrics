import type { Server, Resource, Stats } from '../types'

export const stats: Stats = {
  totalServers: 12847,
  totalPlayers: 156432,
  totalResources: 8934,
  avgPlayersPerServer: 12.2,
  serversOnline: 8421,
  peakPlayers24h: 198543
}

export const servers: Server[] = [
  {
    id: 'srv-001',
    name: 'Eclipse Roleplay',
    players: 892,
    maxPlayers: 1000,
    ping: 24,
    ip: '51.178.82.14',
    port: 30120,
    resources: ['es_extended', 'esx_menu_default', 'mysql-async', 'esx_skin', 'esx_identity'],
    tags: ['Roleplay', 'Serious', 'Economy', 'Jobs'],
    country: 'FR',
    uptime: 99.8,
    lastSeen: new Date()
  },
  {
    id: 'srv-002',
    name: 'NoPixel Inspired',
    players: 756,
    maxPlayers: 800,
    ping: 45,
    ip: '185.249.196.42',
    port: 30120,
    resources: ['qb-core', 'qb-inventory', 'qb-phone', 'qb-banking'],
    tags: ['Roleplay', 'Whitelist', 'Serious'],
    country: 'US',
    uptime: 99.2,
    lastSeen: new Date()
  },
  {
    id: 'srv-003',
    name: 'Los Santos Underground',
    players: 623,
    maxPlayers: 700,
    ping: 32,
    ip: '89.163.144.87',
    port: 30120,
    resources: ['vrp', 'vrp_inventory', 'vrp_homes'],
    tags: ['Roleplay', 'Gang', 'PvP'],
    country: 'DE',
    uptime: 98.5,
    lastSeen: new Date()
  },
  {
    id: 'srv-004',
    name: 'FiveM Racing League',
    players: 445,
    maxPlayers: 500,
    ping: 18,
    ip: '91.134.92.156',
    port: 30120,
    resources: ['racing_core', 'custom_cars', 'drift_mode'],
    tags: ['Racing', 'Drift', 'Cars'],
    country: 'NL',
    uptime: 99.9,
    lastSeen: new Date()
  },
  {
    id: 'srv-005',
    name: 'GTA Online Remastered',
    players: 398,
    maxPlayers: 500,
    ping: 28,
    ip: '51.89.147.206',
    port: 30120,
    resources: ['es_extended', 'esx_banking', 'esx_vehicleshop'],
    tags: ['Freeroam', 'Economy', 'Heists'],
    country: 'FR',
    uptime: 97.8,
    lastSeen: new Date()
  },
  {
    id: 'srv-006',
    name: 'Midnight Club RP',
    players: 367,
    maxPlayers: 400,
    ping: 41,
    ip: '45.83.246.118',
    port: 30120,
    resources: ['qb-core', 'qb-racing', 'qb-tunerchip'],
    tags: ['Racing', 'Roleplay', 'Tuning'],
    country: 'UK',
    uptime: 98.9,
    lastSeen: new Date()
  },
  {
    id: 'srv-007',
    name: 'Vice City Stories',
    players: 312,
    maxPlayers: 400,
    ping: 35,
    ip: '192.168.1.100',
    port: 30120,
    resources: ['es_extended', 'esx_drugs', 'esx_policejob'],
    tags: ['Roleplay', 'Economy', '80s'],
    country: 'BR',
    uptime: 96.5,
    lastSeen: new Date()
  },
  {
    id: 'srv-008',
    name: 'Survival Island',
    players: 289,
    maxPlayers: 300,
    ping: 52,
    ip: '103.28.52.74',
    port: 30120,
    resources: ['survival_core', 'crafting', 'basebuilding'],
    tags: ['Survival', 'PvP', 'Crafting'],
    country: 'AU',
    uptime: 95.2,
    lastSeen: new Date()
  }
]

export const resources: Resource[] = [
  {
    name: 'es_extended',
    displayName: 'ESX Framework',
    description: 'The most popular FiveM roleplay framework',
    version: '1.10.6',
    serverCount: 4523,
    totalPlayers: 89432,
    category: 'Framework',
    trending: true,
    author: 'ESX-Org'
  },
  {
    name: 'qb-core',
    displayName: 'QBCore Framework',
    description: 'Modern and optimized FiveM framework',
    version: '1.2.8',
    serverCount: 3892,
    totalPlayers: 72156,
    category: 'Framework',
    trending: true,
    author: 'qbcore-framework'
  },
  {
    name: 'mysql-async',
    displayName: 'MySQL Async',
    description: 'Asynchronous MySQL library for FiveM',
    version: '3.3.2',
    serverCount: 6721,
    totalPlayers: 124532,
    category: 'Library',
    trending: false,
    author: 'brouznouf'
  },
  {
    name: 'oxmysql',
    displayName: 'OxMySQL',
    description: 'Modern MySQL resource for FiveM',
    version: '2.7.5',
    serverCount: 4156,
    totalPlayers: 67843,
    category: 'Library',
    trending: true,
    author: 'overextended'
  },
  {
    name: 'ox_lib',
    displayName: 'Ox Library',
    description: 'Library of shared functions and UI elements',
    version: '3.18.0',
    serverCount: 3654,
    totalPlayers: 58921,
    category: 'Library',
    trending: true,
    author: 'overextended'
  },
  {
    name: 'ox_inventory',
    displayName: 'Ox Inventory',
    description: 'Slot-based inventory with weapon attachments',
    version: '2.36.1',
    serverCount: 2987,
    totalPlayers: 45632,
    category: 'Inventory',
    trending: true,
    author: 'overextended'
  },
  {
    name: 'qb-inventory',
    displayName: 'QB Inventory',
    description: 'QBCore compatible inventory system',
    version: '2.0.0',
    serverCount: 2654,
    totalPlayers: 41235,
    category: 'Inventory',
    trending: false,
    author: 'qbcore-framework'
  },
  {
    name: 'esx_menu_default',
    displayName: 'ESX Menu Default',
    description: 'Default menu system for ESX',
    version: '1.0.3',
    serverCount: 4123,
    totalPlayers: 78543,
    category: 'UI',
    trending: false,
    author: 'ESX-Org'
  },
  {
    name: 'pma-voice',
    displayName: 'PMA Voice',
    description: 'Advanced voice chat for FiveM',
    version: '6.0.2',
    serverCount: 3456,
    totalPlayers: 52341,
    category: 'Voice',
    trending: true,
    author: 'AvarianKnight'
  },
  {
    name: 'dpemotes',
    displayName: 'DP Emotes',
    description: 'Comprehensive emote system',
    version: '1.7.4',
    serverCount: 2876,
    totalPlayers: 43567,
    category: 'Animation',
    trending: false,
    author: 'andristum'
  },
  {
    name: 'vMenu',
    displayName: 'vMenu',
    description: 'Server-sided trainer/menu',
    version: '3.6.0',
    serverCount: 1987,
    totalPlayers: 28765,
    category: 'Admin',
    trending: false,
    author: 'TomGrobbe'
  },
  {
    name: 'PolyZone',
    displayName: 'PolyZone',
    description: 'Zone creation and detection library',
    version: '2.6.5',
    serverCount: 3234,
    totalPlayers: 48976,
    category: 'Library',
    trending: false,
    author: 'mkafrin'
  }
]

export const categories = [
  'All',
  'Framework',
  'Library',
  'Inventory',
  'UI',
  'Voice',
  'Animation',
  'Admin',
  'Economy',
  'Jobs',
  'Vehicles'
]
