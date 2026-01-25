import React, { useState } from 'react';
import { MessageSquare, Webhook, Send, Globe, Monitor, Database, Shield } from 'lucide-react';

const RefinedArchitecture = () => {
  const [selectedService, setSelectedService] = useState(null);

  const services = {
    'whatsapp-api': {
      name: 'WhatsApp API Service',
      port: 3008,
      icon: MessageSquare,
      color: 'bg-green-500',
      description: 'Handles all outbound calls to Meta WhatsApp Graph API',
      endpoints: [
        'POST /whatsapp/send/text',
        'POST /whatsapp/send/template',
        'POST /whatsapp/send/media',
        'GET /whatsapp/media/:mediaId',
        'POST /whatsapp/mark-read'
      ],
      responsibilities: [
        'Send text messages to WhatsApp',
        'Send template messages',
        'Upload and send media (images, documents)',
        'Mark messages as read',
        'Handle Meta API rate limits'
      ]
    },
    'whatsapp-webhook': {
      name: 'WhatsApp Webhook Service',
      port: 3009,
      icon: Webhook,
      color: 'bg-blue-500',
      description: 'Receives and processes webhooks from Meta WhatsApp',
      endpoints: [
        'GET /webhook/whatsapp (verification)',
        'POST /webhook/whatsapp (events)',
        'GET /health'
      ],
      responsibilities: [
        'Handle webhook verification',
        'Validate Meta signatures',
        'Process inbound messages',
        'Process status updates',
        'Queue messages for transformation'
      ]
    },
    'genesys-api': {
      name: 'Genesys API Service',
      port: 3010,
      icon: Send,
      color: 'bg-purple-500',
      description: 'Handles all calls to Genesys Cloud Open Messaging API',
      endpoints: [
        'POST /genesys/messages/inbound',
        'POST /genesys/receipts',
        'GET /genesys/conversations/:id',
        'PATCH /genesys/conversations/:id'
      ],
      responsibilities: [
        'Send inbound messages to Genesys',
        'Send delivery receipts',
        'Create conversations',
        'Update conversation state',
        'Handle Genesys API responses'
      ]
    },
    'genesys-webhook': {
      name: 'Genesys Webhook Service',
      port: 3011,
      icon: Webhook,
      color: 'bg-indigo-500',
      description: 'Receives webhooks from Genesys Cloud',
      endpoints: [
        'POST /webhook/genesys/outbound',
        'POST /webhook/genesys/events',
        'GET /health'
      ],
      responsibilities: [
        'Receive agent messages',
        'Process conversation events',
        'Handle agent typing indicators',
        'Queue messages for transformation',
        'Validate Genesys payloads'
      ]
    },
    'agent-widget': {
      name: 'Agent Interaction Widget',
      port: 3012,
      icon: Monitor,
      color: 'bg-yellow-500',
      description: 'Web widget embedded in Genesys Agent Desktop',
      endpoints: [
        'GET /widget (UI)',
        'GET /widget/api/customer/:waId',
        'POST /widget/api/send-template',
        'GET /widget/api/conversation/:id/history'
      ],
      responsibilities: [
        'Display customer WhatsApp info',
        'Show conversation history',
        'Quick template sending',
        'Customer context display',
        'Integration with Genesys Client SDK'
      ]
    }
  };

  const infrastructure = [
    { name: 'API Gateway', port: 3000, purpose: 'Route all requests, rate limiting' },
    { name: 'Tenant Service', port: 3007, purpose: 'Multi-tenant management' },
    { name: 'Auth Service', port: 3004, purpose: 'OAuth token management' },
    { name: 'State Manager', port: 3005, purpose: 'Conversation mapping & state' },
    { name: 'Inbound Transformer', port: 3002, purpose: 'Meta → Genesys format' },
    { name: 'Outbound Transformer', port: 3003, purpose: 'Genesys → Meta format' }
  ];

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Refined Microservices Architecture</h1>
          <p className="text-gray-400">Dedicated services for WhatsApp, Genesys APIs & Agent Widget</p>
        </div>

        {/* Architecture Diagram */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Service Separation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-750 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                WhatsApp Layer
              </h4>
              <div className="space-y-2">
                <div className="bg-gray-700 p-3 rounded">
                  <div className="font-medium text-sm">WhatsApp Webhook Service</div>
                  <div className="text-xs text-gray-400">:3009 - Receives from Meta</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="font-medium text-sm">WhatsApp API Service</div>
                  <div className="text-xs text-gray-400">:3008 - Sends to Meta</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-750 rounded-lg p-4">
              <h4 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
                <Send className="w-5 h-5" />
                Genesys Layer
              </h4>
              <div className="space-y-2">
                <div className="bg-gray-700 p-3 rounded">
                  <div className="font-medium text-sm">Genesys Webhook Service</div>
                  <div className="text-xs text-gray-400">:3011 - Receives from Genesys</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="font-medium text-sm">Genesys API Service</div>
                  <div className="text-xs text-gray-400">:3010 - Sends to Genesys</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-gray-750 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Agent Interface
            </h4>
            <div className="bg-gray-700 p-3 rounded">
              <div className="font-medium text-sm">Agent Interaction Widget</div>
              <div className="text-xs text-gray-400">:3012 - Embedded in Genesys Agent Desktop</div>
            </div>
          </div>
        </div>

        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Object.entries(services).map(([key, service]) => {
            const Icon = service.icon;
            return (
              <button
                key={key}
                onClick={() => setSelectedService(key)}
                className={`text-left p-4 rounded-lg transition-all ${
                  selectedService === key 
                    ? 'bg-gray-700 ring-2 ring-blue-500' 
                    : 'bg-gray-800 hover:bg-gray-750'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`${service.color} p-2 rounded`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{service.name}</div>
                    <div className="text-xs text-gray-400">Port {service.port}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">{service.description}</div>
              </button>
            );
          })}
        </div>

        {/* Service Details */}
        {selectedService && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {React.createElement(services[selectedService].icon, { className: "w-8 h-8" })}
                <div>
                  <h3 className="text-2xl font-semibold">{services[selectedService].name}</h3>
                  <p className="text-gray-400">{services[selectedService].description}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded text-sm ${services[selectedService].color}`}>
                Port {services[selectedService].port}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-green-400">API Endpoints</h4>
                <div className="space-y-1">
                  {services[selectedService].endpoints.map((endpoint, idx) => (
                    <div key={idx} className="bg-gray-700 px-3 py-2 rounded font-mono text-xs">
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

        {/* Message Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-green-400">Inbound Flow</h3>
            <div className="space-y-2 text-sm">
              {[
                { step: 'Meta', text: 'Customer sends WhatsApp message' },
                { step: 'WH', text: 'WhatsApp Webhook receives (3009)' },
                { step: 'Q', text: 'Message queued in RabbitMQ' },
                { step: 'IT', text: 'Inbound Transformer processes' },
                { step: 'SM', text: 'State Manager maps wa_id → conv_id' },
                { step: 'GA', text: 'Genesys API sends to Genesys (3010)' },
                { step: 'Agent', text: 'Message appears in Agent Desktop' }
              ].map(({ step, text }, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-750 p-2 rounded">
                  <div className="bg-green-500 text-white rounded px-2 py-1 text-xs font-bold min-w-[50px] text-center">
                    {step}
                  </div>
                  <span className="text-xs">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-purple-400">Outbound Flow</h3>
            <div className="space-y-2 text-sm">
              {[
                { step: 'Agent', text: 'Agent sends message in Genesys' },
                { step: 'GW', text: 'Genesys Webhook receives (3011)' },
                { step: 'Q', text: 'Message queued in RabbitMQ' },
                { step: 'OT', text: 'Outbound Transformer processes' },
                { step: 'SM', text: 'State Manager gets wa_id from conv_id' },
                { step: 'WA', text: 'WhatsApp API sends to Meta (3008)' },
                { step: 'Meta', text: 'Message delivered to customer' }
              ].map(({ step, text }, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-750 p-2 rounded">
                  <div className="bg-purple-500 text-white rounded px-2 py-1 text-xs font-bold min-w-[50px] text-center">
                    {step}
                  </div>
                  <span className="text-xs">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Infrastructure Services */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Database className="w-6 h-6" />
            Supporting Infrastructure
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {infrastructure.map((svc, idx) => (
              <div key={idx} className="bg-gray-750 p-3 rounded">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-sm">{svc.name}</div>
                  <div className="text-xs text-gray-500">:{svc.port}</div>
                </div>
                <div className="text-xs text-gray-400">{svc.purpose}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Widget Info */}
        <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-2 border-yellow-500 rounded-lg p-6 mt-8">
          <div className="flex items-start gap-4">
            <Monitor className="w-8 h-8 text-yellow-400 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">Agent Interaction Widget</h3>
              <p className="text-gray-300 mb-3">
                The widget provides agents with real-time customer context and quick actions directly in their Genesys workspace.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold mb-2 text-sm">Widget URL Format:</div>
                  <div className="bg-gray-800 p-3 rounded font-mono text-xs">
                    https://yourdomain.com/widget<br/>
                    ?conversationId={'{{conversationId}}'}<br/>
                    &tenantId={'{{tenantId}}'}
                  </div>
                </div>
                <div>
                  <div className="font-semibold mb-2 text-sm">Features:</div>
                  <ul className="space-y-1 text-sm">
                    <li className="flex gap-2"><span className="text-yellow-400">•</span>Customer WhatsApp profile</li>
                    <li className="flex gap-2"><span className="text-yellow-400">•</span>Conversation history</li>
                    <li className="flex gap-2"><span className="text-yellow-400">•</span>Quick template responses</li>
                    <li className="flex gap-2"><span className="text-yellow-400">•</span>Media preview</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefinedArchitecture;