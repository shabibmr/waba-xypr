/**
 * Database Mock — In-memory PostgreSQL Pool stub
 * Simulates pool.query() with an in-memory Map backing store.
 */

type QueryResult = { rows: any[]; rowCount: number };

export class MockDatabase {
    private storage: Map<string, any[]> = new Map();
    private queryStub: jest.Mock;

    constructor() {
        this.queryStub = jest.fn().mockImplementation(
            async (query: string, params: any[]) => this.handleQuery(query, params)
        );
    }

    /** The pool object to inject in place of the real pg Pool */
    get pool() {
        return { query: this.queryStub };
    }

    // --------------- Query Dispatcher ---------------

    private handleQuery(query: string, params: any[]): QueryResult {
        const q = query.toLowerCase().trim();

        // INSERT conversation_mappings
        if (q.startsWith('insert into conversation_mappings')) {
            return this.handleMappingInsert(params);
        }

        // UPDATE conversation_mappings (correlate)
        if (q.includes('update conversation_mappings') && q.includes('conversation_id is null')) {
            return this.handleCorrelation(params);
        }

        // UPDATE conversation_mappings (activity)
        if (q.includes('update conversation_mappings') && q.includes('last_activity_at')) {
            return this.handleActivityUpdate(params);
        }

        // INSERT message_tracking (with wamid ON CONFLICT)
        if (q.includes('insert into message_tracking') && q.includes('on conflict (wamid)')) {
            return this.handleMessageInsertWithWamid(params);
        }

        // INSERT message_tracking (no conflict, outbound without wamid)
        if (q.includes('insert into message_tracking') && !q.includes('on conflict')) {
            return this.handleMessageInsertNoConflict(params);
        }

        // SELECT message_tracking WHERE wamid = $1
        if (q.includes('message_tracking') && q.includes('wamid = $1') && q.startsWith('select')) {
            return this.getMessageByWamid(params[0]);
        }

        // SELECT message_tracking WHERE genesys_message_id = $1
        if (q.includes('message_tracking') && q.includes('genesys_message_id = $1') && q.startsWith('select')) {
            return this.getMessageByGenesysId(params[0]);
        }

        // SELECT message_tracking WHERE mapping_id = $1 (NEW for retrieval tests)
        if (q.includes('message_tracking') && q.includes('mapping_id = $1') && q.startsWith('select')) {
            return this.getMessagesByMappingId(params[0]);
        }

        // UPDATE message_tracking SET status (optimistic lock) - 4 params
        if (q.includes('update message_tracking') && q.includes('set status') && params.length === 4) {
            return this.handleMessageStatusUpdate(params);
        }

        // UPDATE message_tracking SET status (legacy) - 2 or 3 params
        if (q.includes('update message_tracking') && q.includes('set status') && (params.length === 2 || params.length === 3)) {
            return this.handleLegacyStatusUpdate(params);
        }

        // SELECT conversation_mappings WHERE wa_id
        if (q.includes('conversation_mappings') && q.includes('wa_id = $1')) {
            return this.getMappingByWaId(params[0]);
        }

        // SELECT conversation_mappings WHERE conversation_id
        if (q.includes('conversation_mappings') && q.includes('conversation_id = $1')) {
            return this.getMappingByConversationId(params[0]);
        }

        return { rows: [], rowCount: 0 };
    }

    // --------------- Mapping Handlers ---------------

    private handleMappingInsert(params: any[]): QueryResult {
        const [wa_id, wamid, contact_name, phone_number_id, display_phone_number] = params;
        const mappings = this.storage.get('mappings') || [];

        const existing = mappings.find((m: any) => m.wa_id === wa_id && m.status === 'active');

        if (existing) {
            existing.last_message_id = wamid;
            existing.last_activity_at = new Date();
            existing.updated_at = new Date();
            existing.contact_name = contact_name || existing.contact_name;
            return { rows: [{ ...existing, is_insert: false }], rowCount: 1 };
        }

        const newMapping = {
            id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            wa_id,
            conversation_id: null,
            communication_id: null,
            last_message_id: wamid,
            contact_name: contact_name || null,
            phone_number_id: phone_number_id || null,
            display_phone_number: display_phone_number || null,
            status: 'active',
            last_activity_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
            is_insert: true,
        };

        if (!this.storage.has('mappings')) this.storage.set('mappings', []);
        this.storage.get('mappings')!.push(newMapping);

        return { rows: [newMapping], rowCount: 1 };
    }

    private handleCorrelation(params: any[]): QueryResult {
        const [conversation_id, communication_id, whatsapp_message_id] = params;
        const mappings = this.storage.get('mappings') || [];

        const mapping = mappings.find(
            (m: any) => m.last_message_id === whatsapp_message_id && m.conversation_id === null
        );

        if (!mapping) return { rows: [], rowCount: 0 };

        mapping.conversation_id = conversation_id;
        mapping.communication_id = communication_id;
        mapping.updated_at = new Date();

        return { rows: [mapping], rowCount: 1 };
    }

