import React, { useState } from 'react';
import { Building2, Users, Database, Shield, Layers, GitBranch, Server } from 'lucide-react';

const MultiTenantArchitecture = () => {
  const [selectedTenant, setSelectedTenant] = useState('tenant-a');

  const tenants = [
    { id: 'tenant-a', name: 'Acme Corp', conversations: 1234, agents: 45, color: 'bg-blue-500' },
    { id: 'tenant-b', name: 'TechStart Inc', conversations: 567, agents: 12, color: 'bg-green-500' },
    { id: 'tenant-c', name: 'Global Services', conversations: 2890, agents: 89, color: 'bg-purple-500' }
  ];

  const isolationLevels = [
    {
      level: 'Database Per Tenant',
      icon: Database,
      pros: ['Complete data isolation', 'Easy backup/restore', 'Custom schemas'],
      cons: ['Higher infrastructure cost', 'Complex migrations'],
      recommended: 'Enterprise clients with strict compliance'
    },
    {
      level: 'Schema Per Tenant',
      icon: Layers,
      pros: ['Good isolation', 'Shared infrastructure', 'Moderate cost'],
      cons: ['Schema management overhead', 'Migration complexity'],
      recommended: 'Mid-market SaaS applications'
    },
    {
      level: 'Shared Database with Tenant ID',
      icon: GitBranch,
      pros: ['Cost-effective', 'Easy scaling', 'Simple management'],
      cons: ['Requires careful query filtering', 'Security risk if misconfigured'],
      recommended: 'Startups and SMB applications (CURRENT)'
    }
  ];

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Multi-Tenant Architecture</h1>
          <p className="text-gray-400">WhatsApp-Genesys Integration with Tenant Isolation</p>
        </div>

        {/* Current Status Alert */}
        <div className="bg-yellow-900/30 border-2 border-yellow-500 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <Shield className="w-8 h-8 text-yellow-400 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">Current Implementation: Single-Tenant</h3>
              <p className="text-gray-300 mb-3">
                The provided architecture is designed for <strong>single-tenant deployment</strong>. Each customer/organization 
                would need their own instance of the entire stack with separate credentials.
              </p>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="font-semibold mb-2">To Support Multi-Tenancy, You Need:</div>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Add tenant_id to all database tables and cache keys</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Implement tenant resolution middleware (from subdomain, API key, or JWT)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Store multiple Meta/Genesys credentials per tenant</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Add tenant context to all service calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Implement tenant-aware rate limiting and quotas</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Selector */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Tenant Overview (Multi-Tenant Example)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tenants.map(tenant => (
              <button
                key={tenant.id}
                onClick={() => setSelectedTenant(tenant.id)}
                className={`text-left p-4 rounded-lg transition-all ${
                  selectedTenant === tenant.id 
                    ? 'bg-gray-700 ring-2 ring-blue-500' 
                    : 'bg-gray-750 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-3 h-3 rounded-full ${tenant.color}`}></div>
                  <div className="font-semibold">{tenant.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400">Conversations</div>
                    <div className="font-semibold">{tenant.conversations.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Agents</div>
                    <div className="font-semibold">{tenant.agents}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Data Isolation Strategies */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Data Isolation Strategies</h3>
          <div className="space-y-4">
            {isolationLevels.map((strategy, idx) => {
              const Icon = strategy.icon;
              return (
                <div key={idx} className="bg-gray-750 rounded-lg p-5">
                  <div className="flex items-start gap-4">
                    <Icon className="w-8 h-8 text-blue-400 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold mb-2">{strategy.level}</h4>
                      <div className="grid md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-sm font-semibold text-green-400 mb-1">Pros:</div>
                          <ul className="text-sm space-y-1">
                            {strategy.pros.map((pro, i) => (
                              <li key={i} className="text-gray-300">+ {pro}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-red-400 mb-1">Cons:</div>
                          <ul className="text-sm space-y-1">
                            {strategy.cons.map((con, i) => (
                              <li key={i} className="text-gray-300">- {con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Best for: </span>
                        <span className="text-blue-300">{strategy.recommended}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Tenant Architecture Diagram */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Multi-Tenant Request Flow</h3>
          <div className="space-y-3">
            {[
              { step: 1, text: 'Request arrives with tenant identifier (subdomain, API key, or JWT token)', color: 'bg-blue-500' },
              { step: 2, text: 'API Gateway extracts tenant_id and validates tenant status', color: 'bg-blue-500' },
              { step: 3, text: 'Tenant context injected into request headers (X-Tenant-ID)', color: 'bg-green-500' },
              { step: 4, text: 'All services filter queries by tenant_id automatically', color: 'bg-green-500' },
              { step: 5, text: 'State Manager retrieves tenant-specific credentials from vault', color: 'bg-purple-500' },
              { step: 6, text: 'Auth Service uses tenant-specific Genesys OAuth credentials', color: 'bg-purple-500' },
              { step: 7, text: 'Transformers use tenant-specific Meta WhatsApp credentials', color: 'bg-yellow-500' },
              { step: 8, text: 'Response returned with tenant context maintained throughout', color: 'bg-yellow-500' }
            ].map(({ step, text, color }) => (
              <div key={step} className="flex items-start gap-3 bg-gray-750 p-3 rounded">
                <div className={`${color} text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                  {step}
                </div>
                <span className="text-sm pt-1">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Implementation Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-400" />
              Database Changes Required
            </h3>
            <div className="space-y-3 text-sm">
              <div className="bg-gray-750 p-3 rounded font-mono text-xs">
                ALTER TABLE conversation_mappings<br/>
                ADD COLUMN tenant_id VARCHAR(50) NOT NULL;
              </div>
              <div className="bg-gray-750 p-3 rounded font-mono text-xs">
                CREATE INDEX idx_tenant_wa<br/>
                ON conversation_mappings(tenant_id, wa_id);
              </div>
              <div className="bg-gray-750 p-3 rounded font-mono text-xs">
                CREATE TABLE tenant_credentials (<br/>
                &nbsp;&nbsp;tenant_id VARCHAR(50) PRIMARY KEY,<br/>
                &nbsp;&nbsp;meta_credentials JSONB,<br/>
                &nbsp;&nbsp;genesys_credentials JSONB<br/>
                );
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-green-400" />
              Code Changes Required
            </h3>
            <div className="space-y-2 text-sm">
              {[
                'Add tenant resolution middleware to API Gateway',
                'Update all database queries with tenant_id filter',
                'Modify Redis keys to include tenant_id prefix',
                'Create tenant credential management service',
                'Add tenant-aware rate limiting',
                'Implement tenant provisioning/onboarding API',
                'Add tenant usage tracking and billing hooks',
                'Create tenant admin portal for self-service'
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-gray-750 p-2 rounded">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h3 className="text-xl font-semibold mb-4">Multi-Tenant Best Practices</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-blue-400 mb-3">Security</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><span className="text-blue-400">•</span>Always validate tenant_id from authenticated source</li>
                <li className="flex gap-2"><span className="text-blue-400">•</span>Use prepared statements to prevent SQL injection</li>
                <li className="flex gap-2"><span className="text-blue-400">•</span>Encrypt tenant credentials at rest (AWS KMS, HashiCorp Vault)</li>
                <li className="flex gap-2"><span className="text-blue-400">•</span>Implement tenant-level audit logging</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-400 mb-3">Performance</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><span className="text-green-400">•</span>Cache tenant configuration in Redis</li>
                <li className="flex gap-2"><span className="text-green-400">•</span>Use database connection pooling per tenant</li>
                <li className="flex gap-2"><span className="text-green-400">•</span>Implement tenant-aware query optimization</li>
                <li className="flex gap-2"><span className="text-green-400">•</span>Monitor and alert on per-tenant resource usage</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiTenantArchitecture;