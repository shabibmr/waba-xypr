import React from 'react';
import { Shield } from 'lucide-react';

function AuthenticationEditor({ components, onChange }) {
    const body = components.find(c => c.type === 'BODY') || { type: 'BODY', text: '{{1}} is your verification code.' };
    const footer = components.find(c => c.type === 'FOOTER');
    const buttons = components.find(c => c.type === 'BUTTONS');

    const hasDisclaimer = body.text?.includes('do not share this code');
    const hasExpiry = footer?.text?.includes('expires in');
    const buttonType = buttons?.buttons?.[0]?.type || 'COPY_CODE';

    const updateComponents = (updates) => {
        const newComponents = [
            updates.body || body,
            ...(updates.footer ? [updates.footer] : footer ? [footer] : []),
            updates.buttons || buttons || { type: 'BUTTONS', buttons: [{ type: 'COPY_CODE', text: 'Copy Code', example: '123456' }] }
        ];
        onChange(newComponents);
    };

    const toggleDisclaimer = () => {
        const baseText = '{{1}} is your verification code.';
        const disclaimerText = ' For your security, do not share this code.';
        const newText = hasDisclaimer ? baseText : baseText + disclaimerText;
        updateComponents({ body: { ...body, text: newText } });
    };

    const toggleExpiry = () => {
        if (hasExpiry) {
            updateComponents({ footer: null });
        } else {
            updateComponents({ footer: { type: 'FOOTER', text: 'This code expires in 10 minutes.' } });
        }
    };

    const changeButtonType = (type) => {
        const btn = type === 'COPY_CODE'
            ? { type: 'COPY_CODE', text: 'Copy Code', example: '123456' }
            : { type: 'URL', text: 'Auto-fill', url: 'https://example.com/otp?code={{1}}' };
        updateComponents({ buttons: { type: 'BUTTONS', buttons: [btn] } });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-orange-400">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Authentication Template</span>
            </div>

            <p className="text-xs text-gray-400">
                Authentication templates have a fixed structure. No media, URLs, or emoji are allowed.
            </p>

            {/* Body preview (read-only) */}
            <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Message Body</label>
                <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">
                    {body.text}
                </div>
            </div>

            {/* Security disclaimer toggle */}
            <label className="flex items-center gap-3 cursor-pointer" onClick={toggleDisclaimer}>
                <div className={`w-10 h-5 rounded-full transition ${hasDisclaimer ? 'bg-blue-600' : 'bg-gray-600'} relative`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${hasDisclaimer ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">Security disclaimer</span>
            </label>

            {/* Code expiry toggle */}
            <label className="flex items-center gap-3 cursor-pointer" onClick={toggleExpiry}>
                <div className={`w-10 h-5 rounded-full transition ${hasExpiry ? 'bg-blue-600' : 'bg-gray-600'} relative`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${hasExpiry ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">Code expiry warning</span>
            </label>

            {/* Button type */}
            <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">OTP Button Type</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => changeButtonType('COPY_CODE')}
                        className={`px-3 py-2 rounded-lg text-sm transition ${
                            buttonType === 'COPY_CODE' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        Copy Code
                    </button>
                    <button
                        onClick={() => changeButtonType('URL')}
                        className={`px-3 py-2 rounded-lg text-sm transition ${
                            buttonType === 'URL' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        One-Tap Autofill
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AuthenticationEditor;
