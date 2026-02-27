import axios from 'axios';
import authService from './authService';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

const getHeaders = () => ({
    Authorization: `Bearer ${authService.getToken()}`
});

const templateService = {
    async fetchTemplates(filters = {}) {
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.status) params.append('status', filters.status);
        if (filters.search) params.append('search', filters.search);
        if (filters.language) params.append('language', filters.language);
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.offset) params.append('offset', filters.offset);

        const response = await axios.get(
            `${API_BASE_URL}/api/templates?${params.toString()}`,
            { headers: getHeaders() }
        );
        return response.data;
    },

    async getTemplate(id) {
        const response = await axios.get(
            `${API_BASE_URL}/api/templates/${id}`,
            { headers: getHeaders() }
        );
        return response.data;
    },

    async createTemplate(payload) {
        const response = await axios.post(
            `${API_BASE_URL}/api/templates`,
            payload,
            { headers: getHeaders() }
        );
        return response.data;
    },

    async updateTemplate(id, payload) {
        const response = await axios.put(
            `${API_BASE_URL}/api/templates/${id}`,
            payload,
            { headers: getHeaders() }
        );
        return response.data;
    },

    async deleteTemplate(id) {
        const response = await axios.delete(
            `${API_BASE_URL}/api/templates/${id}`,
            { headers: getHeaders() }
        );
        return response.data;
    },

    async duplicateTemplate(id, opts = {}) {
        const response = await axios.post(
            `${API_BASE_URL}/api/templates/${id}/duplicate`,
            opts,
            { headers: getHeaders() }
        );
        return response.data;
    },

    async syncTemplatesFromMeta() {
        const response = await axios.post(
            `${API_BASE_URL}/api/templates/sync`,
            {},
            { headers: getHeaders() }
        );
        return response.data;
    },

    async uploadMedia(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(
            `${API_BASE_URL}/api/templates/media/upload`,
            formData,
            {
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'multipart/form-data'
                }
            }
        );
        return response.data;
    }
};

export default templateService;
