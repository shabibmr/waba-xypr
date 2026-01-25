import React, { useState } from 'react';
import { Server, Database, Lock, RefreshCw, MessageSquare, Users, Activity, Settings, Code, Layers } from 'lucide-react';

const MicroservicesArchitecture = () => {
  const [selectedService, setSelectedService] = useState(null);

  const services = {
    'api-gateway': {
      name: 'API Gateway',
      icon: Layers,
      color: 'bg-blue-500',
      description: 'Load balancing, rate limiting, request routing',
      tech: 'Express.js, Kong/Nginx',
      endpoints: ['/webhook/meta', '/webhook/genesys', '/api/*'],
      responsibilities: ['Request validation', 'Rate limiting', 'SSL termination', 'Load distribution']
    },
    'inbound-transformer': {
      name: 'Inbound Transformer',
      icon: RefreshCw,
      color: 'bg-green-500',
      description: 'Meta JSON → Genesys Open Messaging format',
      tech: 'Node.js, Express',
      endpoints: ['/transform/inbound'],
      responsibilities: ['Parse Meta webhook', 'Map wa_id to Genesys ID', 'Format conversion', 'Media handling']
    },
    'outbound-transformer': {
      name: 'Outbound Transformer',
      icon: RefreshCw,
      color: 'bg-purple-500',
      description: 'Genesys JSON → WhatsApp API format',
      tech: 'Node.js, Express',
      endpoints: ['/transform/outbound'],
      responsibilities: ['Parse Genesys webhook', 'Template message formatting', 'Add Meta signatures', 'Queue management']
    },
    'auth-service': {
      name: 'Auth Service',
      icon: Lock,
      color: 'bg-red-500',
      description: 'OAuth 2.0 token management',
      tech: 'Node.js, Passport.js',
      endpoints: ['/auth/token', '/auth/refresh'],
      responsibilities: ['Token generation', 'Token refresh', 'Credential storage', 'API key validation']
    },
    'state-manager': {
      name: 'State Manager',
      icon: Database,
      color: 'bg-yellow-500',
      description: 'Conversation context and ID mapping',
      tech: 'Node.js, Redis, PostgreSQL',
      endpoints: ['/state/conversation', '/state/mapping'],
      responsibilities: ['wa_id ↔ conversation_id mapping', 'Session management', 'Context storage', 'Cache invalidation']
    },
    'webhook-handler': {
      name: 'Webhook Handler',
      icon: Activity,
      color: 'bg-indigo-500',
      description: 'Webhook verification and processing',
      tech: 'Node.js, Express',
      endpoints: ['/webhook/verify', '/webhook/process'],
      responsibilities: ['Meta signature validation', 'Webhook challenge', 'Event filtering', 'Message queuing']
    },
    'admin-dashboard': {
      name: 'Admin Dashboard',
      icon: Settings,
      color: 'bg-gray-500',
      description: 'Configuration and monitoring UI',
      tech: 'React, Next.js, Tailwind',
      endpoints: ['/dashboard/*'],
      responsibilities: ['Service monitoring', 'Config management', 'Analytics', 'Error logs']
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">WhatsApp ↔ Genesys Cloud Integration</h1>
          <p className="text-gray-400">Production-Ready Microservices Architecture</p>
        </div>

        {/* Architecture Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* External Layer */}
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-blue-500">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              External Channels
            </h3>
            <div className="space-y-3">
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium">Meta WhatsApp</div>
                <div className="text-sm text-gray-400">Graph API v18+</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium">Genesys Cloud</div>
                <div className="text-sm text-gray-400">Open Messaging API</div>
              </div>
            </div>
          </div>

          {/* Middleware Layer */}
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Server className="w-6 h-6" />
              Middleware Services
            </h3>
            <div className="space-y-2">
              {Object.entries(services).map(([key, service]) => {
                const Icon = service.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedService(key)}
                    className={`w-full text-left p-2 rounded transition-all ${
                      selectedService === key ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-650'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${service.color}`}></div>
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{service.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Infrastructure */}
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-purple-500">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Database className="w-6 h-6" />
              Infrastructure
            </h3>
            <div className="space-y-3">
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium">Redis</div>
                <div className="text-sm text-gray-400">Cache & Sessions</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium">PostgreSQL</div>
                <div className="text-sm text-gray-400">State & Mappings</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium">RabbitMQ</div>
                <div className="text-sm text-gray-400">Message Queue</div>
              </div>
            </div>
          </div>
        </div>

        {/* Service Details */}
        {selectedService && (
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-gray-600 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {React.createElement(services[selectedService].icon, { className: "w-8 h-8" })}
                <div>
                  <h3 className="text-2xl font-semibold">{services[selectedService].name}</h3>
                  <p className="text-gray-400">{services[selectedService].description}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded text-sm ${services[selectedService].color}`}>
                {services[selectedService].tech}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-green-400">Endpoints</h4>
                <div className="space-y-1">
                  {services[selectedService].endpoints.map((endpoint, idx) => (
                    <div key={idx} className="bg-gray-700 px-3 py-2 rounded font-mono text-sm">
                      {endpoint}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-blue-400">Responsibilities</h4>
                <ul className="space-y-1">
                  {services[selectedService].responsibilities.map((resp, idx) => (
                    <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Message Flows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inbound Flow */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-green-400">Inbound Flow (Customer → Agent)</h3>
            <div className="space-y-3">
              {[
                { step: 1, text: 'Customer sends message to WhatsApp' },
                { step: 2, text: 'Meta posts to webhook endpoint' },
                { step: 3, text: 'API Gateway validates & routes' },
                { step: 4, text: 'Webhook Handler verifies signature' },
                { step: 5, text: 'Inbound Transformer converts format' },
                { step: 6, text: 'State Manager maps wa_id → conversation_id' },
                { step: 7, text: 'Auth Service provides OAuth token' },
                { step: 8, text: 'POST to Genesys Open Message API' },
                { step: 9, text: 'Genesys routes to agent desktop' }
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3 bg-gray-700 p-3 rounded">
                  <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {step}
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outbound Flow */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-purple-400">Outbound Flow (Agent → Customer)</h3>
            <div className="space-y-3">
              {[
                { step: 1, text: 'Agent sends message in Genesys' },
                { step: 2, text: 'Genesys triggers outbound webhook' },
                { step: 3, text: 'API Gateway receives & validates' },
                { step: 4, text: 'Outbound Transformer converts format' },
                { step: 5, text: 'State Manager retrieves wa_id mapping' },
                { step: 6, text: 'Adds X-Hub-Signature-256 security' },
                { step: 7, text: 'POST to Meta Graph API' },
                { step: 8, text: 'Message delivered to customer' },
                { step: 9, text: 'Delivery receipts sent back via webhook' }
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3 bg-gray-700 p-3 rounded">
                  <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {step}
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Code className="w-6 h-6" />
            Technology Stack
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Node.js 20+', category: 'Runtime' },
              { name: 'Express.js', category: 'Framework' },
              { name: 'React/Next.js', category: 'Frontend' },
              { name: 'PostgreSQL', category: 'Database' },
              { name: 'Redis', category: 'Cache' },
              { name: 'RabbitMQ', category: 'Queue' },
              { name: 'Docker', category: 'Container' },
              { name: 'Kubernetes', category: 'Orchestration' }
            ].map((tech, idx) => (
              <div key={idx} className="bg-gray-700 p-3 rounded">
                <div className="font-medium">{tech.name}</div>
                <div className="text-sm text-gray-400">{tech.category}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MicroservicesArchitecture;