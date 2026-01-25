import axios from 'axios';
import authService from './authService';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

class MessageService {
    /**
     * Send a text message
     */
    async sendMessage(data) {
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/messages/send`,
                data,
                { headers: { Authorization: `Bearer ${authService.getToken()}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to send message');
        }
    }

    /**
     * Send a template message
     */
    async sendTemplate(data) {
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/messages/send/template`,
                data,
                { headers: { Authorization: `Bearer ${authService.getToken()}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to send template');
        }
    }

    /**
     * Upload media file
     */
    async uploadMedia(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(
                `${API_BASE_URL}/api/messages/upload`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${authService.getToken()}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to upload media');
        }
    }
}

export default new MessageService();