    private handleActivityUpdate(params: any[]): QueryResult {
        const [message_id, mapping_id] = params;
        const mappings = this.storage.get('mappings') || [];

        const mapping = mappings.find((m: any) => m.id === mapping_id);
        if (mapping) {
            mapping.last_message_id = message_id;
            mapping.last_activity_at = new Date();
            mapping.updated_at = new Date();
        }

        return { rows: mapping ? [mapping] : [], rowCount: mapping ? 1 : 0 };
    }

    private getMappingByWaId(wa_id: string): QueryResult {
        const mappings = this.storage.get('mappings') || [];
        const found = mappings.find((m: any) => m.wa_id === wa_id && m.status === 'active');
        return found ? { rows: [found], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    private getMappingByConversationId(conversation_id: string): QueryResult {
        const mappings = this.storage.get('mappings') || [];
        const found = mappings.find((m: any) => m.conversation_id === conversation_id && m.status === 'active');
        return found ? { rows: [found], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    // --------------- Message Handlers ---------------

    private handleMessageInsertWithWamid(params: any[]): QueryResult {
        const [mapping_id, wamid, genesys_message_id, direction, status, media_url] = params;
        const messages = this.storage.get('messages') || [];

        const existing = messages.find((m: any) => m.wamid === wamid);
        if (existing) {
            return { rows: [], rowCount: 0 }; // ON CONFLICT DO NOTHING
        }

        const newMsg = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            mapping_id,
            wamid,
            genesys_message_id: genesys_message_id || null,
            direction,
            status,
            media_url: media_url || null,
            created_at: new Date(),
            updated_at: new Date(),
            delivered_at: null,
            is_insert: true,
        };

        if (!this.storage.has('messages')) this.storage.set('messages', []);
        this.storage.get('messages')!.push(newMsg);

        return { rows: [newMsg], rowCount: 1 };
    }

    private handleMessageInsertNoConflict(params: any[]): QueryResult {
        const [mapping_id, genesys_message_id, direction, status, media_url] = params;

        const newMsg = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            mapping_id,
            wamid: null,
            genesys_message_id: genesys_message_id || null,
            direction,
            status,
            media_url: media_url || null,
            created_at: new Date(),
            updated_at: new Date(),
            delivered_at: null,
            is_insert: true,
        };

        if (!this.storage.has('messages')) this.storage.set('messages', []);
        this.storage.get('messages')!.push(newMsg);

        return { rows: [newMsg], rowCount: 1 };
    }

    private getMessageByWamid(wamid: string): QueryResult {
        const messages = this.storage.get('messages') || [];
        const found = messages.find((m: any) => m.wamid === wamid);
        return found ? { rows: [found], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    private getMessageByGenesysId(genesys_message_id: string): QueryResult {
        const messages = this.storage.get('messages') || [];
        const found = messages.find((m: any) => m.genesys_message_id === genesys_message_id);
        return found ? { rows: [found], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    private getMessagesByMappingId(mapping_id: string): QueryResult {
        const messages = this.storage.get('messages') || [];
        const found = messages.filter((m: any) => m.mapping_id === mapping_id);
        return { rows: found, rowCount: found.length };
    }

    private handleMessageStatusUpdate(params: any[]): QueryResult {
        const [new_status, timestamp, message_id, current_status] = params;
        const messages = this.storage.get('messages') || [];
        const message = messages.find((m: any) => m.id === message_id && m.status === current_status);

        if (!message) return { rows: [], rowCount: 0 };

        message.status = new_status;
        message.updated_at = timestamp;

        return { rows: [message], rowCount: 1 };
    }

    private handleLegacyStatusUpdate(params: any[]): QueryResult {
        // [status, wamid, (genesys_id)]
        const [new_status, wamid, genesys_id] = params;
        const messages = this.storage.get('messages') || [];
        const message = messages.find((m: any) => m.wamid === wamid);

        if (!message) return { rows: [], rowCount: 0 };

        message.status = new_status;
        message.updated_at = new Date(); // Mock CURRENT_TIMESTAMP
        if (genesys_id) message.genesys_message_id = genesys_id;

        return { rows: [message], rowCount: 1 };
    }

    // --------------- Test Utilities ---------------

    seed(table: string, data: any[]) {
        this.storage.set(table, [...data]);
    }

    clear() {
        this.storage.clear();
    }

    getData(table: string): any[] {
        return this.storage.get(table) || [];
    }

    getQueryStub() {
        return this.queryStub;
    }

    reset() {
        this.clear();
        this.queryStub.mockClear();
    }
}

export const createMockDatabase = () => new MockDatabase();
