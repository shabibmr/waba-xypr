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
        <div className="space-y-5 bg-white p-5 rounded-2xl border border-surface-200">
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 self-start w-fit font-bold uppercase tracking-wider text-[10px]">
                <Shield className="w-3.5 h-3.5" />
                <span>Authentication Template</span>
            </div>

            <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400 ml-1">
                Authentication templates have a fixed structure. No media, URLs, or emoji are allowed.
            </p>

            {/* Body preview (read-only) */}
            <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Message Body</label>
                <div className="px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-600 font-medium leading-relaxed italic">
                    "{body.text}"
                </div>
            </div>

            {/* Toggles Container */}
            <div className="grid grid-cols-2 gap-4">
                {/* Security disclaimer toggle */}
                <label className="flex flex-col gap-3 p-4 bg-surface-50 rounded-xl border border-surface-200 cursor-pointer hover:border-primary-300 transition-all group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-surface-700">Security Disclaimer</span>
                        <div className="relative inline-flex items-center" onClick={(e) => { e.preventDefault(); toggleDisclaimer(); }}>
                            <div className={`w-9 h-5 rounded-full transition-colors ${hasDisclaimer ? 'bg-primary-500' : 'bg-surface-300'}`} />
                            <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${hasDisclaimer ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </label>

                {/* Code expiry toggle */}
                <label className="flex flex-col gap-3 p-4 bg-surface-50 rounded-xl border border-surface-200 cursor-pointer hover:border-primary-300 transition-all group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-surface-700">Expiry Warning</span>
                        <div className="relative inline-flex items-center" onClick={(e) => { e.preventDefault(); toggleExpiry(); }}>
                            <div className={`w-9 h-5 rounded-full transition-colors ${hasExpiry ? 'bg-primary-500' : 'bg-surface-300'}`} />
                            <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${hasExpiry ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </label>
            </div>

            {/* Button type */}
            <div className="space-y-3 pt-2">
                <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">OTP Button Architecture</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => changeButtonType('COPY_CODE')}
                        className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                            buttonType === 'COPY_CODE' 
                                ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-200' 
                                : 'bg-white text-surface-600 border-surface-200 hover:border-primary-300 hover:text-primary-600'
                        }`}
                    >
                        Copy Code
                    </button>
                    <button
                        onClick={() => changeButtonType('URL')}
                        className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                            buttonType === 'URL' 
                                ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-200' 
                                : 'bg-white text-surface-600 border-surface-200 hover:border-primary-300 hover:text-primary-600'
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
