const GENESYS_REGIONS = {
  'us-east-1':      { oauthUrl: 'https://login.use1.us-gov-pure-cloud.com/oauth/token',  jwksUrl: 'https://login.use1.us-gov-pure-cloud.com/.well-known/jwks.json' },
  'us-east-2':      { oauthUrl: 'https://login.us-east-2.pure.cloud/oauth/token',         jwksUrl: 'https://login.us-east-2.pure.cloud/.well-known/jwks.json' },
  'us-west-2':      { oauthUrl: 'https://login.usw2.pure.cloud/oauth/token',              jwksUrl: 'https://login.usw2.pure.cloud/.well-known/jwks.json' },
  'ca-central-1':   { oauthUrl: 'https://login.cac1.pure.cloud/oauth/token',              jwksUrl: 'https://login.cac1.pure.cloud/.well-known/jwks.json' },
  'eu-west-1':      { oauthUrl: 'https://login.mypurecloud.ie/oauth/token',               jwksUrl: 'https://login.mypurecloud.ie/.well-known/jwks.json' },
  'eu-west-2':      { oauthUrl: 'https://login.euw2.pure.cloud/oauth/token',              jwksUrl: 'https://login.euw2.pure.cloud/.well-known/jwks.json' },
  'eu-central-1':   { oauthUrl: 'https://login.mypurecloud.de/oauth/token',               jwksUrl: 'https://login.mypurecloud.de/.well-known/jwks.json' },
  'ap-southeast-2': { oauthUrl: 'https://login.mypurecloud.com.au/oauth/token',           jwksUrl: 'https://login.mypurecloud.com.au/.well-known/jwks.json' },
  'ap-northeast-1': { oauthUrl: 'https://login.mypurecloud.jp/oauth/token',               jwksUrl: 'https://login.mypurecloud.jp/.well-known/jwks.json' },
  'ap-northeast-2': { oauthUrl: 'https://login.apne2.pure.cloud/oauth/token',             jwksUrl: 'https://login.apne2.pure.cloud/.well-known/jwks.json' },
  'ap-south-1':     { oauthUrl: 'https://login.aps1.pure.cloud/oauth/token',              jwksUrl: 'https://login.aps1.pure.cloud/.well-known/jwks.json' },
};

// Legacy region format aliases (e.g. 'aps1' → 'ap-south-1')
const REGION_ALIASES = {
  'aps1': 'ap-south-1',
  'usw2': 'us-west-2',
  'use1': 'us-east-1',
  'use2': 'us-east-2',
  'cac1': 'ca-central-1',
  'euw1': 'eu-west-1',
  'euw2': 'eu-west-2',
  'euc1': 'eu-central-1',
  'apse2': 'ap-southeast-2',
  'apne1': 'ap-northeast-1',
  'apne2': 'ap-northeast-2',
  'mypurecloud.com': 'us-east-1',
  'mypurecloud.ie': 'eu-west-1',
  'mypurecloud.de': 'eu-central-1',
  'mypurecloud.com.au': 'ap-southeast-2',
  'mypurecloud.jp': 'ap-northeast-1',
  'pure.cloud': 'us-east-2',
};

function normalizeRegion(region) {
  if (!region) return null;
  if (GENESYS_REGIONS[region]) return region;
  return REGION_ALIASES[region] || null;
}

function getGenesysEndpoints(region) {
  const normalized = normalizeRegion(region);
  const endpoints = normalized ? GENESYS_REGIONS[normalized] : null;
  if (!endpoints) {
    throw new Error(
      `Unknown Genesys region: "${region}". Valid regions: ${Object.keys(GENESYS_REGIONS).join(', ')}`
    );
  }
  return endpoints;
}

module.exports = { GENESYS_REGIONS, getGenesysEndpoints, normalizeRegion };
